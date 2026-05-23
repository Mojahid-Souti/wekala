"""Loaders for Phase 8 policy YAMLs (hours_saved, anomalies).

Both files live alongside `classification.yaml` in `infra/policies/`. Same
WEKALA_*_POLICY_PATH env vars used for deployed containers.
"""

from __future__ import annotations

import fnmatch
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Final

import yaml


def _find_repo_policies_dir() -> Path:
    """Walk up from this file until we find an `infra/policies/` directory.

    Works in both layouts: host repo (apps/api/wekala/...) and slim container
    (/app/wekala/...). Falls back to a path that the resolver can detect as
    missing.
    """
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "infra" / "policies"
        if candidate.is_dir():
            return candidate
    # Sentinel — the resolver layer handles missing-file gracefully via env vars.
    return here.parent / "policies"


REPO_POLICIES_DIR: Final[Path] = _find_repo_policies_dir()


# ---------------------------------------------------------------------------
# Hours-saved
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _PatternRule:
    pattern: str
    minutes: int


@dataclass(frozen=True)
class HoursSavedPolicy:
    default_minutes: int
    by_pattern: tuple[_PatternRule, ...]
    by_agent_id: dict[str, int]

    def minutes_for(self, *, agent_id: str, agent_name: str) -> int:
        """First match wins: agent_id → name pattern → default."""
        if agent_id in self.by_agent_id:
            return self.by_agent_id[agent_id]
        for rule in self.by_pattern:
            if fnmatch.fnmatch(agent_name, rule.pattern):
                return rule.minutes
        return self.default_minutes


@lru_cache(maxsize=1)
def get_hours_saved_policy(path: Path | None = None) -> HoursSavedPolicy:
    src = _resolve_path(
        path, env_var="WEKALA_HOURS_SAVED_POLICY_PATH", default_name="hours_saved.yaml"
    )
    raw = yaml.safe_load(src.read_text(encoding="utf-8"))
    defaults = (raw or {}).get("defaults") or {}
    by_pattern_raw = (raw or {}).get("by_agent_name_pattern") or []
    by_id_raw = (raw or {}).get("by_agent_id") or {}
    return HoursSavedPolicy(
        default_minutes=int(defaults.get("per_invocation_minutes", 3)),
        by_pattern=tuple(
            _PatternRule(
                pattern=str(r.get("pattern", "*")),
                minutes=int(r.get("per_invocation_minutes", 0)),
            )
            for r in by_pattern_raw
        ),
        by_agent_id={k: int(v) for k, v in by_id_raw.items()},
    )


# ---------------------------------------------------------------------------
# Anomaly rules
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AnomalyRule:
    id: str
    metric: str
    kind: str  # 'zscore' | 'absolute'
    threshold: float
    baseline_days: int  # for zscore only
    min_sample_size: int
    severity: str  # info | low | medium | high | critical
    note: str


@dataclass(frozen=True)
class AnomalyPolicy:
    rules: tuple[AnomalyRule, ...]


@lru_cache(maxsize=1)
def get_anomaly_policy(path: Path | None = None) -> AnomalyPolicy:
    src = _resolve_path(path, env_var="WEKALA_ANOMALIES_POLICY_PATH", default_name="anomalies.yaml")
    raw = yaml.safe_load(src.read_text(encoding="utf-8"))
    return AnomalyPolicy(
        rules=tuple(
            AnomalyRule(
                id=str(r.get("id", "")),
                metric=str(r.get("metric", "")),
                kind=str(r.get("kind", "absolute")),
                threshold=float(r.get("threshold", 0.0)),
                baseline_days=int(r.get("baseline_days", 7)),
                min_sample_size=int(r.get("min_sample_size", 5)),
                severity=str(r.get("severity", "medium")),
                note=str(r.get("note", "")),
            )
            for r in (raw or {}).get("rules") or []
        )
    )


def _resolve_path(path: Path | None, *, env_var: str, default_name: str) -> Path:
    if path is not None:
        return Path(path)
    env_path = os.environ.get(env_var)
    if env_path:
        return Path(env_path)
    # Containers mount /policies → /policies/<default_name>; host → REPO_POLICIES_DIR/<default_name>
    container_path = Path("/policies") / default_name
    if container_path.exists():
        return container_path
    return REPO_POLICIES_DIR / default_name
