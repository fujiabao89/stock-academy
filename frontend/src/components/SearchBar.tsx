import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  code: string;
  name: string;
  market: string;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    } finally {
      setLoading(false);
    }
  }, []);

  const goToStock = (code: string) => {
    setResults([]);
    setQuery("");
    navigate(`/stock/${code}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setResults([]);
      return;
    }
    if (e.key === "Enter") {
      const q = query.trim();
      if (q.length === 0) return;
      if (results.length > 0) {
        const qUpper = q.toUpperCase();
        const exact = results.find((r) => r.code === qUpper);
        goToStock(exact ? exact.code : results[0].code);
      } else if (/^\d{6}$/.test(q)) {
        goToStock(q);
      }
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 560 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入股票代码或名称搜索，按 Enter 跳转..."
        autoFocus
        style={{
          width: "100%",
          padding: "14px 16px",
          fontSize: 16,
          background: "var(--color-surface)",
          border: "2px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          color: "var(--color-text)",
          outline: "none",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
      />

      {loading && (
        <div style={{ padding: "var(--space-3)", color: "var(--color-text-secondary)", fontSize: 14 }}>
          搜索中...
        </div>
      )}

      {!loading && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            marginTop: "var(--space-1)",
            overflow: "hidden",
            zIndex: 200,
          }}
        >
          {results.map((r) => (
            <div
              key={r.code}
              onClick={() => goToStock(r.code)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div>
                <span style={{ fontWeight: 600, marginRight: "var(--space-2)" }}>
                  {r.name}
                </span>
                <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
                  {r.code}
                </span>
              </div>
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: r.market === "sh" ? "var(--color-accent)" : "var(--color-primary)",
                  color: "#fff",
                  opacity: 0.8,
                }}
              >
                {r.market === "sh" ? "沪" : "深"}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && query && results.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            marginTop: "var(--space-1)",
            padding: "var(--space-5)",
            color: "var(--color-text-secondary)",
            fontSize: 14,
            textAlign: "center",
            zIndex: 200,
          }}
        >
          <div style={{ marginBottom: "var(--space-2)" }}>
            未找到「{query}」
          </div>
          <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
            目前仅支持沪深 300 成分股（如 600519 贵州茅台、000001 平安银行）
          </div>
        </div>
      )}
    </div>
  );
}
