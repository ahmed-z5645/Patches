"""Unit tests for app.services.push_notifications.

Covers:
- VAPID key loader rejects non-PEM input (push disabled, no raise)
- Scheduler registers the expected weekend reminder triggers
- send_reminder_notifications skips users who already published this week
  and cleans up subscriptions whose push delivery returned expired
"""

from unittest.mock import patch

import pytest
from apscheduler.triggers.cron import CronTrigger

from app.services import push_notifications as pn


# ---------------------------------------------------------------------------
# _load_vapid_private_key — PEM gate
# ---------------------------------------------------------------------------

class _Settings:
    def __init__(self, vapid_private_key: str = "", vapid_contact_email: str = "ops@example.com"):
        self.vapid_private_key = vapid_private_key
        self.vapid_contact_email = vapid_contact_email


def test_load_vapid_returns_empty_when_unset():
    with patch.object(pn, "get_settings", return_value=_Settings(vapid_private_key="")):
        assert pn._load_vapid_private_key() == ""


def test_load_vapid_returns_pem_when_pem_formatted():
    pem = "-----BEGIN EC PRIVATE KEY-----\nABCD\n-----END EC PRIVATE KEY-----"
    with patch.object(pn, "get_settings", return_value=_Settings(vapid_private_key=pem)):
        assert pn._load_vapid_private_key() == pem


def test_load_vapid_returns_empty_when_non_pem(caplog):
    # Base64-only / raw key string — must be rejected with a log, no raise.
    with patch.object(pn, "get_settings", return_value=_Settings(vapid_private_key="not-a-pem-block")):
        with caplog.at_level("ERROR", logger=pn.logger.name):
            result = pn._load_vapid_private_key()
    assert result == ""
    assert any("not PEM-formatted" in r.message for r in caplog.records)


# ---------------------------------------------------------------------------
# _send_push — short-circuits with no key
# ---------------------------------------------------------------------------

def test_send_push_skips_when_no_pem():
    with patch.object(pn, "_load_vapid_private_key", return_value=""):
        with patch.object(pn, "webpush") as webpush_mock:
            ok = pn._send_push(
                {"endpoint": "https://push.test", "keys": {"p256dh": "p", "auth": "a"}},
                {"title": "x"},
            )
    assert ok is False
    webpush_mock.assert_not_called()


def test_send_push_returns_true_on_webpush_success():
    with patch.object(pn, "_load_vapid_private_key", return_value="-----BEGIN-----"):
        with patch.object(pn, "get_settings", return_value=_Settings(vapid_private_key="-----BEGIN-----")):
            with patch.object(pn, "webpush") as webpush_mock:
                ok = pn._send_push(
                    {"endpoint": "https://push.test", "keys": {"p256dh": "p", "auth": "a"}},
                    {"title": "x"},
                )
    assert ok is True
    webpush_mock.assert_called_once()


# ---------------------------------------------------------------------------
# create_scheduler — verifies reminder cron contract
# ---------------------------------------------------------------------------

def test_scheduler_registers_three_weekend_triggers():
    scheduler = pn.create_scheduler()
    try:
        jobs = scheduler.get_jobs()
        assert len(jobs) == 3
        # All should be CronTrigger and target the reminder function.
        for j in jobs:
            assert isinstance(j.trigger, CronTrigger)
            assert j.func is pn.send_reminder_notifications
    finally:
        scheduler.shutdown(wait=False) if scheduler.running else None


# ---------------------------------------------------------------------------
# send_reminder_notifications — orchestration
# ---------------------------------------------------------------------------

class _FakeBuilder:
    def __init__(self, data):
        self._data = data
        self._delete_endpoint = None

    def select(self, *a, **kw): return self
    def eq(self, *a, **kw): return self

    def delete(self):
        self._mode = "delete"
        return self

    def execute(self):
        return type("R", (), {"data": self._data})()


class _FakeDB:
    def __init__(self, subs, published_user_ids):
        self._subs = subs
        self._published_user_ids = published_user_ids
        self.deleted_endpoints: list[str] = []

    def table(self, name: str):
        if name == "push_subscriptions":
            db = self

            class _SubBuilder:
                def __init__(self):
                    self._delete_target = None

                def select(self, *a, **kw): return self
                def execute(self):
                    return type("R", (), {"data": db._subs})()

                def delete(self):
                    parent = self

                    class _Del:
                        def eq(_, col, val):
                            parent._delete_target = val
                            return _
                        def execute(_):
                            db.deleted_endpoints.append(parent._delete_target)
                            return type("R", (), {"data": []})()
                    return _Del()
            return _SubBuilder()

        if name == "posts":
            data = [{"user_id": uid} for uid in self._published_user_ids]

            class _PB:
                def select(self_, *a, **kw): return self_
                def eq(self_, *a, **kw): return self_
                def execute(self_):
                    return type("R", (), {"data": data})()
            return _PB()
        raise AssertionError(f"unexpected table {name}")


def test_send_reminder_skips_users_who_already_published():
    subs = [
        {"user_id": "u-a", "endpoint": "https://push/a", "p256dh": "p", "auth": "a"},
        {"user_id": "u-b", "endpoint": "https://push/b", "p256dh": "p", "auth": "a"},
    ]
    fake = _FakeDB(subs, published_user_ids={"u-a"})  # u-a already published

    pushed = []

    def fake_send(sub_info, payload):
        pushed.append(sub_info["endpoint"])
        return True

    with patch.object(pn, "create_client", return_value=fake):
        with patch.object(pn, "_send_push", side_effect=fake_send):
            with patch.object(pn, "get_edition_week", return_value=(10, 2025)):
                pn.send_reminder_notifications()

    assert pushed == ["https://push/b"]
    assert fake.deleted_endpoints == []


def test_send_reminder_removes_expired_subscriptions():
    subs = [{"user_id": "u-b", "endpoint": "https://push/b", "p256dh": "p", "auth": "a"}]
    fake = _FakeDB(subs, published_user_ids=set())

    with patch.object(pn, "create_client", return_value=fake):
        with patch.object(pn, "_send_push", return_value=False):  # expired
            with patch.object(pn, "get_edition_week", return_value=(10, 2025)):
                pn.send_reminder_notifications()

    assert fake.deleted_endpoints == ["https://push/b"]


def test_send_reminder_noop_when_no_subscriptions():
    fake = _FakeDB(subs=[], published_user_ids=set())
    with patch.object(pn, "create_client", return_value=fake):
        with patch.object(pn, "_send_push") as send:
            with patch.object(pn, "get_edition_week", return_value=(10, 2025)):
                pn.send_reminder_notifications()
    send.assert_not_called()
    assert fake.deleted_endpoints == []
