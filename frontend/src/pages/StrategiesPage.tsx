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
      <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-secondary)" }}>
        加载中...
      </div>
    );
  }

  const builtin = strategies.filter((s) => s.is_builtin);
  const custom = strategies.filter((s) => !s.is_builtin);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 var(--space-1) 0" }}>策略引擎</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
            组合 K 线形态与指标条件，一键扫描全市场
          </p>
        </div>
        {user && (
          <Link
            to="/strategies/new"
            style={{
              padding: "6px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              background: "var(--color-primary)",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
            }}
          >
            新建策略
          </Link>
        )}
      </div>

      {error && (
        <div style={{
          padding: "var(--space-4)",
          background: "var(--color-bearish-bg)",
          color: "var(--color-bearish)",
          borderRadius: "var(--radius-sm)",
          fontSize: 14,
          marginBottom: "var(--space-4)",
        }}>
          {error}
        </div>
      )}

      {builtin.length > 0 && (
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 var(--space-3) 0", color: "var(--color-text-secondary)" }}>
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
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 var(--space-3) 0", color: "var(--color-text-secondary)" }}>
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
        <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--color-text-secondary)" }}>
          暂无策略
        </div>
      )}
    </div>
  );
}
