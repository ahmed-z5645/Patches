from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo("America/New_York")


def get_edition_week(dt: datetime | None = None) -> tuple[int, int]:
    """Returns (week_number, year) for Edition's Eastern-time-based weeks."""
    if dt is None:
        dt = datetime.now(EASTERN)
    else:
        dt = dt.astimezone(EASTERN)
    iso_year, iso_week, _ = dt.isocalendar()
    return iso_week, iso_year


def get_reveal_for_week(week_number: int, year: int) -> datetime:
    """Returns Monday 9:00 AM Eastern — the reveal time for the given ISO week."""
    monday_of_week = datetime.fromisocalendar(year, week_number, 1)
    next_monday = monday_of_week + timedelta(days=7)
    return datetime(
        next_monday.year, next_monday.month, next_monday.day,
        9, 0, 0,
        tzinfo=EASTERN,
    )


def is_revealed(week_number: int, year: int) -> bool:
    """Returns True if Monday 9 AM Eastern for the given week has passed."""
    return datetime.now(EASTERN) >= get_reveal_for_week(week_number, year)


def get_next_reveal() -> datetime:
    """Returns the next Monday at 9:00 AM Eastern."""
    now = datetime.now(EASTERN)
    days_until_monday = (7 - now.weekday()) % 7  # 0 if today is Monday
    candidate = (now + timedelta(days=days_until_monday)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    if candidate <= now:
        candidate += timedelta(days=7)
    return candidate


def time_until_reveal() -> timedelta:
    """Returns time remaining until the next Monday 9 AM Eastern reveal."""
    return get_next_reveal() - datetime.now(EASTERN)


def is_late_for_week(week_number: int, year: int) -> bool:
    """Returns True if posting/editing now is past the Sunday midnight Eastern deadline."""
    current_week, current_year = get_edition_week()
    if current_year > year:
        return True
    if current_year == year and current_week > week_number:
        return True
    return False
