import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface WatchlistItem {
  code: string;
  name: string;
  market: string;
  added_at: string;
}

export default function WatchlistPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  const load = useCallback(async () => {
    const tokens = JSON.parse(localStorage.getItem("stock_academy_tokens") ?? "{}");
    const r = await fetch("/api/user/watchlist", {
      headers: { Authorization: `Bearer ${tokens.access}` },
    });
    const data = await r.json();
    if (!cancelled.current) {
      setItems(data.items ?? []);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user, load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      const tokens = JSON.parse(localStorage.getItem("stock_academy_tokens") ?? "{}");
      const r = await fetch(`/api/user/watchlist/${codeInput.trim()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error?.detail ?? "添加失败");
      }
      setCodeInput("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (code: string) => {
    const tokens = JSON.parse(localStorage.getItem("stock_academy_tokens") ?? "{}");
    const r = await fetch(`/api/user/watchlist/${code}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokens.access}` },
    });
    if (r.ok || r.status === 404) {
      await load();
    }
  };

  if (loading) return <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-secondary)" }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 var(--space-2) 0" }}>我的自选股</h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "0 0 var(--space-6) 0" }}>
        添加关注的股票，追踪它们的新闻动态
      </p>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <input
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="输入 6 位股票代码，如 600519"
          maxLength={6}
          pattern="[0-9]{6}"
          required
          style={{
            flex: 1,
            padding: "10px 12px",
            fontSize: 14,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={adding}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: adding ? "var(--color-muted)" : "var(--color-primary)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: adding ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {adding ? "添加中..." : "添加"}
        </button>
      </form>

      {error && (
        <div style={{
          padding: "var(--space-3)",
          background: "var(--color-bearish-bg)",
          color: "var(--color-bearish)",
          borderRadius: "var(--radius-sm)",
          fontSize: 14,
          marginBottom: "var(--space-4)",
        }}>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--color-text-secondary)" }}>
          还没有添加自选股
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {items.map((item) => (
            <div
              key={item.code}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</span>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)", marginLeft: "var(--space-2)" }}>
                  {item.code}
                </span>
                <span style={{ fontSize: 12, color: "var(--color-muted)", marginLeft: "var(--space-2)" }}>
                  {item.market === "sh" ? "沪" : item.market === "sz" ? "深" : ""}
                </span>
              </div>
              <button
                onClick={() => handleRemove(item.code)}
                style={{
                  padding: "4px 12px",
                  fontSize: 13,
                  color: "var(--color-bearish)",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
