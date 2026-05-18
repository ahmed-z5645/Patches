import json
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from pywebpush import WebPushException, webpush
from supabase import create_client
from zoneinfo import ZoneInfo

from app.config import get_settings
from app.services.weeks import get_edition_week

EASTERN = ZoneInfo("America/New_York")
logger = logging.getLogger(__name__)


def _load_vapid_private_key() -> str:
    """Return the VAPID private key PEM for pywebpush.

    The key must be supplied as a PEM block ("-----BEGIN EC PRIVATE KEY-----").
    Anything else disables push (logged) rather than raising.
    """
    raw = get_settings().vapid_private_key
    if not raw:
        return ""
    if raw.startswith("-----"):
        return raw
    logger.error(
        "VAPID_PRIVATE_KEY is not PEM-formatted — push disabled. "
        "Supply the key as a PEM block."
    )
    return ""


def _send_push(subscription_info: dict, payload: dict) -> bool:
    settings = get_settings()
    pem = _load_vapid_private_key()
    if not pem:
        logger.warning("VAPID private key not configured — skipping push")
        return False
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=pem,
            vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
        )
        return True
    except WebPushException as exc:
        if exc.response is not None and exc.response.status_code in (404, 410):
            return False  # subscription expired — caller deletes it
        logger.error("Push delivery failed: %s", exc)
        return False


def send_reminder_notifications() -> None:
    """Push reminders to subscribers who haven't published this week."""
    db = create_client(
        get_settings().supabase_url,
        get_settings().supabase_service_role_key,
    )
    week, year = get_edition_week()

    subs = db.table("push_subscriptions").select("user_id, endpoint, p256dh, auth").execute()
    if not subs.data:
        return

    published = (
        db.table("posts")
        .select("user_id")
        .eq("week_number", week)
        .eq("year", year)
        .eq("is_published", True)
        .execute()
    )
    published_ids = {row["user_id"] for row in published.data or []}

    payload = {
        "title": "Edition — deadline approaching",
        "body": "You haven't published your post yet. The Sunday midnight deadline is coming up!",
        "url": "/editor",
    }

    expired_endpoints: list[str] = []
    for sub in subs.data:
        if sub["user_id"] in published_ids:
            continue
        ok = _send_push(
            {
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            payload,
        )
        if not ok:
            expired_endpoints.append(sub["endpoint"])

    for endpoint in expired_endpoints:
        db.table("push_subscriptions").delete().eq("endpoint", endpoint).execute()
        logger.info("Removed expired push subscription: %s…", endpoint[:40])


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=EASTERN)
    for trigger in [
        CronTrigger(day_of_week="sat", hour=17, minute=0, timezone=EASTERN),
        CronTrigger(day_of_week="sun", hour=12, minute=0, timezone=EASTERN),
        CronTrigger(day_of_week="sun", hour=21, minute=0, timezone=EASTERN),
    ]:
        scheduler.add_job(send_reminder_notifications, trigger, misfire_grace_time=300)
    return scheduler
