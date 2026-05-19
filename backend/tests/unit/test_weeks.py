from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from unittest.mock import patch

from app.services import weeks as weeks_module
from app.services.feed import is_past_week
from app.services.weeks import (
    EASTERN,
    get_edition_week,
    get_next_reveal,
    get_reveal_for_week,
    get_selectable_weeks,
    is_late_for_week,
    is_revealed,
    time_until_reveal,
)


class _FrozenDatetime(datetime):
    """datetime subclass whose .now() returns a fixed instant.

    Patch the `datetime` symbol inside app.services.weeks with a subclass
    bound to a specific moment, so is_revealed / get_edition_week behave
    deterministically. fromisocalendar / astimezone continue to work
    because they're inherited from datetime.
    """

    _frozen: datetime

    @classmethod
    def now(cls, tz=None):
        if tz is None:
            return cls._frozen.replace(tzinfo=None)
        return cls._frozen.astimezone(tz)


def _freeze(instant: datetime):
    """Return a context manager that pins weeks_module.datetime to `instant`."""
    frozen_cls = type("_Frozen", (_FrozenDatetime,), {"_frozen": instant})
    return patch.object(weeks_module, "datetime", frozen_cls)


def test_get_edition_week_known_date():
    # Mon 2025-03-10 12:00 UTC = 08:00 ET, before the Mon 09:00 ET cutoff,
    # so it is still in ISO week 10 (the edition week has not rolled yet).
    dt = datetime(2025, 3, 10, 12, 0, 0, tzinfo=timezone.utc)
    week, year = get_edition_week(dt)
    assert week == 10
    assert year == 2025


def test_get_edition_week_after_monday_9am_cutoff():
    # Mon 2025-03-10 14:00 UTC = 10:00 ET — past the Mon 09:00 ET cutoff,
    # so we have rolled into ISO week 11.
    dt = datetime(2025, 3, 10, 14, 0, 0, tzinfo=timezone.utc)
    week, year = get_edition_week(dt)
    assert week == 11
    assert year == 2025


def test_get_edition_week_uses_eastern_now_when_none():
    week, year = get_edition_week()
    assert isinstance(week, int)
    assert isinstance(year, int)
    assert 1 <= week <= 53
    assert year >= 2025


def test_get_edition_week_sunday_night_before_midnight_eastern():
    # Sunday 11:59 PM Eastern — comfortably before the Mon 09:00 ET cutoff,
    # still in the current edition week.
    dt = datetime(2025, 3, 16, 23, 59, 0, tzinfo=EASTERN)
    week, year = get_edition_week(dt)
    assert week == 11
    assert year == 2025


def test_get_edition_week_monday_before_9am_eastern():
    # Monday 12:01 AM Eastern — Monday has started but the 9 AM ET cutoff
    # has not, so the edition week is still 11 (not 12).
    dt = datetime(2025, 3, 17, 0, 1, 0, tzinfo=EASTERN)
    week, year = get_edition_week(dt)
    assert week == 11
    assert year == 2025


def test_get_edition_week_monday_after_9am_eastern():
    # Monday 09:01 AM Eastern — cutoff has passed, now in week 12.
    dt = datetime(2025, 3, 17, 9, 1, 0, tzinfo=EASTERN)
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


# ---------------------------------------------------------------------------
# Reveal-boundary contract (Monday 9 AM Eastern, NOT Sunday midnight)
# ---------------------------------------------------------------------------
# CLAUDE.md describes "Sunday at midnight" but the implementation reveals at
# Monday 9 AM Eastern. These tests pin the actual implementation behavior so
# the cost-reduction refactor cannot silently shift the boundary.

