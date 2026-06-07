import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ConfidenceBadge from "../components/ConfidenceBadge";
import { SkeletonCard } from "../components/Skeleton";

interface PatternSummary {
  pattern_id: string;
  pattern_name: string;
  category: string;
  direction: string;
  description: string;
  win_rate_20d: number | null;
  related_count: number;
  confidence_grade: string | null;
}

const DIRECTION_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  bullish: { text: "看涨", color: "var(--color-bullish)", bg: "var(--color-bullish-bg)" },
  bearish: { text: "看跌", color: "var(--color-bearish)", bg: "var(--color-bearish-bg)" },
  neutral: { text: "中性", color: "var(--color-muted)", bg: "var(--color-surface-hover)" },
};

const CATEGORY_NAMES: Record<string, string> = {
  "K线形态": "K线蜡烛图形态",
  "均线": "均线类形态",
  "量价": "量价类形态",
};

export default function Learn() {
  const [patterns, setPatterns] = useState<PatternSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/patterns")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => { if (!cancelled) setPatterns(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, PatternSummary[]>();
    for (const p of patterns) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [patterns]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
        <p style={{ color: "var(--color-destructive)", marginBottom: "var(--space-4)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>{error}</p>
        <Link to="/" style={{ color: "var(--color-primary)", fontSize: 14 }}>← 返回首页</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{
        marginBottom: "var(--space-6)",
        fontSize: 13,
        color: "var(--color-text-secondary)",
        fontFamily: "Inter, var(--font-sans)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}>
        <Link to="/" style={{ color: "var(--color-muted)", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-muted)")}>
          首页
        </Link>
        <span style={{ color: "var(--color-border)" }}>/</span>
        <span style={{ color: "var(--color-text)", fontWeight: 500 }}>学堂</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 style={{
          fontSize: "clamp(22px, 3vw, 32px)",
          fontWeight: 700,
          color: "var(--color-text)",
          margin: "0 0 var(--space-3) 0",
          fontFamily: "Inter, var(--font-sans)",
          letterSpacing: "-0.01em",
        }}>
          形态教学
        </h1>
        <p style={{
          fontSize: 15,
          color: "var(--color-text-secondary)",
          lineHeight: 1.7,
          margin: 0,
          maxWidth: 640,
          fontFamily: "Inter, var(--font-sans)",
        }}>
          每种技术形态都有其判定逻辑和历史回测数据。理解形态的原理和局限性，比记住结论更重要。
        </p>
      </div>

      {/* Category sections */}
      {(["K线形态", "均线", "量价"] as const).map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: "var(--space-10)" }}>
            <h2 style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "Inter, var(--font-sans)",
              color: "var(--color-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 var(--space-4) 0",
              paddingBottom: "var(--space-2)",
              borderBottom: "1px solid var(--color-border)",
            }}>
              {CATEGORY_NAMES[cat] ?? cat}
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
              gap: "var(--space-3)",
            }}>
              {items.map((p) => {
                const dir = DIRECTION_LABELS[p.direction];
                return (
                  <Link
                    key={p.pattern_id}
                    to={`/learn/patterns/${p.pattern_id}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "var(--space-5)",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      transition: "border-color 0.15s, background 0.15s",
                      textDecoration: "none",
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
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)", fontFamily: "Inter, var(--font-sans)" }}>
                        {p.pattern_name}
                      </span>
                      {dir && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "Inter, var(--font-sans)",
                          color: dir.color,
                          background: dir.bg,
                          padding: "2px 8px",
                          borderRadius: "var(--radius-sm)",
                          border: `1px solid ${dir.color}`,
                        }}>
                          {dir.text}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto" }}>
                        <ConfidenceBadge grade={p.confidence_grade} />
                      </span>
                    </div>
                    <p style={{
                      fontSize: 13,
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.6,
                      margin: "0 0 var(--space-3) 0",
                      fontFamily: "Inter, var(--font-sans)",
                      flex: 1,
                    }}>
                      {p.description.length > 80 ? p.description.slice(0, 80) + "..." : p.description}
                    </p>
                    {p.related_count > 0 && (
                      <div style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-muted)",
                        padding: "var(--space-1) var(--space-2)",
                        background: "var(--color-bg)",
                        borderRadius: "var(--radius-sm)",
                        alignSelf: "flex-start",
                      }}>
                        {p.related_count} 关联
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
      <div style={{
        marginTop: "var(--space-2)",
        padding: "var(--space-6)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-4)",
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", marginBottom: 4, fontFamily: "Inter, var(--font-sans)" }}>
            术语词典
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontFamily: "Inter, var(--font-sans)" }}>
            K线、均线、MACD…… 查阅术语的通俗解释
          </div>
        </div>
        <Link
          to="/learn/glossary"
          style={{
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "Inter, var(--font-sans)",
            color: "var(--color-bg)",
            background: "var(--color-primary)",
            padding: "10px 20px",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
            transition: "opacity 0.15s",
            display: "inline-flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          查看词典 →
        </Link>
      </div>
    </div>
  );
}
