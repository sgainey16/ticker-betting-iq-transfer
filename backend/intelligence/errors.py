"""Typed exceptions for the Foundation 1A ingest pipeline."""


class FoundationError(Exception): ...


class AmbiguousTeamHint(FoundationError):
    """Provider hint cannot be resolved to a unique team (e.g. Sportradar
    'COL' alias without market disambiguation)."""


class AmbiguousGameHint(FoundationError):
    """More than one canonical game matches the natural key."""


class UnresolvedGameIdentity(FoundationError):
    """A postponement/reschedule cannot be safely matched to an existing
    canonical game AND positive evidence of a new game is absent.
    Human reconciliation required. Never auto-mint a fallback."""
