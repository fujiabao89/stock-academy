import { useCallback, useEffect, useRef, useState } from "react";
import NewsCard from "../components/NewsCard";
import type { NewsArticle } from "../components/NewsCard";

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/news?limit=20");
      if (!r.ok) throw new Error("加载新闻失败");
      const data = await r.json();
      if (!cancelled.current) {
        setArticles(data.items ?? []);
        setNextCursor(data.next_cursor);
        setLoading(false);
      }
    } catch (err) {
      if (!cancelled.current) {
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetch(`/api/news?limit=20&cursor=${encodeURIComponent(nextCursor)}`);
      const data = await r.json();
      if (!cancelled.current) {
        setArticles((prev) => [...prev, ...(data.items ?? [])]);
        setNextCursor(data.next_cursor);
        setLoadingMore(false);
      }
    } catch {
      if (!cancelled.current) setLoadingMore(false);
    }
  };

  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
        loadMore();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [nextCursor, loadingMore]);

  if (loading) {
    return <div style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-text-secondary)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>加载中...</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{
        fontSize: "clamp(22px, 3vw, 32px)",
        fontWeight: 700,
        margin: "0 0 var(--space-2) 0",
        color: "var(--color-text)",
        fontFamily: "Inter, var(--font-sans)",
        letterSpacing: "-0.01em",
      }}>
        新闻总览
      </h1>
      <p style={{
        fontSize: 14,
        color: "var(--color-text-secondary)",
        margin: "0 0 var(--space-6) 0",
        fontFamily: "Inter, var(--font-sans)",
      }}>
        A 股财经新闻，每 30 分钟更新一次
      </p>

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

      {articles.length === 0 && !error ? (
        <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--color-text-secondary)", fontFamily: "Inter, var(--font-sans)", fontSize: 14, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
          暂无新闻
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {articles.map((a) => (
            <NewsCard key={a.id} article={a} />
          ))}
        </div>
      )}

      {loadingMore && (
        <div style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--color-text-secondary)", fontFamily: "Inter, var(--font-sans)", fontSize: 14 }}>
          加载更多...
        </div>
      )}

      {!nextCursor && articles.length > 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--color-muted)", fontSize: 13, fontFamily: "Inter, var(--font-sans)" }}>
          已加载全部新闻
        </div>
      )}
    </div>
  );
}
