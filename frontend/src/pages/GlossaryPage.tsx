import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";

interface GlossaryTerm {
  term: string;
  aliases: string[];
  category: string;
  content: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "基础概念": "var(--color-primary)",
  "技术指标": "var(--color-accent)",
  "K线形态": "var(--color-bullish)",
  "交易术语": "#F97316",
  "基本面": "#EC4899",
};

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = setTimeout(() => {
      fetch(`/api/glossary?q=${encodeURIComponent(query)}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(setTerms)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>();
    for (const t of terms) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return map;
  }, [terms]);

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "var(--space-5)", fontSize: 14, color: "var(--color-text-secondary)" }}>
        <Link to="/" style={{ color: "var(--color-text-secondary)", display: "inline-flex", alignItems: "center", minHeight: 44 }}>
          首页
        </Link>
        <span style={{ margin: "0 var(--space-2)" }}>/</span>
        <Link to="/learn" style={{ color: "var(--color-text-secondary)", display: "inline-flex", alignItems: "center", minHeight: 44 }}>
          学堂
        </Link>
        <span style={{ margin: "0 var(--space-2)" }}>/</span>
        <span style={{ color: "var(--color-text)" }}>术语词典</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "clamp(20px, 3vw, 24px)", fontWeight: 700, color: "var(--color-text)", margin: "0 0 var(--space-3) 0" }}>
          术语词典
        </h1>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0, maxWidth: 640 }}>
          收录技术分析、交易、基本面相关的常用术语，帮助你更好地理解形态信号和指标含义。
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setLoading(true); }}
          placeholder="搜索术语（如：均线、MACD、背离...）"
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "10px 16px",
            fontSize: 14,
            color: "var(--color-text)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            outline: "none",
            transition: "border-color 0.15s",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
        />
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--color-text-secondary)" }}>
          加载中...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--color-bearish)" }}>
          {error}
        </div>
      ) : terms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--color-text-secondary)", fontSize: 14 }}>
          未找到匹配的术语
        </div>
      ) : (
        <div>
          {[...grouped.entries()].map(([category, items]) => (
            <div key={category} style={{ marginBottom: "var(--space-6)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: CATEGORY_COLORS[category] ?? "var(--color-muted)",
                  }}
                />
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)", margin: 0 }}>
                  {category}
                </h2>
                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>({items.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {items.map((t) => (
                  <div
                    key={t.term}
                    style={{
                      padding: "var(--space-5)",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>
                        {t.term}
                      </span>
                      {t.aliases.filter((a) => a !== t.term.toLowerCase()).slice(0, 3).map((a) => (
                        <span
                          key={a}
                          style={{
                            fontSize: 11,
                            color: "var(--color-muted)",
                            background: "var(--color-accent-bg)",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0 }}>
                      {t.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
