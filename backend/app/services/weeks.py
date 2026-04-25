from datetime import datetime, timedelta, timezone


def get_scrapp_week(dt: datetime | None = None) -> tuple[int, int]:
    """Returns (week_number, year) for Scrapp's Sunday-based weeks."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    iso_year, iso_week, _ = dt.isocalendar()
    return iso_week, iso_year


def get_next_sunday_midnight() -> datetime:
    """Returns the next Sunday at midnight UTC."""
    now = datetime.now(timezone.utc)
    days_until_sunday = (6 - now.weekday()) % 7
    if days_until_sunday == 0 and now.hour >= 0:
        days_until_sunday = 7
    next_sunday = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
        days=days_until_sunday
    )
    return next_sunday


def time_until_reveal() -> timedelta:
    """Returns time remaining until the next Sunday reveal."""
    return get_next_sunday_midnight() - datetime.now(timezone.utc)


def is_late_for_week(week_number: int, year: int) -> bool:
    """Check if publishing now would be late for the given week."""
    current_week, current_year = get_scrapp_week()
    if current_year > year:
        return True
    if current_year == year and current_week > week_number:
        return True
    return False
