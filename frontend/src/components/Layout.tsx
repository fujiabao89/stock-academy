import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "0 var(--main-padding-x)",
          height: "var(--header-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(12px)",
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.02em",
            display: "flex",
            alignItems: "center",
            minHeight: 44,
            textDecoration: "none",
            fontFamily: "Inter, var(--font-sans)",
          }}
        >
          <span style={{ color: "var(--color-primary)" }}>炒股</span>
          学堂
        </Link>

        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          )}
        </button>

        <nav className={`nav-links-desktop${menuOpen ? " open" : ""}`}>
          {[
            { to: "/", label: "首页" },
            { to: "/learn", label: "学堂" },
            { to: "/news", label: "新闻" },
            { to: "/strategies", label: "策略" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{
                color: "var(--color-text-secondary)",
                fontWeight: 500,
                fontFamily: "Inter, var(--font-sans)",
                transition: "color 0.15s",
                display: "flex",
                alignItems: "center",
                minHeight: 44,
                padding: "0 12px",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                to="/watchlist"
                style={{
                  color: "var(--color-text-secondary)",
                  fontWeight: 500,
                  fontFamily: "Inter, var(--font-sans)",
                  transition: "color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  minHeight: 44,
                  padding: "0 12px",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
                onClick={() => setMenuOpen(false)}
              >
                自选股
              </Link>
              <span style={{
                color: "var(--color-text-secondary)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                padding: "4px 10px",
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
              }}>
                {user.email}
              </span>
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                style={{
                  color: "var(--color-text-secondary)",
                  fontWeight: 500,
                  fontSize: 13,
                  fontFamily: "Inter, var(--font-sans)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 12px",
                  minHeight: 44,
                }}
              >
                退出
              </button>
            </>
          ) : (
            <Link
              to="/login"
              style={{
                color: "var(--color-bg)",
                fontWeight: 600,
                fontSize: 13,
                fontFamily: "Inter, var(--font-sans)",
                background: "var(--color-primary)",
                padding: "6px 16px",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              onClick={() => setMenuOpen(false)}
            >
              登录
            </Link>
          )}
        </nav>
      </header>
      <main style={{ flex: 1, padding: "var(--main-padding-y) var(--main-padding-x)", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <Outlet />
      </main>
    </div>
  );
}
