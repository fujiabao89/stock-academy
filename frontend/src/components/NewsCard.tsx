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
    <div style={{
      padding: "var(--space-5)",
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "Inter, var(--font-sans)",
            color: "var(--color-text)",
            textDecoration: "none",
            lineHeight: 1.4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text)")}
        >
          {article.title}
        </a>
        <span style={{
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          color: "var(--color-muted)",
          whiteSpace: "nowrap",
          marginLeft: "var(--space-3)",
        }}>
          {formatTime(article.published_at)}
        </span>
      </div>

      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "var(--space-3)", lineHeight: 1.6, fontFamily: "Inter, var(--font-sans)" }}>
        {article.content_summary}
      </div>

      {article.ai_summary && (
        <div style={{
          padding: "var(--space-3)",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-sm)",
          fontSize: 13,
          fontFamily: "Inter, var(--font-sans)",
          color: "var(--color-text)",
          lineHeight: 1.6,
          marginBottom: "var(--space-3)",
          border: "1px solid var(--color-border)",
        }}>
          <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>AI 解读：</span>
          {article.ai_summary}
          {article.sentiment && (
            <span style={{
              marginLeft: "var(--space-2)",
              fontSize: 12,
              fontWeight: 600,
              color: sentimentColor(article.sentiment),
            }}>
              [{article.sentiment}]
            </span>
          )}
          <div style={{
            marginTop: "var(--space-2)",
            fontSize: 11,
            color: "var(--color-disclaimer)",
            fontFamily: "Inter, var(--font-sans)",
          }}>
            AI 生成，仅供参考，不构成投资建议
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--color-muted)", fontFamily: "Inter, var(--font-sans)" }}>{article.source}</span>
        {article.stock_names.map((name, i) => (
          <span
            key={article.stock_codes[i] ?? i}
            style={{
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "Inter, var(--font-sans)",
              color: "var(--color-primary)",
              background: "var(--color-primary-bg)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-primary)",
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
