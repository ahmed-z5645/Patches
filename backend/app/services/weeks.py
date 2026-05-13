from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo("America/New_York")


def get_edition_week(dt: datetime | None = None) -> tuple[int, int]:
    """Returns (week_number, year) for Edition's Eastern-time-based weeks.

    The edition week boundary is Monday 9:00 AM Eastern (the reveal moment),
    not the ISO Monday 00:00 boundary. Shifting back 9 hours lets us reuse
    isocalendar() while keeping Mon 00:00–08:59 ET in the prior edition week.
    """
    if dt is None:
        dt = datetime.now(EASTERN)
    else:
        dt = dt.astimezone(EASTERN)
    shifted = dt - timedelta(hours=9)
    iso_year, iso_week, _ = shifted.isocalendar()
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
    """Returns True if publishing now would be past the Monday 9 AM Eastern deadline
    for the given target week (i.e., the edition week has already rolled past it)."""
    current_week, current_year = get_edition_week()
    if current_year > year:
        return True
    if current_year == year and current_week > week_number:
        return True
    return False


def _shift_week(week: int, year: int, delta: int) -> tuple[int, int]:
    """Returns (week, year) offset by `delta` weeks, normalized via ISO calendar."""
    monday = datetime.fromisocalendar(year, week, 1)
    target = monday + timedelta(weeks=delta)
    iso = target.isocalendar()
    return iso.week, iso.year


def is_week_closed(week_number: int, year: int) -> bool:
    """Returns True if the late-grace window for the given week has elapsed.
    A week is closed once the current edition week is >= week + 2."""
    current_week, current_year = get_edition_week()
    closed_week, closed_year = _shift_week(week_number, year, 2)
    if current_year > closed_year:
        return True
    if current_year == closed_year and current_week >= closed_week:
        return True
    return False


def can_target_week(week_number: int, year: int) -> bool:
    """Returns True if the given week is a legal posting target right now.
    Legal targets: current edition week N, the prior week N-1 (only while still
    in late grace), and the next week N+1 (pre-publish)."""
    current_week, current_year = get_edition_week()
    prev_w, prev_y = _shift_week(current_week, current_year, -1)
    next_w, next_y = _shift_week(current_week, current_year, 1)

    if (week_number, year) == (current_week, current_year):
        return True
    if (week_number, year) == (next_w, next_y):
        return True
    if (week_number, year) == (prev_w, prev_y):
        return not is_week_closed(week_number, year)
    return False
