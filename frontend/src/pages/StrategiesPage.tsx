import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StrategyCard from "../components/StrategyCard";
import type { Strategy } from "../components/StrategyCard";
import { useAuth } from "../contexts/AuthContext";

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => {
        if (!r.ok) throw new Error("加载失败");
        return r.json();
      })
      .then((data) => {
        setStrategies(data.items ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-text-secondary)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>
        加载中...
      </div>
    );
  }

  const builtin = strategies.filter((s) => s.is_builtin);
  const custom = strategies.filter((s) => !s.is_builtin);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-6)", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div>
          <h1 style={{
            fontSize: "clamp(22px, 3vw, 32px)",
            fontWeight: 700,
            margin: "0 0 var(--space-2) 0",
            color: "var(--color-text)",
            fontFamily: "Inter, var(--font-sans)",
            letterSpacing: "-0.01em",
          }}>策略引擎</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0, fontFamily: "Inter, var(--font-sans)" }}>
            组合 K 线形态与指标条件，一键扫描全市场
          </p>
        </div>
        {user && (
          <Link
            to="/strategies/new"
            style={{
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "Inter, var(--font-sans)",
              color: "var(--color-bg)",
              background: "var(--color-primary)",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "opacity 0.15s",
            }}
          >
            新建策略
          </Link>
        )}
      </div>

      {error && (
        <div style={{
          padding: "var(--space-4)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-destructive)",
          color: "var(--color-destructive)",
          borderRadius: "var(--radius-md)",
          fontSize: 14,
          fontFamily: "Inter, var(--font-sans)",
          marginBottom: "var(--space-4)",
        }}>
          {error}
        </div>
      )}

      {builtin.length > 0 && (
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{
            fontSize: 13,
            fontWeight: 600,
            margin: "0 0 var(--space-4) 0",
            color: "var(--color-muted)",
            fontFamily: "Inter, var(--font-sans)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            内置策略
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {builtin.map((s) => (
              <Link key={s.id} to={`/strategies/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <StrategyCard strategy={s} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {custom.length > 0 && (
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{
            fontSize: 13,
            fontWeight: 600,
            margin: "0 0 var(--space-4) 0",
            color: "var(--color-muted)",
            fontFamily: "Inter, var(--font-sans)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            自定义策略
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {custom.map((s) => (
              <Link key={s.id} to={`/strategies/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <StrategyCard strategy={s} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {strategies.length === 0 && !error && (
        <div style={{
          textAlign: "center",
          padding: "var(--space-8)",
          color: "var(--color-text-secondary)",
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 14,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
        }}>
          暂无策略
        </div>
      )}
    </div>
  );
}
