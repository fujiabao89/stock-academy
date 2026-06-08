interface NewsArticle {
  id: number;
  title: string;
  url: string;
  source: string;
  content_summary: string;
  published_at: string;
  stock_codes: string[];
  stock_names: string[];
  ai_summary: string | null;
  sentiment: string | null;
}

interface Props {
  article: NewsArticle;
}

function sentimentColor(s: string | null): string {
  if (s === "利好") return "var(--color-bullish)";
  if (s === "利空") return "var(--color-bearish)";
  return "var(--color-text-secondary)";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewsCard({ article }: Props) {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--color-text)",
            textDecoration: "none",
            lineHeight: 1.4,
          }}
        >
          {article.title}
        </a>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap", marginLeft: "var(--space-3)" }}>
          {formatTime(article.published_at)}
        </span>
      </div>

      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
        {article.content_summary}
      </div>

      {article.ai_summary && (
        <div
          style={{
            padding: "var(--space-3)",
            background: "var(--color-bg)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            color: "var(--color-text)",
            lineHeight: 1.5,
            marginBottom: "var(--space-3)",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>AI 解读：</span>
          {article.ai_summary}
          {article.sentiment && (
            <span
              style={{
                marginLeft: "var(--space-2)",
                fontSize: 12,
                fontWeight: 600,
                color: sentimentColor(article.sentiment),
              }}
            >
              [{article.sentiment}]
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{article.source}</span>
        {article.stock_names.map((name, i) => (
          <span
            key={article.stock_codes[i] ?? i}
            style={{
              fontSize: 12,
              color: "var(--color-primary)",
              background: "var(--color-bullish-bg)",
              padding: "1px 6px",
              borderRadius: 4,
            }}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export type { NewsArticle };
