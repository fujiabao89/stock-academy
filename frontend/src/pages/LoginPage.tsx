import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", margin: "0 0 var(--space-2) 0" }}>
        登录
      </h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "0 0 var(--space-6) 0" }}>
        还没有账号？
        <Link to="/register" style={{ color: "var(--color-primary)", marginLeft: 4 }}>立即注册</Link>
      </p>

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-bearish-bg)",
            color: "var(--color-bearish)",
            borderRadius: "var(--radius-sm)",
            fontSize: 14,
            marginBottom: "var(--space-4)",
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "var(--space-5)" }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "10px 0",
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            background: submitting ? "var(--color-text-muted)" : "var(--color-primary)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: submitting ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {submitting ? "登录中..." : "登录"}
        </button>
      </form>

      <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
        <Link to="/" style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>← 返回首页</Link>
      </div>
    </div>
  );
}
