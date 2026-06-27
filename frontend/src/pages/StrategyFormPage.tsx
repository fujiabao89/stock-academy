import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Strategy, StrategyCondition } from "../components/StrategyCard";
import BacktestResult from "../components/BacktestResult";

const FIELD_OPTIONS = [
  { value: "open", label: "开盘价" },
  { value: "high", label: "最高价" },
  { value: "low", label: "最低价" },
  { value: "close", label: "收盘价" },
  { value: "volume", label: "成交量" },
  { value: "ma5", label: "MA5" },
  { value: "ma20", label: "MA20" },
  { value: "ma60", label: "MA60" },
  { value: "ma120", label: "MA120" },
  { value: "volume_ratio_20", label: "量比(20日)" },
  { value: "high_20", label: "20日最高" },
  { value: "price_range_20", label: "20日均振幅" },
  { value: "pattern", label: "形态" },
];

const OP_OPTIONS = [
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "eq", label: "=" },
  { value: "cross_above", label: "上穿" },
  { value: "cross_below", label: "下穿" },
  { value: "pattern", label: "形态匹配" },
];

const KNOWN_PATTERNS = [
  "golden-cross", "death-cross", "ma-bullish-alignment", "ma-bearish-alignment",
  "volume-up-price-up", "volume-up-price-down", "ma-convergence-breakout",
  "volume-price-divergence", "hammer", "inverted-hammer",
  "bullish-engulfing", "bearish-engulfing", "doji", "shooting-star",
];

function emptyCondition(): StrategyCondition {
  return { field: "ma5", operator: "gt", value: null, field2: null, pattern_id: null };
}

