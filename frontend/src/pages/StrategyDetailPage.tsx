import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StrategyCard from "../components/StrategyCard";
import type { Strategy } from "../components/StrategyCard";
import { useAuth } from "../contexts/AuthContext";

interface StrategyRun {
  id: number;
  strategy_id: number;
  stock_code: string;
  stock_name: string;
  matched_at: string;
  details: Record<string, unknown>;
}

export default function StrategyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [runs, setRuns] = useState<StrategyRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    total_scanned: number;
    total_matched: number;
  } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/strategies/${id}`).then((r) => {
        if (!r.ok) throw new Error("策略不存在");
        return r.json();
      }),
      fetch(`/api/strategies/${id}/runs`).then((r) => r.json()),
    ])
      .then(([s, r]) => {
        setStrategy(s);
        setRuns(r.items ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleScan = async () => {
    if (!id || scanning) return;
    setScanning(true);
    setScanResult(null);
    try {
      const r = await fetch(`/api/strategies/${id}/scan`, { method: "POST" });
      const data = await r.json();
      setScanResult({
        total_scanned: data.total_scanned,
        total_matched: data.total_matched,
      });
      setRuns(data.results ?? []);
    } catch {
      setError("扫描失败");
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-secondary)" }}>
        加载中...
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--space-8)", textAlign: "center" }}>
        <p style={{ color: "var(--color-bearish)", marginBottom: "var(--space-4)" }}>{error || "策略不存在"}</p>
        <Link to="/strategies" style={{ color: "var(--color-primary)" }}>返回策略列表</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Link to="/strategies" style={{ fontSize: 13, color: "var(--color-primary)", textDecoration: "none" }}>
          &larr; 返回策略列表
        </Link>
      </div>

      <StrategyCard strategy={strategy} onRun={handleScan} running={scanning} />

      {!strategy.is_builtin && user && (
        <div style={{ marginTop: "var(--space-3)", textAlign: "right" }}>
          <Link
            to={`/strategies/${strategy.id}/edit`}
            style={{
              fontSize: 13,
              color: "var(--color-primary)",
              textDecoration: "none",
              padding: "4px 12px",
              border: "1px solid var(--color-primary)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            编辑
          </Link>
        </div>
      )}

      {scanResult && (
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: scanResult.total_matched > 0 ? "var(--color-bullish-bg)" : "var(--color-bg)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-1)" }}>
            扫描完成: {scanResult.total_scanned} 只股票，匹配 {scanResult.total_matched} 只
          </div>
        </div>
      )}

      {runs.length > 0 && (
        <section style={{ marginTop: "var(--space-6)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 var(--space-3) 0" }}>
            匹配结果 ({runs.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {runs.map((run) => (
              <div
                key={run.id}
                style={{
                  padding: "var(--space-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Link
                    to={`/stock/${run.stock_code}`}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--color-text)",
                      textDecoration: "none",
                    }}
                  >
                    {run.stock_name}
                  </Link>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: "var(--space-2)" }}>
                    {run.stock_code}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                  {new Date(run.matched_at).toLocaleString("zh-CN")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!scanning && scanResult && runs.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--color-text-secondary)", fontSize: 14 }}>
          没有股票匹配该策略条件
        </div>
      )}
    </div>
  );
}
