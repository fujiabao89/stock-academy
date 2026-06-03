import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";

interface PatternBrief {
  pattern_id: string;
  pattern_name: string;
  direction: string;
  category: string;
}

interface LatestStockSignal {
  code: string;
  stock_name: string;
  date: string;
  patterns: PatternBrief[];
}

export default function Home() {
  const [signals, setSignals] = useState<LatestStockSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/signals/latest")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setSignals(data); })
      .catch(() => { if (!cancelled) setSignals([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      {/* Hero */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "clamp(32px, 10vw, 80px)",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(24px, 8vw, 32px)",
            fontWeight: 700,
            letterSpacing: "-1px",
            marginBottom: "var(--space-2)",
          }}
        >
          <span style={{ color: "var(--color-primary)" }}>炒股</span>
          学堂
        </h1>
        <p
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 15,
            marginBottom: "var(--space-8)",
          }}
        >
          不推荐股票，只教判断方法
        </p>
        <SearchBar />
        <div
          style={{
            marginTop: "var(--space-8)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            justifyContent: "center",
            maxWidth: 500,
          }}
        >
          {[
            { code: "600519", name: "贵州茅台" },
            { code: "000001", name: "平安银行" },
            { code: "000333", name: "美的集团" },
            { code: "600900", name: "长江电力" },
            { code: "002594", name: "比亚迪" },
          ].map((s) => (
            <Link
              key={s.code}
              to={`/stock/${s.code}`}
              style={{
                fontSize: 13,
                padding: "12px 16px",
                display: "inline-flex",
                alignItems: "center",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text-secondary)",
                transition: "border-color 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary)";
                e.currentTarget.style.color = "var(--color-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              {s.name} {s.code}
            </Link>
          ))}
        </div>
      </div>

      {/* 今日值得关注 */}
      <section style={{ marginTop: "var(--space-12)", maxWidth: 900, marginInline: "auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "var(--space-3)",
            marginBottom: "var(--space-5)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)", margin: 0 }}>
            今日值得关注
          </h2>
          {!loading && signals.length > 0 && (
            <>
              <span style={{ fontSize: 13, color: "var(--color-muted)" }}>
                {signals[0]?.date}
              </span>
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                {signals.length} 只股票触发形态信号
              </span>
            </>
          )}
        </div>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "var(--space-10)",
              color: "var(--color-text-secondary)",
              fontSize: 14,
            }}
          >
            加载中...
          </div>
        ) : signals.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "var(--space-10)",
              color: "var(--color-text-secondary)",
              fontSize: 14,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
          >
            暂无明显形态信号
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            {signals.map((stock) => (
              <div
                key={stock.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "12px 16px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  transition: "border-color 0.2s",
                  flexWrap: "wrap",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
              >
                {/* 股票信息 */}
                <Link
                  to={`/stock/${stock.code}`}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--color-text)",
                    minWidth: 120,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: 36,
                    padding: "2px 0",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                >
                  {stock.stock_name}
                  <span style={{ fontSize: 12, color: "var(--color-muted)", marginLeft: 6, fontWeight: 400 }}>
                    {stock.code}
                  </span>
                </Link>

                {/* 形态标签 */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {stock.patterns.map((p) => {
                    const isBull = p.direction === "bullish";
                    return (
                      <Link
                        key={p.pattern_id}
                        to={`/learn/patterns/${p.pattern_id}`}
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          padding: "4px 10px",
                          borderRadius: "var(--radius-sm)",
                          background: isBull ? "var(--color-bullish-bg)" : "var(--color-bearish-bg)",
                          color: isBull ? "var(--color-bullish)" : "var(--color-bearish)",
                          border: `1px solid ${isBull ? "var(--color-bullish)" : "var(--color-bearish)"}`,
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: 28,
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        {p.pattern_name}
                        <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>
                          {isBull ? "↑" : "↓"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