export default function StrategyFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [conditions, setConditions] = useState<StrategyCondition[]>([emptyCondition()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(!isEdit);

  // NL 输入
  const [nlText, setNlText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseExplanation, setParseExplanation] = useState("");

  // 回测
  const [backtestTaskId, setBacktestTaskId] = useState<number | null>(null);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [backtesting, setBacktesting] = useState(false);
  const [backtestError, setBacktestError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/strategies/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("策略不存在");
        return r.json();
      })
      .then((s: Strategy) => {
        setName(s.name);
        setDescription(s.description);
        setEnabled(s.enabled);
        setConditions(
          s.conditions.length > 0
            ? s.conditions.map((c) => ({ ...emptyCondition(), ...c }))
            : [emptyCondition()]
        );
        setLoaded(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
        setLoaded(true);
      });
  }, [id]);

  if (!loaded) {
    return (
      <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-secondary)" }}>
        加载中...
      </div>
    );
  }

  const updateCond = (i: number, patch: Partial<StrategyCondition>) => {
    setConditions((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  };

  const addCond = () => setConditions((prev) => [...prev, emptyCondition()]);
  const rmCond = (i: number) => {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, j) => j !== i));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("请输入策略名称");
      return;
    }
    setSubmitting(true);
    setError("");

    const body = { name, description, enabled, conditions };
    const token = localStorage.getItem("stock_academy_tokens");
    const access = token ? JSON.parse(token).access : "";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    };

    const url = isEdit ? `/api/strategies/${id}` : "/api/strategies";
    const method = isEdit ? "PUT" : "POST";

    try {
      const r = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error?.detail ?? "保存失败");
      }
      const saved = await r.json();
      navigate(`/strategies/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const showField2 = (cond: StrategyCondition) =>
    ["gt", "lt", "eq", "cross_above", "cross_below"].includes(cond.operator);
  const showValue = (cond: StrategyCondition) =>
    ["gt", "lt", "eq"].includes(cond.operator) && !cond.field2;
  const showPattern = (cond: StrategyCondition) => cond.field === "pattern" || cond.operator === "pattern";

  // ── NL 解析 ──
  const handleParse = async () => {
    if (!nlText.trim()) return;
    setParsing(true);
    setError("");
    try {
      const r = await fetch("/api/strategies/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlText }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error?.detail || "解析失败");
      if (data.conditions && data.conditions.length > 0) {
        setConditions(data.conditions.map((c: any) => ({ ...emptyCondition(), ...c })));
      }
      setParseExplanation(data.explanation || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败");
    } finally {
      setParsing(false);
    }
  };

  // ── 回测 ──
  const handleBacktest = async () => {
    setBacktesting(true);
    setBacktestError("");
    setBacktestResult(null);
    try {
      const r = await fetch("/api/strategies/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions, forward_days: 20 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "提交回测失败");
      setBacktestTaskId(data.task_id);
      // 轮询
      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`/api/strategies/backtest/${data.task_id}`);
          const pd = await pr.json();
          if (pd.status === "done") {
            clearInterval(poll);
            setBacktestResult(pd.result);
            setBacktesting(false);
          } else if (pd.status === "error") {
            clearInterval(poll);
            setBacktestError(pd.error_message || "回测失败");
            setBacktesting(false);
          }
        } catch {
          // 继续轮询
        }
      }, 2000);
    } catch (err) {
      setBacktestError(err instanceof Error ? err.message : "回测失败");
      setBacktesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 var(--space-6) 0" }}>
        {isEdit ? "编辑策略" : "新建策略"}
      </h1>

      {error && (
        <div style={{
          padding: "var(--space-3)", marginBottom: "var(--space-4)",
          background: "var(--color-bearish-bg)", color: "var(--color-bearish)",
          borderRadius: "var(--radius-sm)", fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: "var(--space-4)" }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: "var(--space-1)" }}>
          策略名称 *
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          style={{
            width: "100%", padding: "6px 10px", fontSize: 14,
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)", color: "var(--color-text)",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ marginBottom: "var(--space-4)" }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: "var(--space-1)" }}>
          描述
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
          style={{
            width: "100%", padding: "6px 10px", fontSize: 14,
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)", color: "var(--color-text)",
            boxSizing: "border-box", resize: "vertical",
          }}
        />
      </div>

      <div style={{ marginBottom: "var(--space-4)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          启用策略
        </label>
      </div>

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 var(--space-3) 0" }}>
          条件列表（AND 逻辑）
        </h2>

        {conditions.map((cond, i) => (
          <div
            key={i}
            style={{
              padding: "var(--space-3)", marginBottom: "var(--space-2)",
              border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)", position: "relative",
            }}
          >
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
              {cond.field !== "pattern" && (
                <select
                  value={cond.field}
                  onChange={(e) => updateCond(i, { field: e.target.value })}
                  style={selectStyle}
                >
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              )}
              <select
                value={cond.operator}
                onChange={(e) => updateCond(i, { operator: e.target.value })}
                style={selectStyle}
              >
                {OP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {showField2(cond) && (
                <select
                  value={cond.field2 ?? ""}
                  onChange={(e) => updateCond(i, { field2: e.target.value || null })}
                  style={selectStyle}
                >
                  <option value="">-- 选择 --</option>
                  {FIELD_OPTIONS.filter((f) => f.value !== "pattern").map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              )}
              {showValue(cond) && (
                <input
                  type="number"
                  value={cond.value ?? ""}
                  onChange={(e) => updateCond(i, { value: e.target.value ? Number(e.target.value) : null })}
                  placeholder="阈值"
                  style={{ ...selectStyle, width: 80 }}
                />
              )}
              {showPattern(cond) && (
                <select
                  value={cond.pattern_id ?? ""}
                  onChange={(e) => updateCond(i, { pattern_id: e.target.value || null })}
                  style={selectStyle}
                >
                  <option value="">-- 选择形态 --</option>
                  {KNOWN_PATTERNS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
            </div>
            {conditions.length > 1 && (
              <button
                onClick={() => rmCond(i)}
                style={{
                  position: "absolute", top: 8, right: 8,
                  background: "none", border: "none", color: "var(--color-bearish)",
                  cursor: "pointer", fontSize: 12, padding: "2px 6px",
                }}
              >
                移除
              </button>
            )}
          </div>
        ))}

        {conditions.length < 10 && (
          <button
            onClick={addCond}
            style={{
              fontSize: 13, color: "var(--color-primary)", background: "none",
              border: "1px dashed var(--color-primary)", borderRadius: "var(--radius-sm)",
              padding: "4px 12px", cursor: "pointer", width: "100%",
            }}
          >
            + 添加条件
          </button>
        )}
      </section>

      {/* ── 自然语言输入 ── */}
      <section style={{ marginBottom: "var(--space-6)", padding: "var(--space-4)", background: "color-mix(in srgb, var(--color-primary) 5%, transparent)", borderRadius: "var(--radius-md)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 var(--space-2) 0" }}>
          快捷输入（AI 解析）
        </h2>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <input
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleParse()}
            placeholder="描述你的策略，如：MA5上穿MA20且放量"
            maxLength={500}
            style={{
              flex: 1, padding: "6px 10px", fontSize: 14,
              border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)", color: "var(--color-text)",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleParse}
            disabled={parsing || !nlText.trim()}
            style={{
              padding: "6px 16px", fontSize: 13, fontWeight: 500,
              color: "#fff", background: "var(--color-primary)",
              border: "none", borderRadius: "var(--radius-sm)",
              cursor: parsing ? "wait" : "pointer",
              opacity: parsing || !nlText.trim() ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {parsing ? "解析中..." : "解析"}
          </button>
        </div>
        {parseExplanation && (
          <div style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--color-text-secondary)" }}>
            解析结果：{parseExplanation}
          </div>
        )}
      </section>

      {/* ── 回测 + 结果 ── */}
      <section style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <button
            onClick={handleBacktest}
            disabled={backtesting || conditions.length === 0}
            style={{
              padding: "6px 16px", fontSize: 13, fontWeight: 500,
              color: "#fff", background: backtesting ? "var(--color-text-secondary)" : "#059669",
              border: "none", borderRadius: "var(--radius-sm)",
              cursor: backtesting ? "wait" : "pointer",
              opacity: backtesting || conditions.length === 0 ? 0.6 : 1,
            }}
          >
            {backtesting ? "回测中..." : "运行回测"}
          </button>
          {backtestError && (
            <span style={{ fontSize: 13, color: "var(--color-bearish)" }}>{backtestError}</span>
          )}
        </div>
        {backtestResult && <BacktestResult result={backtestResult} />}
      </section>

      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "8px 20px", fontSize: 14, background: "none",
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
            color: "var(--color-text-secondary)", cursor: "pointer",
          }}
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: "8px 20px", fontSize: 14, fontWeight: 500,
            color: "#fff", background: "var(--color-primary)",
            border: "none", borderRadius: "var(--radius-sm)",
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "保存中..." : isEdit ? "保存修改" : "创建策略"}
        </button>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 13,
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};
