from .base import PatternDetector
from .registry import get, list_all, register
from . import detectors  # noqa: F401 — 触发检测器注册

__all__ = ["PatternDetector", "get", "list_all", "register"]
