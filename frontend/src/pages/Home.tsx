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

const HOT_STOCKS = [
  { code: "600519", name: "贵州茅台" },
  { code: "000001", name: "平安银行" },
  { code: "000333", name: "美的集团" },
  { code: "600900", name: "长江电力" },
  { code: "002594", name: "比亚迪" },
];

const SECTORS = [
  { name: "半导体", change: "+4.5%", bullish: true, colSpan: 2, rowSpan: 2 },
  { name: "通信", change: "+2.1%", bullish: true },
  { name: "银行", change: "-1.2%", bullish: false },
  { name: "消费", change: "+0.8%", bullish: true, rowSpan: 2 },
  { name: "地产", change: "-3.4%", bullish: false },
  { name: "其他", change: "", bullish: false, colSpan: 2 },
];

export default function Home() {
  const [signals, setSignals] = useState<LatestStockSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "bullish">("all");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/signals/latest")
      .then((r) => {
        if (!r.ok) throw new Error(`服务器错误 (${r.status})`);
        return r.json();
      })
      .then((data) => { if (!cancelled) setSignals(data); })
      .catch((e) => { if (!cancelled) setError(e.message || "加载失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredSignals = filter === "bullish"
    ? signals.filter((s) => s.patterns.some((p) => p.direction === "bullish"))
    : signals;

  const displayedSignals = showAll ? filteredSignals : filteredSignals.slice(0, 10);

  return (
    <div>
      {/* ====== Hero: Terminal Grid ====== */}
      <section
        style={{
          marginLeft: "calc(-1 * var(--main-padding-x))",
          marginRight: "calc(-1 * var(--main-padding-x))",
          marginTop: "calc(-1 * var(--main-padding-y))",
          marginBottom: "var(--space-8)",
          padding: "clamp(48px, 8vw, 72px) var(--main-padding-x)",
          borderBottom: "1px solid var(--color-border)",
          position: "relative",
          overflow: "hidden",
          backgroundImage: `
            linear-gradient(rgba(83,68,52,0.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83,68,52,0.18) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          backgroundPosition: "center",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <h1 style={{
            fontSize: "clamp(28px, 8vw, 48px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: "var(--space-3)",
            fontFamily: "Inter, var(--font-sans)",
            lineHeight: 1.15,
            color: "var(--color-text)",
          }}>
            洞察先机，量化学习
          </h1>
          <p style={{
            color: "var(--color-text-secondary)",
            fontSize: "clamp(14px, 2vw, 16px)",
            marginBottom: "var(--space-6)",
            fontFamily: "Inter, var(--font-sans)",
          }}>
            不推荐股票，只教判断方法
          </p>

          {/* Search + CTA */}
          <div style={{ maxWidth: 560, margin: "0 auto var(--space-5)" }}>
            <SearchBar />
          </div>

          {/* 热门检索 — inline text links */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            gap: "var(--space-3)",
            fontSize: 13,
            fontFamily: "Inter, var(--font-sans)",
          }}>
            <span style={{ color: "var(--color-text-secondary)", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              热门检索:
            </span>
            {HOT_STOCKS.map((s) => (
              <Link
                key={s.code}
                to={`/stock/${s.code}`}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--color-primary)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {s.name} {s.code}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Dashboard: 12 列网格 ====== */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 300px",
        gap: "var(--space-5)",
        alignItems: "start",
      }}>
        {/* ====== 左栏: 信号表格 ====== */}
        <div style={{
          minWidth: 0,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}>
          {/* Table header */}
          <div style={{
            padding: "var(--space-3) var(--space-5)",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface-hover)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-2)",
          }}>
            <h2 style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text)",
              margin: 0,
              fontFamily: "Inter, var(--font-sans)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}>
              <span style={{ color: "var(--color-primary)", fontSize: 18 }}>&#9670;</span>
              今日值得关注
            </h2>

            {/* Filter toggles */}
            {!loading && signals.length > 0 && (
              <div style={{ display: "flex", gap: "var(--space-1)" }}>
                <button
                  onClick={() => { setFilter("all"); setShowAll(false); }}
                  style={{
                    padding: "3px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "Inter, var(--font-sans)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: filter === "all" ? "var(--color-surface-hover)" : "transparent",
                    color: filter === "all" ? "var(--color-text)" : "var(--color-text-secondary)",
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  全部信号
                </button>
                <button
                  onClick={() => { setFilter("bullish"); setShowAll(false); }}
                  style={{
                    padding: "3px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "Inter, var(--font-sans)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: filter === "bullish" ? "var(--color-bullish-bg)" : "transparent",
                    color: filter === "bullish" ? "var(--color-bullish)" : "var(--color-text-secondary)",
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  只看涨
                </button>
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ padding: "var(--space-6)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {["股票名称", "形态标签", "操作"].map((h) => (
                      <th key={h} style={{
                        padding: "var(--space-3) var(--space-5)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--color-muted)",
                        fontFamily: "Inter, var(--font-sans)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: h === "操作" ? "right" : "left",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4].map((i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(83,68,52,0.15)" }}>
                      <td style={{ padding: "var(--space-3) var(--space-5)" }}>
                        <div style={{ height: 16, width: 80, borderRadius: 4, background: "var(--color-surface-hover)", marginBottom: 4 }} />
                        <div style={{ height: 10, width: 60, borderRadius: 3, background: "var(--color-surface-hover)" }} />
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-5)" }}>
                        <div style={{ height: 20, width: 90, borderRadius: 4, background: "var(--color-surface-hover)" }} />
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-5)", textAlign: "right" }}>
                        <div style={{ height: 14, width: 40, borderRadius: 3, background: "var(--color-surface-hover)", marginLeft: "auto" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{
              padding: "var(--space-8) var(--space-5)",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-destructive)",
                fontFamily: "Inter, var(--font-sans)",
                marginBottom: "var(--space-3)",
              }}>
                数据获取失败
              </div>
              <div style={{
                fontSize: 13,
                color: "var(--color-text-secondary)",
                fontFamily: "Inter, var(--font-sans)",
                marginBottom: "var(--space-4)",
              }}>
                {error}
              </div>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "6px 20px",
                  background: "var(--color-primary)",
                  color: "var(--color-bg)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "Inter, var(--font-sans)",
                }}
              >
                重试
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filteredSignals.length === 0 && signals.length > 0 && (
            <div style={{
              padding: "var(--space-10) var(--space-5)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 14, color: "var(--color-muted)", fontFamily: "Inter, var(--font-sans)", marginBottom: "var(--space-1)" }}>
                当前没有看涨信号
              </div>
              <button
                onClick={() => setFilter("all")}
                style={{
                  padding: "4px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "Inter, var(--font-sans)",
                  color: "var(--color-primary)",
                  background: "transparent",
                  border: "1px solid var(--color-primary)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                显示全部信号
              </button>
            </div>
          )}

          {/* Table */}
          {!loading && !error && filteredSignals.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {["股票名称", "形态标签", "操作"].map((h) => (
                      <th key={h} style={{
                        padding: "var(--space-3) var(--space-5)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--color-muted)",
                        fontFamily: "Inter, var(--font-sans)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        textAlign: h === "操作" ? "right" : "left",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedSignals.map((stock) => (
                    <tr
                      key={stock.code}
                      style={{
                        borderBottom: "1px solid rgba(83,68,52,0.15)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "var(--space-3) var(--space-5)" }}>
                        <Link
                          to={`/stock/${stock.code}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", fontFamily: "Inter, var(--font-sans)", marginBottom: 1 }}>
                            {stock.stock_name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                            {stock.code}
                          </div>
                        </Link>
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-5)" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {stock.patterns.map((p) => {
                            const isBull = p.direction === "bullish";
                            return (
                              <Link
                                key={p.pattern_id}
                                to={`/learn/patterns/${p.pattern_id}`}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  fontFamily: "Inter, var(--font-sans)",
                                  padding: "2px 8px",
                                  borderRadius: "var(--radius-sm)",
                                  background: isBull ? "var(--color-bullish-bg)" : "var(--color-bearish-bg)",
                                  color: isBull ? "var(--color-bullish)" : "var(--color-bearish)",
                                  border: `1px solid ${isBull ? "var(--color-bullish-container)" : "var(--color-bearish-container)"}`,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  textDecoration: "none",
                                  transition: "opacity 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                              >
                                <span style={{ fontSize: 10 }}>{isBull ? "↑" : "↓"}</span>
                                {p.pattern_name}
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-5)", textAlign: "right" }}>
                        <Link
                          to={`/stock/${stock.code}`}
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: "Inter, var(--font-sans)",
                            color: "var(--color-primary)",
                            textDecoration: "none",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 查看全部 */}
          {!loading && !error && !showAll && filteredSignals.length > 10 && (
            <div style={{
              textAlign: "center",
              padding: "var(--space-3)",
              borderTop: "1px solid var(--color-border)",
            }}>
              <button
                onClick={() => setShowAll(true)}
                style={{
                  padding: "4px 20px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "Inter, var(--font-sans)",
                  color: "var(--color-primary)",
                  background: "transparent",
                  border: "1px solid var(--color-primary)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary-bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                查看全部 ({filteredSignals.length})
              </button>
            </div>
          )}
        </div>

        {/* ====== 右栏: 侧边栏 ====== */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* 市场热力图 */}
          <div style={{
            padding: "var(--space-4)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-3)",
            }}>
              <h4 style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text)",
                margin: 0,
                fontFamily: "Inter, var(--font-sans)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}>
                <span style={{ color: "var(--color-primary)" }}>&#9632;&#9632;</span>
                市场热力图
              </h4>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "1px 6px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
              }}>
                板块
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: 3,
              aspectRatio: "1.6",
            }}>
              {SECTORS.map((s) => (
                <div
                  key={s.name}
                  style={{
                    background: s.bullish === undefined ? "var(--color-surface-hover)" :
                      s.bullish ? "var(--color-bullish-bg)" : "var(--color-bearish-bg)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "Inter, var(--font-sans)",
                    color: s.bullish === undefined ? "var(--color-muted)" :
                      s.bullish ? "var(--color-bullish)" : "var(--color-bearish)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    gridColumn: s.colSpan ? `span ${s.colSpan}` : undefined,
                    gridRow: s.rowSpan ? `span ${s.rowSpan}` : undefined,
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  <span>{s.name}</span>
                  {s.change && <span style={{ fontSize: 9 }}>{s.change}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 每日必修 */}
          <div style={{
            padding: "var(--space-4)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            position: "relative",
            overflow: "hidden",
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "Inter, var(--font-sans)",
              color: "var(--color-primary)",
              background: "var(--color-primary-bg)",
              border: "1px solid var(--color-primary)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              marginBottom: "var(--space-2)",
              display: "inline-block",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              每日必修
            </span>
            <h4 style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text)",
              margin: "0 0 var(--space-2) 0",
              fontFamily: "Inter, var(--font-sans)",
            }}>
              5分钟读懂 K线反转信号
            </h4>
            <p style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              margin: "0 0 var(--space-3) 0",
              fontFamily: "Inter, var(--font-sans)",
            }}>
              快速识别"早晨之星"与"黄昏之星"，掌握最佳买卖切入点。
            </p>
            <Link
              to="/learn"
              style={{
                display: "inline-block",
                padding: "4px 16px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "Inter, var(--font-sans)",
                color: "var(--color-bg)",
                background: "var(--color-primary)",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              开始学习
            </Link>
          </div>

          {/* 学习进度 */}
          <div style={{
            padding: "var(--space-4)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}>
            <h4 style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text)",
              margin: "0 0 var(--space-3) 0",
              fontFamily: "Inter, var(--font-sans)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}>
              <span style={{ color: "var(--color-primary)" }}>&#9654;</span>
              学习进度
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {[
                { label: "基础分析入门", pct: 85 },
                { label: "量化策略实战", pct: 12 },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                    fontSize: 12,
                    fontFamily: "Inter, var(--font-sans)",
                  }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>{item.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)", fontSize: 11 }}>
                      {item.pct}%
                    </span>
                  </div>
                  <div style={{
                    height: 3,
                    background: "var(--color-surface-hover)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${item.pct}%`,
                      background: "var(--color-primary)",
                      borderRadius: 2,
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
