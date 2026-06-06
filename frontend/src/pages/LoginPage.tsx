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
      <h1 style={{
        fontSize: "clamp(22px, 3vw, 32px)",
        fontWeight: 700,
        color: "var(--color-text)",
        margin: "0 0 var(--space-2) 0",
        fontFamily: "Inter, var(--font-sans)",
        letterSpacing: "-0.01em",
      }}>
        登录
      </h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "0 0 var(--space-6) 0", fontFamily: "Inter, var(--font-sans)" }}>
        还没有账号？
        <Link to="/register" style={{ color: "var(--color-primary)", marginLeft: 4 }}>立即注册</Link>
      </p>

      <form onSubmit={handleSubmit}>
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

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "Inter, var(--font-sans)",
            color: "var(--color-muted)",
            marginBottom: "var(--space-2)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
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
              fontFamily: "Inter, var(--font-sans)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              boxSizing: "border-box",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
          />
        </div>

        <div style={{ marginBottom: "var(--space-5)" }}>
          <label style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "Inter, var(--font-sans)",
            color: "var(--color-muted)",
            marginBottom: "var(--space-2)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
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
              fontFamily: "Inter, var(--font-sans)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              boxSizing: "border-box",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
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
            fontFamily: "Inter, var(--font-sans)",
            color: "var(--color-bg)",
            background: submitting ? "var(--color-muted)" : "var(--color-primary)",
            border: "none",
            borderRadius: "var(--radius-md)",
            cursor: submitting ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {submitting ? "登录中..." : "登录"}
        </button>
      </form>

      <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
        <Link to="/" style={{ fontSize: 14, color: "var(--color-text-secondary)", fontFamily: "Inter, var(--font-sans)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}>
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}
