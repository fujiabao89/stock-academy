import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, BarChart2, Newspaper, BookOpen, Search, Lock, ExternalLink } from "lucide-react";

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

/* ============================================================
   Sub-components
   ============================================================ */

const MarketIndex = ({ label, value, change, isPositive }: {
  label: string; value: string; change: string; isPositive: boolean;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
      <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <span className="data-mono" style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
    <div
      className="data-mono"
      style={{
        fontSize: 10, textAlign: "right",
        color: isPositive ? "var(--color-bullish)" : "var(--color-bearish)",
      }}
    >
      {change}
    </div>
    <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.05)", marginTop: 4 }} />
  </div>
);

const WatchlistItem = ({ symbol, code, price, change, isPositive }: {
  symbol: string; code: string; price: string; change: string; isPositive: boolean;
}) => (
  <Link
    to={`/stock/${code}`}
    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none" }}
  >
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", transition: "color 0.15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text)")}
      >{symbol}</span>
      <span className="data-mono" style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{code}</span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <span className="data-mono" style={{ fontSize: 12, color: isPositive ? "var(--color-bullish)" : "var(--color-bearish)" }}>{price}</span>
      <span className="data-mono" style={{ fontSize: 9, color: isPositive ? "var(--color-bullish)" : "var(--color-bearish)" }}>{change}</span>
    </div>
  </Link>
);

const StrategyCard = ({ id, name, description }: {
  id: number; name: string; description: string;
}) => (
  <Link
    to={`/strategies/${id}`}
    className="card-terminal"
    style={{
      padding: "var(--space-4)", textDecoration: "none",
      transition: "background 0.15s, border-color 0.15s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-elevated)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-surface)"; }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px 0" }}>{name}</h4>
        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>{description}</p>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, color: "var(--color-primary)",
        border: "1px solid rgba(245,158,11,0.2)",
        padding: "2px 8px", borderRadius: "var(--radius-sm)",
        flexShrink: 0, marginLeft: 12,
      }}>
        查看
      </span>
    </div>
  </Link>
);

const SignalRow = ({ code, name, pattern, strength, price, change, isPositive, patternDir }: {
  code: string; name: string; pattern: string; strength: string; price: string; change: string; isPositive: boolean; patternDir: string;
}) => {
  const barWidth = strength === "STRONG" ? "80%" : strength === "MEDIUM" ? "50%" : "25%";
  const barOpacity = strength === "STRONG" ? "1" : strength === "MEDIUM" ? "0.6" : "0.3";
  const patternColor = patternDir === "bullish" ? "var(--color-bullish)" : "var(--color-bearish)";
  const patternBg = patternDir === "bullish" ? "var(--color-bullish-bg)" : "var(--color-bearish-bg)";
  const patternBorder = patternDir === "bullish" ? "var(--color-bullish-border)" : "var(--color-bearish-border)";
  return (
    <tr className="table-terminal-row" style={{ transition: "background 0.15s", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td className="col-mono" style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "var(--color-text-muted)", fontSize: 12 }}>{code}</td>
      <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontWeight: 700, color: "var(--color-text)", fontSize: 12 }}>
        <Link to={`/stock/${code}`} style={{ color: "inherit", transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text)")}
        >{name}</Link>
      </td>
      <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
        <Link
          to={`/learn/patterns/${pattern}`}
          className="chip-mono"
          style={{ color: patternColor, background: patternBg, borderColor: patternBorder, textDecoration: "none" }}
        >
          {pattern}
        </Link>
      </td>
      <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 9999, width: barWidth, background: "var(--color-primary)", opacity: barOpacity }} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--color-text-muted)" }}>{strength}</span>
        </div>
      </td>
      <td style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "right", fontSize: 12 }}>
        <div className="data-mono" style={{ fontWeight: 700, color: "var(--color-text)" }}>{price}</div>
        <div className="data-mono" style={{ fontSize: 10, color: isPositive ? "var(--color-bullish)" : "var(--color-bearish)" }}>{change}</div>
      </td>
    </tr>
  );
};

interface StrategyItem {
  id: number;
  name: string;
  description: string;
  is_builtin: boolean;
  enabled: boolean;
}

const NEWS_ITEMS = [
  { time: "15:45", text: "央行开展2000亿元中期借贷便利(MLF)操作，利率维持不变。" },
  { time: "15:32", text: "北向资金今日净买入超50亿元，连续三日净流入。" },
  { time: "15:10", text: "多地出台新一轮促消费政策，汽车家电板块异动拉升。" },
];

