import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: "var(--space-6)",
      }}
    >
      <h1 style={{ fontSize: 72, fontWeight: 700, color: "var(--color-muted)", margin: 0 }}>
        404
      </h1>
      <p style={{ fontSize: 18, color: "var(--color-text-secondary)", marginTop: "var(--space-3)" }}>
        页面未找到
      </p>
      <Link
        to="/"
        style={{
          marginTop: "var(--space-5)",
          padding: "12px 24px",
          background: "var(--color-primary)",
          color: "#fff",
          borderRadius: "var(--radius-md)",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        返回首页
      </Link>
    </div>
  );
}
