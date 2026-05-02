from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from unittest.mock import patch

from app.services.weeks import (
    EASTERN,
    get_edition_week,
    get_next_reveal,
    get_reveal_for_week,
    is_late_for_week,
    is_revealed,
    time_until_reveal,
)


def test_get_edition_week_known_date():
    dt = datetime(2025, 3, 10, 12, 0, 0, tzinfo=timezone.utc)  # Monday week 11
    week, year = get_edition_week(dt)
    assert week == 11
    assert year == 2025


def test_get_edition_week_different_date():
    dt = datetime(2025, 1, 6, 12, 0, 0, tzinfo=timezone.utc)  # Monday week 2 (noon UTC = 7 AM Eastern)
    week, year = get_edition_week(dt)
    assert week == 2
    assert year == 2025


def test_get_edition_week_uses_eastern_now_when_none():
    week, year = get_edition_week()
    assert isinstance(week, int)
    assert isinstance(year, int)
    assert 1 <= week <= 53
    assert year >= 2025


def test_get_edition_week_sunday_night_before_midnight_eastern():
    # Sunday 11:59 PM Eastern — still in the current week, not yet late
    dt = datetime(2025, 3, 16, 23, 59, 0, tzinfo=EASTERN)  # Sun week 11
    week, year = get_edition_week(dt)
    assert week == 11
    assert year == 2025


def test_get_edition_week_monday_after_midnight_eastern():
    # Monday 12:01 AM Eastern — deadline passed, now in week 12
    dt = datetime(2025, 3, 17, 0, 1, 0, tzinfo=EASTERN)  # Mon week 12
    week, year = get_edition_week(dt)
    assert week == 12
    assert year == 2025


def test_is_late_for_week_current_week_is_not_late():
    current_week, current_year = get_edition_week()
    assert is_late_for_week(current_week, current_year) is False


def test_is_late_for_week_past_week_is_late():
    assert is_late_for_week(1, 2024) is True


def test_is_late_for_week_past_year_is_late():
    assert is_late_for_week(52, 2020) is True


def test_is_late_for_week_same_year_lower_week():
    current_week, current_year = get_edition_week()
    if current_week > 1:
        assert is_late_for_week(current_week - 1, current_year) is True


def test_get_next_reveal_is_future():
    now = datetime.now(EASTERN)
    next_reveal = get_next_reveal()
    assert next_reveal > now


def test_get_next_reveal_is_monday_at_9am_eastern():
    next_reveal = get_next_reveal()
    eastern_reveal = next_reveal.astimezone(EASTERN)
    assert eastern_reveal.weekday() == 0  # Monday
    assert eastern_reveal.hour == 9
    assert eastern_reveal.minute == 0
    assert eastern_reveal.second == 0


def test_time_until_reveal_is_positive():
    td = time_until_reveal()
    assert td.total_seconds() > 0


def test_get_reveal_for_week_is_monday_9am_eastern():
    reveal = get_reveal_for_week(11, 2025)
    eastern_reveal = reveal.astimezone(EASTERN)
    assert eastern_reveal.weekday() == 0  # Monday
    assert eastern_reveal.hour == 9
    # Week 11 of 2025 ends Sunday March 16; Monday March 17 at 9 AM Eastern
    assert eastern_reveal.day == 17
    assert eastern_reveal.month == 3
    assert eastern_reveal.year == 2025


def test_is_revealed_past_week():
    # Week 1 of 2024 is long past its reveal
    assert is_revealed(1, 2024) is True


def test_is_revealed_far_future():
    # Week 52 of 2099 has not been revealed yet
    assert is_revealed(52, 2099) is False
