"""Edge-case unit tests for app.services.weeks.

Complements test_weeks.py with:
- DST spring-forward / fall-back boundaries (the Mon 09:00 ET reveal is local-
  time anchored, so it should ride DST without drifting)
- is_week_closed grace window (late posts accepted until current >= week+2)
- can_target_week — missed/current/next legality
- _shift_week year rollover
"""

from datetime import datetime
from unittest.mock import patch

from app.services import weeks as weeks_module
from app.services.weeks import (
    EASTERN,
    can_target_week,
    get_edition_week,
    get_reveal_for_week,
    is_week_closed,
    _shift_week,
)


class _FrozenDatetime(datetime):
    _frozen: datetime

    @classmethod
    def now(cls, tz=None):
        if tz is None:
            return cls._frozen.replace(tzinfo=None)
        return cls._frozen.astimezone(tz)


def _freeze(instant: datetime):
    frozen_cls = type("_Frozen", (_FrozenDatetime,), {"_frozen": instant})
    return patch.object(weeks_module, "datetime", frozen_cls)


# ---------------------------------------------------------------------------
# DST — the reveal is anchored to local Eastern wall-clock, not UTC offset
# ---------------------------------------------------------------------------

def test_reveal_during_dst_spring_forward_week():
    # 2025 DST starts Sun Mar 9. The following Monday is Mar 10. The reveal for
    # ISO week 10 (the week containing Mar 3-9) fires Mon Mar 10 09:00 ET — still
    # 09:00 wall-clock even though UTC offset shifted from -05:00 to -04:00.
    reveal = get_reveal_for_week(10, 2025).astimezone(EASTERN)
    assert reveal.hour == 9
    assert reveal.month == 3 and reveal.day == 10
    assert reveal.utcoffset().total_seconds() == -4 * 3600  # EDT


def test_reveal_during_dst_fall_back_week():
    # 2025 DST ends Sun Nov 2. The reveal for ISO week 44 fires Mon Nov 3 09:00 ET.
    reveal = get_reveal_for_week(44, 2025).astimezone(EASTERN)
    assert reveal.hour == 9
    assert reveal.month == 11 and reveal.day == 3
    assert reveal.utcoffset().total_seconds() == -5 * 3600  # EST


def test_edition_week_during_dst_spring_forward_morning():
    # Mon 2025-03-10 09:01 EDT — past the cutoff, should roll into week 11.
    instant = datetime(2025, 3, 10, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert get_edition_week() == (11, 2025)


def test_edition_week_during_dst_spring_forward_just_before_cutoff():
    # Mon 2025-03-10 08:59 EDT — still week 10 (cutoff is 09:00 local).
    instant = datetime(2025, 3, 10, 8, 59, tzinfo=EASTERN)
    with _freeze(instant):
        assert get_edition_week() == (10, 2025)


# ---------------------------------------------------------------------------
# is_week_closed — grace window (closed once current >= week + 2)
# ---------------------------------------------------------------------------

def test_is_week_closed_current_week_not_closed():
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)  # week 12
    with _freeze(instant):
        assert is_week_closed(12, 2025) is False


def test_is_week_closed_prior_week_in_grace_not_closed():
    # Now = week 12; week 11 is the prior week. shift(+2) of week 11 = week 13.
    # Closed only when current_week >= 13, so week 11 is NOT closed at week 12.
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_week_closed(11, 2025) is False


def test_is_week_closed_two_weeks_back_is_closed():
    # Now = week 13; week 11 + 2 = week 13. current >= closed_week ⇒ closed.
    instant = datetime(2025, 3, 24, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_week_closed(11, 2025) is True


def test_is_week_closed_far_past_year_is_closed():
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_week_closed(1, 2020) is True


# ---------------------------------------------------------------------------
# can_target_week — what the picker is allowed to offer
# ---------------------------------------------------------------------------

def test_can_target_current_week():
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)  # week 12
    with _freeze(instant):
        assert can_target_week(12, 2025) is True


def test_can_target_next_week():
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert can_target_week(13, 2025) is True


def test_can_target_prior_week_while_in_grace():
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert can_target_week(11, 2025) is True


def test_cannot_target_prior_week_after_close():
    # Now = week 13; week 11 is closed (current >= 11+2).
    instant = datetime(2025, 3, 24, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert can_target_week(11, 2025) is False


def test_cannot_target_two_weeks_in_the_future():
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert can_target_week(14, 2025) is False


def test_cannot_target_arbitrary_past_week():
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert can_target_week(5, 2025) is False


# ---------------------------------------------------------------------------
# _shift_week — year rollover correctness
# ---------------------------------------------------------------------------

def test_shift_week_forward_across_year_boundary():
    # ISO 2025-W52 + 1 week = ISO 2026-W01 (Mon 2025-12-29 starts ISO 2026).
    assert _shift_week(52, 2025, 1) == (1, 2026)


def test_shift_week_backward_across_year_boundary():
    assert _shift_week(1, 2026, -1) == (52, 2025)


def test_shift_week_within_year():
    assert _shift_week(10, 2025, 3) == (13, 2025)


def test_shift_week_handles_53_week_year():
    # 2020 has ISO week 53. Shifting forward into 2021 should land on W01/2021.
    assert _shift_week(53, 2020, 1) == (1, 2021)
