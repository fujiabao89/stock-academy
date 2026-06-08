import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("两次密码输入不一致");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 个字符");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", margin: "0 0 var(--space-2) 0" }}>
        注册
      </h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "0 0 var(--space-6) 0" }}>
        已有账号？
        <Link to="/login" style={{ color: "var(--color-primary)", marginLeft: 4 }}>立即登录</Link>
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

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
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
            确认密码
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
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
          {submitting ? "注册中..." : "注册"}
        </button>
      </form>

      <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
        <Link to="/" style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>← 返回首页</Link>
      </div>
    </div>
  );
}
