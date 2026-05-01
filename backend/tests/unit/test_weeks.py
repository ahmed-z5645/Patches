from datetime import datetime, timezone
from unittest.mock import patch

from app.services.weeks import (
    get_edition_week,
    get_next_sunday_midnight,
    is_late_for_week,
    time_until_reveal,
)


def test_get_edition_week_known_date():
    dt = datetime(2025, 3, 10, 12, 0, 0, tzinfo=timezone.utc)  # Monday week 11
    week, year = get_edition_week(dt)
    assert week == 11
    assert year == 2025


def test_get_edition_week_different_date():
    dt = datetime(2025, 1, 6, 0, 0, 0, tzinfo=timezone.utc)  # Monday week 2
    week, year = get_edition_week(dt)
    assert week == 2
    assert year == 2025


def test_get_edition_week_uses_utc_now_when_none():
    week, year = get_edition_week()
    assert isinstance(week, int)
    assert isinstance(year, int)
    assert 1 <= week <= 53
    assert year >= 2025


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


def test_get_next_sunday_midnight_is_future():
    now = datetime.now(timezone.utc)
    next_sunday = get_next_sunday_midnight()
    assert next_sunday > now
    assert next_sunday.weekday() == 6  # Sunday
    assert next_sunday.hour == 0
    assert next_sunday.minute == 0
    assert next_sunday.second == 0


def test_time_until_reveal_is_positive():
    td = time_until_reveal()
    assert td.total_seconds() > 0