def test_is_revealed_one_second_before_reveal_is_false():
    # Week 11 of 2025 reveals at Mon March 17 09:00 ET. One second prior is False.
    instant = datetime(2025, 3, 17, 8, 59, 59, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_revealed(11, 2025) is False


def test_is_revealed_exactly_at_reveal_is_true():
    instant = datetime(2025, 3, 17, 9, 0, 0, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_revealed(11, 2025) is True


def test_is_revealed_one_second_after_reveal_is_true():
    instant = datetime(2025, 3, 17, 9, 0, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_revealed(11, 2025) is True


def test_is_past_week_false_for_current_week_at_sunday_2359():
    # Sunday 23:59 ET of week 11 — week 11 is still the current edition week
    instant = datetime(2025, 3, 16, 23, 59, 0, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_past_week(11, 2025) is False


def test_is_past_week_false_immediately_after_week_rolls_but_before_reveal():
    # Monday 00:01 ET — edition week has advanced to 12, but week 11's reveal
    # (Mon 09:00) has NOT happened yet. is_past_week requires BOTH conditions.
    instant = datetime(2025, 3, 17, 0, 1, 0, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_past_week(11, 2025) is False


def test_is_past_week_true_after_reveal_passes():
    # Monday 09:01 ET — week 11 is now prior and reveal has fired
    instant = datetime(2025, 3, 17, 9, 1, 0, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_past_week(11, 2025) is True


def test_year_boundary_week_one_of_next_year():
    # Sit just after Mon 09:00 ET on the Monday that opens ISO week 1 of 2026
    # (Mon 2025-12-29 starts ISO 2026-W01).
    instant = datetime(2025, 12, 29, 9, 5, 0, tzinfo=EASTERN)
    with _freeze(instant):
        week, year = get_edition_week()
        assert (week, year) == (1, 2026)
        # The last week of 2025 (week 52) is now revealed
        assert is_revealed(52, 2025) is True


# ---------------------------------------------------------------------------
# get_selectable_weeks — the missed/current/next picker source
# ---------------------------------------------------------------------------

def test_get_selectable_weeks_offers_missed_current_next():
    # Monday 09:01 AM ET = edition week 12 of 2025.
    instant = datetime(2025, 3, 17, 9, 1, 0, tzinfo=EASTERN)
    with _freeze(instant):
        weeks = get_selectable_weeks()

    assert [w["role"] for w in weeks] == ["missed", "current", "next"]
    by_role = {w["role"]: w for w in weeks}
    assert (by_role["missed"]["week_number"], by_role["missed"]["year"]) == (11, 2025)
    assert (by_role["current"]["week_number"], by_role["current"]["year"]) == (12, 2025)
    assert (by_role["next"]["week_number"], by_role["next"]["year"]) == (13, 2025)


def test_get_selectable_weeks_late_and_unlock_flags():
    instant = datetime(2025, 3, 17, 9, 1, 0, tzinfo=EASTERN)
    with _freeze(instant):
        by_role = {w["role"]: w for w in get_selectable_weeks()}

    # Only the prior (missed) week is past its deadline.
    assert by_role["missed"]["is_late"] is True
    assert by_role["current"]["is_late"] is False
    assert by_role["next"]["is_late"] is False
    # The Toll only unlocks the current week's feed.
    assert by_role["current"]["unlocks_feed"] is True
    assert by_role["missed"]["unlocks_feed"] is False
    assert by_role["next"]["unlocks_feed"] is False


def test_get_selectable_weeks_year_boundary():
    # Mon 2025-12-29 09:05 ET opens ISO week 1 of 2026; prior is week 52/2025.
    instant = datetime(2025, 12, 29, 9, 5, 0, tzinfo=EASTERN)
    with _freeze(instant):
        by_role = {w["role"]: w for w in get_selectable_weeks()}

    assert (by_role["missed"]["week_number"], by_role["missed"]["year"]) == (52, 2025)
    assert (by_role["current"]["week_number"], by_role["current"]["year"]) == (1, 2026)
    assert (by_role["next"]["week_number"], by_role["next"]["year"]) == (2, 2026)


def test_year_boundary_week_53_handled():
    # 2020 has an ISO week 53. Confirm get_reveal_for_week handles it without crashing
    # and produces a Monday 9 AM ET reveal.
    reveal = get_reveal_for_week(53, 2020)
    eastern_reveal = reveal.astimezone(EASTERN)
    assert eastern_reveal.weekday() == 0
    assert eastern_reveal.hour == 9
