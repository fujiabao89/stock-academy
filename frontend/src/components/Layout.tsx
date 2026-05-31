import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "0 var(--space-6)",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.5px",
          }}
        >
          <span style={{ color: "var(--color-primary)" }}>炒股</span>
          学堂
        </Link>
        <nav style={{ display: "flex", gap: "var(--space-6)", fontSize: 14 }}>
          <Link
            to="/"
            style={{
              color: "var(--color-text-secondary)",
              fontWeight: 500,
              transition: "color 0.15s",
            }}
          >
            首页
          </Link>
        </nav>
      </header>
      <main style={{ flex: 1, padding: "var(--space-6)", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <Outlet />
      </main>
    </div>
  );
}
