import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, getAccessToken } from "../contexts/AuthContext";
import { SkeletonCard } from "../components/Skeleton";

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
    const r = await fetch("/api/user/watchlist", {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
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
      const r = await fetch(`/api/user/watchlist/${codeInput.trim()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
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
    const r = await fetch(`/api/user/watchlist/${code}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (r.ok || r.status === 404) {
      await load();
    }
  };

  if (loading) return (
    <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} lines={1} />
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{
        fontSize: "clamp(22px, 3vw, 32px)",
        fontWeight: 700,
        margin: "0 0 var(--space-2) 0",
        color: "var(--color-text)",
        fontFamily: "Inter, var(--font-sans)",
        letterSpacing: "-0.01em",
      }}>
        我的自选股
      </h1>
      <p style={{
        fontSize: 14,
        color: "var(--color-text-secondary)",
        margin: "0 0 var(--space-6) 0",
        fontFamily: "Inter, var(--font-sans)",
      }}>
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
            fontFamily: "var(--font-mono)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            boxSizing: "border-box",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
        />
        <button
          type="submit"
          disabled={adding}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "Inter, var(--font-sans)",
            color: "var(--color-bg)",
            background: adding ? "var(--color-muted)" : "var(--color-primary)",
            border: "none",
            borderRadius: "var(--radius-md)",
            cursor: adding ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s",
          }}
        >
          {adding ? "添加中..." : "添加"}
        </button>
      </form>

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

      {items.length === 0 ? (
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
          还没有添加自选股
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {items.map((item) => (
            <div
              key={item.code}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-4) var(--space-5)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-surface)",
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
                <span style={{ fontWeight: 600, fontSize: 15, fontFamily: "Inter, var(--font-sans)", color: "var(--color-text)" }}>{item.name}</span>
                <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", marginLeft: "var(--space-2)" }}>
                  {item.code}
                </span>
                <span style={{
                  fontSize: 11,
                  fontFamily: "Inter, var(--font-sans)",
                  color: "var(--color-primary)",
                  marginLeft: "var(--space-2)",
                  padding: "1px 6px",
                  border: "1px solid var(--color-primary)",
                  borderRadius: "var(--radius-sm)",
                }}>
                  {item.market === "sh" ? "沪" : item.market === "sz" ? "深" : ""}
                </span>
              </div>
              <button
                onClick={() => handleRemove(item.code)}
                style={{
                  padding: "4px 12px",
                  fontSize: 13,
                  fontFamily: "Inter, var(--font-sans)",
                  color: "var(--color-text-secondary)",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--color-destructive)";
                  e.currentTarget.style.borderColor = "var(--color-destructive)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                  e.currentTarget.style.borderColor = "var(--color-border)";
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
