"""形态检测器基类"""

from abc import ABC, abstractmethod
from collections.abc import Sequence

from ..models.daily_bar import DailyBar


class PatternDetector(ABC):
    """所有形态检测器的抽象基类"""

    pattern_id: str
    pattern_name: str
    category: str
    direction: str  # bullish / bearish / neutral

    @abstractmethod
    def match(self, bars: Sequence[DailyBar]) -> bool:
        """给定日线序列，判断最新日是否触发该形态"""
        ...

    def describe(self) -> str:
        """返回该形态的白话解释"""
        return f"{self.pattern_name}（{self.pattern_id}）"

    def limitations(self) -> list[str]:
        """返回该形态的局限性提醒"""
        return []