const REPORTS = [
  { title: "AI算力需求持续爆发，光模块核心标的深度解析", source: "中信证券", views: "1.2w" },
  { title: "固态电池产业化加速，产业链投资机会梳理", source: "广发证券", views: "8.5k" },
  { title: "低空经济政策频出，万亿级市场蓄势待发", source: "国泰君安", views: "6.8k" },
];

const INDICES = [
  { label: "上证指数", value: "3052.12", change: "+1.24%", isPositive: true },
  { label: "深证成指", value: "9321.45", change: "+1.56%", isPositive: true },
  { label: "创业板指", value: "1795.33", change: "-0.45%", isPositive: false },
];

const WATCHLIST = [
  { symbol: "药明康德", code: "603259", price: "45.22", change: "+2.10%", isPositive: true },
  { symbol: "工业富联", code: "601138", price: "22.45", change: "-1.05%", isPositive: false },
  { symbol: "北方华创", code: "002371", price: "298.50", change: "+4.56%", isPositive: true },
];

/* ============================================================
   Main Page
   ============================================================ */

const STRENGTHS = ["STRONG", "MEDIUM", "WEAK", "STRONG", "MEDIUM", "WEAK", "STRONG", "MEDIUM", "WEAK", "STRONG"] as const;

export default function Home() {
  const [signals, setSignals] = useState<LatestStockSignal[]>([]);
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/signals/latest").then((r) => {
        if (!r.ok) throw new Error(`服务器错误 (${r.status})`);
        return r.json();
      }),
      fetch("/api/strategies").then((r) => {
        if (!r.ok) throw new Error(`服务器错误 (${r.status})`);
        return r.json();
      }),
    ])
      .then(([signalData, strategyData]) => {
        if (!cancelled) {
          setSignals(signalData);
          setStrategies(strategyData.items ?? []);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message || "加载失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const renderSignalRows = () => {
    if (signals.length > 0) {
      return signals.slice(0, 10).map((stock, i) => {
        const pat = stock.patterns[0];
        const strength = STRENGTHS[i];
        return (
          <SignalRow
            key={stock.code}
            code={stock.code}
            name={stock.stock_name}
            pattern={pat ? pat.pattern_name : "—"}
            patternDir={pat ? pat.direction : "neutral"}
            strength={strength}
            price={"—"}
            change={"—"}
            isPositive={true}
          />
        );
      });
    }
    return (
      <tr>
        <td colSpan={5} style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--color-text-muted)" }}>
          暂无实时信号
        </td>
      </tr>
    );
  };

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 24 }}>
        {/* ============================================================
            Left Column (2/12): Market Summary + Watchlist
            ============================================================ */}
        <aside style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Market Summary */}
          <section className="card-terminal" style={{ padding: "var(--space-4)" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
              textTransform: "uppercase", letterSpacing: "0.15em",
              marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              市场总览
              <TrendingUp size={12} style={{ color: "var(--color-primary)" }} />
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {INDICES.map((idx) => (
                <MarketIndex key={idx.label} {...idx} />
              ))}
            </div>
          </section>

          {/* Watchlist */}
          <section className="card-terminal" style={{ padding: "var(--space-4)" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
              textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16,
            }}>
              自选股
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {WATCHLIST.map((item) => (
                <WatchlistItem key={item.code} {...item} />
              ))}
            </div>
          </section>
        </aside>

        {/* ============================================================
            Center Column (7/12): Strategy Board + Signal Table
            ============================================================ */}
        <div style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Header */}
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>今日策略匹配</h1>
                <span style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "rgba(245,158,11,0.1)", color: "var(--color-primary)",
                  padding: "2px 8px", borderRadius: "var(--radius-sm)",
                  fontSize: 10, fontWeight: 700,
                  border: "1px solid rgba(245,158,11,0.2)",
                }}>
                  <span className="live-dot" style={{ width: 6, height: 6 }} />
                  LIVE
                </span>
              </div>
              <p className="data-mono" style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
                数据更新时间：2024-06-07 15:30
              </p>
            </div>

            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="搜索实时形态... (ALT + S)"
                style={{
                  width: 256,
                  padding: "8px 12px 8px 40px",
                  fontSize: 12,
                  background: "var(--color-surface-high)",
                  border: "1px solid rgba(245,158,11,0.1)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text)",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.1)")}
              />
            </div>
          </header>

          {/* Strategy Cards (2x2 grid) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {strategies.slice(0, 4).map((s) => (
              <StrategyCard key={s.id} id={s.id} name={s.name} description={s.description} />
            ))}
          </div>

          {/* Signal Table */}
          <section className="card-terminal" style={{ overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={16} style={{ color: "var(--color-primary)" }} />
                今日形态信号
              </h3>
              <span className="data-mono" style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                共 {signals.length} 个实时信号
              </span>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--color-text-secondary)" }}>
                加载中...
              </div>
            ) : error ? (
              <div style={{ textAlign: "center", padding: "var(--space-10)", color: "var(--color-bearish)" }}>
                {error}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table-terminal" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "12px 16px" }}>股票代码</th>
                      <th style={{ padding: "12px 16px" }}>名称</th>
                      <th style={{ padding: "12px 16px" }}>当前形态</th>
                      <th style={{ padding: "12px 16px" }}>信号强度</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>实时价格</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderSignalRows()}
                  </tbody>
                </table>
              </div>
            )}

            <button style={{
              width: "100%", padding: "12px", textAlign: "center", cursor: "pointer",
              fontSize: 10, color: "var(--color-text-muted)", fontWeight: 700,
              letterSpacing: "0.1em", border: "none", background: "none",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              transition: "color 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
            >
              <Link to="/learn" style={{ color: "inherit", textDecoration: "none" }}>
                查看完整信号报告 (SHIFT + R)
              </Link>
            </button>
          </section>
        </div>

        {/* ============================================================
            Right Column (3/12): News + Reports + Education
            ============================================================ */}
        <aside style={{ gridColumn: "span 3", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* News Timeline */}
          <section className="card-terminal" style={{ padding: "var(--space-4)" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
              textTransform: "uppercase", letterSpacing: "0.15em",
              marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
            }}>
              <Newspaper size={14} style={{ color: "var(--color-primary)" }} />
              实时资讯
            </h3>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: 6, top: 8, bottom: 8,
                width: 1, background: "rgba(255,255,255,0.05)",
              }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {NEWS_ITEMS.map((item, i) => (
                  <Link to="/news" key={i} style={{ position: "relative", paddingLeft: 24, paddingBottom: 8, textDecoration: "none", display: "block" }}>
                    <div style={{
                      position: "absolute", left: 0, top: 6,
                      width: 12, height: 12, borderRadius: "50%",
                      background: "var(--color-primary)",
                      border: "2px solid var(--color-surface)", zIndex: 10,
                    }} />
                    <div className="data-mono" style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 4 }}>
                      {item.time}
                    </div>
                    <p style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6, margin: 0, transition: "color 0.15s", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
                    >
                      {item.text}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Reports */}
          <section className="card-terminal" style={{ padding: "var(--space-4)", overflow: "hidden" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
              textTransform: "uppercase", letterSpacing: "0.15em",
              marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
            }}>
              <BookOpen size={14} style={{ color: "var(--color-primary)" }} />
              热门研报
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {REPORTS.map((r, i) => (
                <Link to="/news" key={i} style={{ textDecoration: "none" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.5, marginBottom: 4, transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                  >
                    {r.title}
                  </h4>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    <span>{r.source}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Search size={10} />
                      {r.views}
                    </span>
                  </div>
                  {i < REPORTS.length - 1 && (
                    <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.05)", marginTop: 16 }} />
                  )}
                </Link>
              ))}
            </div>
          </section>

          {/* Featured Course */}
          <section
            className="card-terminal"
            style={{
              position: "relative", overflow: "hidden",
              borderColor: "rgba(245,158,11,0.3)", borderWidth: 1, borderStyle: "solid",
              padding: 20,
            }}
          >
            <div style={{ position: "absolute", top: 0, right: 0, padding: 8, opacity: 0.1 }}>
              <Lock size={48} style={{ color: "var(--color-primary)" }} />
            </div>
            <span style={{
              display: "inline-block",
              background: "rgba(245,158,11,0.1)", color: "var(--color-primary)",
              padding: "2px 8px", borderRadius: "var(--radius-sm)",
              fontSize: 10, fontWeight: 700, marginBottom: 12,
              border: "1px solid rgba(245,158,11,0.2)",
            }}>
              HOT COURSE
            </span>
            <h4 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", margin: "0 0 8px 0" }}>
              5分钟读懂 K线反转信号
            </h4>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 16px 0", lineHeight: 1.6 }}>
              快速掌握24种经典反转K线，准确识别市场顶部与底部，避开陷阱。
            </p>
            <Link
              to="/learn"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "8px 0",
                background: "linear-gradient(to right, var(--color-primary), #d98a0a)",
                color: "var(--color-text-inverse)", borderRadius: "var(--radius-sm)",
                fontSize: 12, fontWeight: 700, textDecoration: "none",
                transition: "transform 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              立即学习
              <ExternalLink size={12} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
