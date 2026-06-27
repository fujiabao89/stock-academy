"""因子解析器测试"""

import pytest
from app.services.factor_parser import _extract_json, _validate_conditions, _generate_explanation


class TestExtractJson:
    def test_direct_json_array(self):
        result = _extract_json('[{"field":"ma5","operator":"gt","field2":"ma20"}]')
        assert len(result) == 1
        assert result[0]["field"] == "ma5"

    def test_json_with_markdown_wrapper(self):
        result = _extract_json("```json\n[{\"field\":\"ma5\",\"operator\":\"cross_above\",\"field2\":\"ma20\"}]\n```")
        assert len(result) == 1
        assert result[0]["operator"] == "cross_above"

    def test_empty_array(self):
        result = _extract_json("[]")
        assert result == []

    def test_invalid_json_raises(self):
        with pytest.raises(Exception):
            _extract_json("not json at all")

    def test_invalid_field_filtered(self):
        result = _extract_json('[{"field":"nonexistent","operator":"gt","value":1}]')
        assert len(result) == 0  # 无效字段被过滤


class TestValidateConditions:
    def test_valid_condition_passes(self):
        result = _validate_conditions([{"field": "ma5", "operator": "gt", "field2": "ma20"}])
        assert len(result) == 1

    def test_unknown_field_removed(self):
        result = _validate_conditions([{"field": "fantasy_field", "operator": "gt", "value": 1}])
        assert len(result) == 0

    def test_unknown_operator_removed(self):
        result = _validate_conditions([{"field": "ma5", "operator": "fantasy_op", "value": 1}])
        assert len(result) == 0

    def test_pattern_condition(self):
        result = _validate_conditions([{"field": "pattern", "operator": "pattern", "pattern_id": "hammer"}])
        assert len(result) == 1
        assert result[0]["pattern_id"] == "hammer"

    def test_invalid_pattern_id_removed(self):
        result = _validate_conditions([{"field": "pattern", "operator": "pattern", "pattern_id": "not-real"}])
        assert len(result) == 0

    def test_value_cast_to_float(self):
        result = _validate_conditions([{"field": "volume_ratio_20", "operator": "gt", "value": 2}])
        assert isinstance(result[0]["value"], float)
        assert result[0]["value"] == 2.0


class TestGenerateExplanation:
    def test_single_condition(self):
        expl = _generate_explanation([{"field": "ma5", "operator": "gt", "field2": "ma20"}])
        assert "ma5" in expl
        assert "ma20" in expl

    def test_multiple_conditions(self):
        expl = _generate_explanation([
            {"field": "ma5", "operator": "cross_above", "field2": "ma20"},
            {"field": "volume_ratio_20", "operator": "gt", "value": 1.5},
        ])
        assert "且" in expl

    def test_pattern_explanation(self):
        expl = _generate_explanation([{"field": "pattern", "operator": "pattern", "pattern_id": "hammer"}])
        assert "hammer" in expl

    def test_empty_conditions(self):
        expl = _generate_explanation([])
        assert "未能识别" in expl
