import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StrategyCard from "../components/StrategyCard";
import type { Strategy } from "../components/StrategyCard";
import { useAuth } from "../contexts/AuthContext";
import Skeleton, { SkeletonCard } from "../components/Skeleton";

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
      fetch(`/api/strategies/${id}/runs`).then((r) => {
        if (!r.ok) throw new Error("扫描记录加载失败");
        return r.json();
      }),
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
      <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ marginBottom: "var(--space-2)", display: "flex", gap: "var(--space-2)" }}>
          <Skeleton width={60} height={13} />
          <Skeleton width={80} height={13} />
        </div>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--space-10)", textAlign: "center" }}>
        <p style={{ color: "var(--color-destructive)", marginBottom: "var(--space-4)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>{error || "策略不存在"}</p>
        <Link to="/strategies" style={{ color: "var(--color-primary)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>返回策略列表</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{
        marginBottom: "var(--space-5)",
        fontSize: 13,
        color: "var(--color-text-secondary)",
        fontFamily: "Inter, var(--font-sans)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}>
        <Link to="/strategies" style={{ color: "var(--color-muted)", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-muted)")}>
          策略引擎
        </Link>
        <span style={{ color: "var(--color-border)" }}>/</span>
        <span style={{ color: "var(--color-text)", fontWeight: 500 }}>{strategy.name}</span>
      </div>

      <StrategyCard strategy={strategy} onRun={handleScan} running={scanning} />

      {!strategy.is_builtin && user && (
        <div style={{ marginTop: "var(--space-4)", textAlign: "right" }}>
          <Link
            to={`/strategies/${strategy.id}/edit`}
            style={{
              fontSize: 13,
              fontFamily: "Inter, var(--font-sans)",
              color: "var(--color-primary)",
              textDecoration: "none",
              padding: "6px 16px",
              border: "1px solid var(--color-primary)",
              borderRadius: "var(--radius-md)",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-primary)";
              e.currentTarget.style.color = "var(--color-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--color-primary)";
            }}
          >
            编辑
          </Link>
        </div>
      )}

      {scanResult && (
        <div
          style={{
            marginTop: "var(--space-5)",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: scanResult.total_matched > 0 ? "var(--color-bullish-bg)" : "var(--color-bg)",
            border: scanResult.total_matched > 0 ? "1px solid var(--color-bullish)" : "1px solid var(--color-border)",
            fontFamily: "Inter, var(--font-sans)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-1)", color: scanResult.total_matched > 0 ? "var(--color-bullish)" : "var(--color-text-secondary)" }}>
            扫描完成: {scanResult.total_scanned} 只股票，匹配 {scanResult.total_matched} 只
          </div>
        </div>
      )}

      {scanning && (
        <div style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--color-text-secondary)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>
          扫描中...
        </div>
      )}

      {runs.length > 0 && (
        <section style={{ marginTop: "var(--space-6)" }}>
          <h2 style={{
            fontSize: 13,
            fontWeight: 600,
            margin: "0 0 var(--space-4) 0",
            color: "var(--color-muted)",
            fontFamily: "Inter, var(--font-sans)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            匹配结果 ({runs.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {runs.map((run) => (
              <div
                key={run.id}
                style={{
                  padding: "var(--space-4)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-surface)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "border-color 0.15s, background 0.15s",
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
                <div>
                  <Link
                    to={`/stock/${run.stock_code}`}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "Inter, var(--font-sans)",
                      color: "var(--color-text)",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                  >
                    {run.stock_name}
                  </Link>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", marginLeft: "var(--space-2)" }}>
                    {run.stock_code}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
                  {new Date(run.matched_at).toLocaleString("zh-CN")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!scanning && scanResult && runs.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "var(--space-8)",
          color: "var(--color-text-secondary)",
          fontSize: 14,
          fontFamily: "Inter, var(--font-sans)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          marginTop: "var(--space-5)",
        }}>
          没有股票匹配该策略条件
        </div>
      )}
    </div>
  );
}
