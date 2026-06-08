import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import { Bell, Search, User } from "lucide-react";

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  fontSize: 14,
  fontWeight: 500,
  color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
  transition: "color 0.15s",
  display: "flex",
  alignItems: "center",
  height: 56,
  borderBottom: isActive ? "2px solid var(--color-primary)" : "2px solid transparent",
  padding: "0 2px",
});

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const q = searchQuery.trim();
      if (/^\d{6}$/.test(q)) {
        navigate(`/stock/${q}`);
        setSearchQuery("");
      }
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ===== Navigation Bar ===== */}
      <header
        className="glass-nav"
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
        }}
      >
        {/* Left: Logo + Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {/* Mobile hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="菜单"
            style={{
              display: "none",
              flexDirection: "column",
              gap: 4,
              padding: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: 18,
                  height: 2,
                  background: "var(--color-text-secondary)",
                  borderRadius: 1,
                  transition: "transform 0.2s, opacity 0.2s",
                  ...(menuOpen && i === 0 ? { transform: "rotate(45deg) translate(4px, 4px)" } : {}),
                  ...(menuOpen && i === 1 ? { opacity: 0 } : {}),
                  ...(menuOpen && i === 2 ? { transform: "rotate(-45deg) translate(4px, -4px)" } : {}),
                }}
              />
            ))}
          </button>
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                background: "var(--color-primary)",
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "#050608", fontWeight: 700, fontSize: 11 }}>A</span>
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--color-primary)",
              }}
            >
              A-STOCK TERMINAL
            </span>
          </Link>

          <nav className="nav-links-desktop" style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {[
              { to: "/", label: "首页" },
              { to: "/learn", label: "学堂" },
              { to: "/news", label: "新闻" },
              { to: "/strategies", label: "策略" },
            ].map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} style={navLinkStyle}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: Search + Icons + Auth */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="输入代码或拼音 /"
              style={{
                width: 256,
                padding: "6px 12px 6px 40px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text)",
                background: "var(--color-surface-high)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "var(--radius-sm)",
                outline: "none",
                transition: "border-color 0.15s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(245,158,11,0.5)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)";
              }}
            />
          </div>

          <button
            style={{
              padding: 6,
              borderRadius: "var(--radius-sm)",
              transition: "background 0.15s",
              position: "relative",
              display: "flex",
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <Bell size={18} style={{ color: "var(--color-text-secondary)" }} />
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                background: "var(--color-primary)",
                borderRadius: "50%",
                border: "2px solid var(--color-surface)",
              }}
            />
          </button>

          {user ? (
            <>
              <button
                style={{
                  padding: 6,
                  borderRadius: "var(--radius-sm)",
                  transition: "background 0.15s",
                  display: "flex",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <User size={18} style={{ color: "var(--color-text-secondary)" }} />
              </button>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                {user.email}
              </span>
              <button
                onClick={logout}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  transition: "color 0.15s",
                  background: "none",
                  border: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ff4d4d")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
              >
                退出
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="btn-primary"
              style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px" }}
            >
              登录
            </Link>
          )}
        </div>
        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div
            className="nav-mobile-menu"
            style={{
              display: "none",
              position: "absolute",
              top: 56,
              left: 0,
              right: 0,
              background: "var(--color-surface)",
              borderBottom: "1px solid rgba(245,158,11,0.1)",
              padding: "16px 24px",
              flexDirection: "column",
              gap: 4,
              zIndex: 99,
            }}
          >
            {[
              { to: "/", label: "首页" },
              { to: "/learn", label: "学堂" },
              { to: "/news", label: "新闻" },
              { to: "/strategies", label: "策略" },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "10px 12px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                  background: isActive ? "rgba(245,158,11,0.08)" : "transparent",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                  transition: "background 0.1s",
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* ===== Footer ===== */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "var(--color-surface)",
          padding: "32px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, opacity: 0.5 }}>
              <div style={{ width: 16, height: 16, background: "var(--color-text-muted)", borderRadius: 2 }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-0.02em" }}>A-STOCK TERMINAL</span>
            </div>
            <p style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              &copy; 2024 A-STOCK TERMINAL. HIGH-PERFORMANCE FINANCIAL EDUCATION. MARKET DATA DELAYED BY 15 MIN.
            </p>
          </div>

          <div style={{ display: "flex", gap: 32 }}>
            {["风险提示书", "服务协议", "隐私政策", "机构合作"].map((label) => (
              <a key={label} href="#" style={{ fontSize: 12, color: "var(--color-text-muted)", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
