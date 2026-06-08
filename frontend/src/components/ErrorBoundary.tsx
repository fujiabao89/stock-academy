import { Component } from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          padding: "var(--space-8)",
          textAlign: "center",
        }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--color-text)",
            margin: "0 0 var(--space-3) 0",
            fontFamily: "Inter, var(--font-sans)",
          }}>
            页面出错了
          </h1>
          <p style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            margin: "0 0 var(--space-5) 0",
            fontFamily: "Inter, var(--font-sans)",
            maxWidth: 400,
            lineHeight: 1.6,
          }}>
            遇到了意外错误，请刷新页面重试。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "Inter, var(--font-sans)",
              color: "var(--color-bg)",
              background: "var(--color-primary)",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
            }}
          >
            刷新页面
          </button>
          <details style={{
            marginTop: "var(--space-6)",
            fontSize: 12,
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
            maxWidth: 500,
            textAlign: "left",
          }}>
            <summary style={{ cursor: "pointer", marginBottom: "var(--space-2)" }}>
              错误详情
            </summary>
            <pre style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              background: "var(--color-surface)",
              padding: "var(--space-3)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
            }}>
              {this.state.error.message}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
