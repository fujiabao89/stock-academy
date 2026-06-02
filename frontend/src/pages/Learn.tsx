import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface PatternSummary {
  pattern_id: string;
  pattern_name: string;
  category: string;
  direction: string;
  description: string;
  win_rate_20d: number | null;
  related_count: number;
}

const DIRECTION_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  bullish: { text: "看涨", color: "var(--color-bullish)", bg: "var(--color-bullish-bg)" },
  bearish: { text: "看跌", color: "var(--color-bearish)", bg: "var(--color-bearish-bg)" },
};

const CATEGORY_NAMES: Record<string, string> = {
  "均线": "均线类形态",
  "量价": "量价类形态",
};

export default function Learn() {
  const [patterns, setPatterns] = useState<PatternSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/patterns")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setPatterns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--color-text-secondary)" }}>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
        <p style={{ color: "var(--color-bearish)", marginBottom: "var(--space-4)" }}>{error}</p>
        <Link to="/" style={{ color: "var(--color-primary)", fontSize: 14 }}>← 返回首页</Link>
      </div>
    );
  }

  const grouped = new Map<string, PatternSummary[]>();
  for (const p of patterns) {
    const list = grouped.get(p.category) ?? [];
    list.push(p);
    grouped.set(p.category, list);
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "var(--space-5)", fontSize: 14, color: "var(--color-text-secondary)" }}>
        <Link to="/" style={{ color: "var(--color-text-secondary)", display: "inline-flex", alignItems: "center", minHeight: 44 }}>
          首页
        </Link>
        <span style={{ margin: "0 var(--space-2)" }}>/</span>
        <span style={{ color: "var(--color-text)" }}>学堂</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "clamp(20px, 3vw, 24px)", fontWeight: 700, color: "var(--color-text)", margin: "0 0 var(--space-3) 0" }}>
          形态教学
        </h1>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0, maxWidth: 640 }}>
          每种技术形态都有其判定逻辑和历史回测数据。理解形态的原理和局限性，比记住结论更重要。
        </p>
      </div>

      {/* Category sections */}
      {(["均线", "量价"] as const).map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: "var(--space-8)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", margin: "0 0 var(--space-4) 0" }}>
              {CATEGORY_NAMES[cat] ?? cat}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
                gap: "var(--space-4)",
              }}
            >
              {items.map((p) => {
                const dir = DIRECTION_LABELS[p.direction];
                return (
                  <Link
                    key={p.pattern_id}
                    to={`/learn/patterns/${p.pattern_id}`}
                    style={{
                      display: "block",
                      padding: "var(--space-5)",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      transition: "border-color 0.2s, background 0.2s",
                      cursor: "pointer",
                      minHeight: 44,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-primary)";
                      e.currentTarget.style.background = "var(--color-surface-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-border)";
                      e.currentTarget.style.background = "var(--color-surface)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>
                        {p.pattern_name}
                      </span>
                      {dir && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: dir.color,
                            background: dir.bg,
                            padding: "2px 8px",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          {dir.text}
                        </span>
                      )}
                      {p.win_rate_20d != null && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: "var(--color-bullish)",
                            background: "var(--color-bullish-bg)",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-sm)",
                            marginLeft: "auto",
                          }}
                        >
                          {(p.win_rate_20d * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                      {p.description.length > 80 ? p.description.slice(0, 80) + "..." : p.description}
                    </p>
                    {p.related_count > 0 && (
                      <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: "var(--space-3)" }}>
                        {p.related_count} 个关联形态
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Glossary link */}
      <div
        style={{
          marginTop: "var(--space-6)",
          padding: "var(--space-5)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>术语词典</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>K线、均线、MACD…… 查阅术语的通俗解释</div>
        </div>
        <Link
          to="/learn/glossary"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--color-primary)",
            padding: "8px 16px",
            border: "1px solid var(--color-primary)",
            borderRadius: "var(--radius-sm)",
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            transition: "background 0.15s",
          }}
        >
          查看词典 →
        </Link>
      </div>
    </div>
  );
}
