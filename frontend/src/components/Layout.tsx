import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();

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
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.5px",
            display: "flex",
            alignItems: "center",
            minHeight: 44,
          }}
        >
          <span style={{ color: "var(--color-primary)" }}>炒股</span>
          学堂
        </Link>
        <nav style={{ display: "flex", gap: "var(--space-6)", fontSize: 14, alignItems: "center" }}>
          <Link
            to="/"
            style={{
              color: "var(--color-text-secondary)",
              fontWeight: 500,
              transition: "color 0.15s",
              display: "flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 4px",
            }}
          >
            首页
          </Link>
          <Link
            to="/learn"
            style={{
              color: "var(--color-text-secondary)",
              fontWeight: 500,
              transition: "color 0.15s",
              display: "flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 4px",
            }}
          >
            学堂
          </Link>
          <Link
            to="/news"
            style={{
              color: "var(--color-text-secondary)",
              fontWeight: 500,
              transition: "color 0.15s",
              display: "flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 4px",
            }}
          >
            新闻
          </Link>
          <Link
            to="/strategies"
            style={{
              color: "var(--color-text-secondary)",
              fontWeight: 500,
              transition: "color 0.15s",
              display: "flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 4px",
            }}
          >
            策略
          </Link>
          {user ? (
            <>
              <Link
                to="/watchlist"
                style={{
                  color: "var(--color-text-secondary)",
                  fontWeight: 500,
                  transition: "color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  minHeight: 44,
                  padding: "0 4px",
                }}
              >
                自选股
              </Link>
              <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
                {user.email}
              </span>
              <button
                onClick={logout}
                style={{
                  color: "var(--color-text-secondary)",
                  fontWeight: 500,
                  fontSize: 14,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 4px",
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
                color: "var(--color-primary)",
                fontWeight: 500,
                transition: "color 0.15s",
                display: "flex",
                alignItems: "center",
                minHeight: 44,
                padding: "0 4px",
              }}
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
