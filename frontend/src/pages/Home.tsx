import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";

export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "clamp(32px, 10vw, 80px)",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(24px, 8vw, 32px)",
          fontWeight: 700,
          letterSpacing: "-1px",
          marginBottom: "var(--space-2)",
        }}
      >
        <span style={{ color: "var(--color-primary)" }}>炒股</span>
        学堂
      </h1>
      <p
        style={{
          color: "var(--color-text-secondary)",
          fontSize: 15,
          marginBottom: "var(--space-8)",
        }}
      >
        不推荐股票，只教判断方法
      </p>
      <SearchBar />
      <div
        style={{
          marginTop: "var(--space-8)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          justifyContent: "center",
          maxWidth: 500,
        }}
      >
        {[
          { code: "600519", name: "贵州茅台" },
          { code: "000001", name: "平安银行" },
          { code: "000333", name: "美的集团" },
          { code: "600900", name: "长江电力" },
          { code: "002594", name: "比亚迪" },
        ].map((s) => (
          <Link
            key={s.code}
            to={`/stock/${s.code}`}
            style={{
              fontSize: 13,
              padding: "12px 16px",
              display: "inline-flex",
              alignItems: "center",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-secondary)",
              transition: "border-color 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-primary)";
              e.currentTarget.style.color = "var(--color-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            {s.name} {s.code}
          </Link>
        ))}
      </div>
    </div>
  );
}
