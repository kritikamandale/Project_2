"""
Onboarding progression helpers.

The first-time USER flow is a strict linear sequence:
    not_started → questionnaire_done → scan_done → completed

Status is advance-only: an event that has already happened can never move a
user backwards, and "completed" is reserved for the point where a recommendation
has actually been generated and stored (Step 3), never set from the client.
"""

from __future__ import annotations

from app.models.user import User

# Ordered stages — index is the rank used for advance-only comparisons.
ONBOARDING_ORDER: list[str] = [
    "not_started",
    "questionnaire_done",
    "scan_done",
    "completed",
]

# Which onboarding route a user with a given status should be sent to, and the
# human step key the frontend renders. `completed` has no step — go to dashboard.
_STEP_FOR_STATUS: dict[str, tuple[str | None, str]] = {
    "not_started":        ("questionnaire",   "/onboarding/questionnaire"),
    "questionnaire_done": ("scan",            "/onboarding/scan"),
    "scan_done":          ("recommendations", "/onboarding/recommendations"),
    "completed":          (None,              "/dashboard"),
}


def rank(status: str) -> int:
    try:
        return ONBOARDING_ORDER.index(status)
    except ValueError:
        return 0


def current_step(status: str) -> str | None:
    return _STEP_FOR_STATUS.get(status, _STEP_FOR_STATUS["not_started"])[0]


def next_path(status: str) -> str:
    return _STEP_FOR_STATUS.get(status, _STEP_FOR_STATUS["not_started"])[1]


def advance_onboarding(user: User, to_status: str) -> bool:
    """
    Move the user forward to `to_status` if it's strictly ahead of where they are.
    Mutates the user in place (caller is responsible for committing). Returns
    True if the status changed. Dermatologist/Admin accounts are left untouched —
    the gated flow only applies to end users.
    """
    if user.role != "USER":
        return False
    if to_status not in ONBOARDING_ORDER:
        raise ValueError(f"Unknown onboarding status: {to_status}")
    if rank(to_status) > rank(user.onboarding_status):
        user.onboarding_status = to_status
        return True
    return False
