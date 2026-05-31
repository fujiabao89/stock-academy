"""形态检测器注册表"""

from .base import PatternDetector

_registry: dict[str, PatternDetector] = {}


def register(detector: PatternDetector):
    _registry[detector.pattern_id] = detector


def get(pattern_id: str) -> PatternDetector | None:
    return _registry.get(pattern_id)


def list_all() -> dict[str, PatternDetector]:
    return dict(_registry)
