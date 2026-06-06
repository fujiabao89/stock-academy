interface StrategyCondition {
  field: string;
  operator: string;
  value: number | null;
  field2: string | null;
  pattern_id: string | null;
}

interface Strategy {
  id: number;
  name: string;
  description: string;
  conditions: StrategyCondition[];
  is_builtin: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  strategy: Strategy;
  onRun?: (id: number) => void;
  running?: boolean;
}

function opLabel(op: string): string {
  const map: Record<string, string> = {
    gt: ">",
    lt: "<",
    eq: "=",
    cross_above: "上穿",
    cross_below: "下穿",
    pattern: "形态",
  };
  return map[op] ?? op;
}

function condText(c: StrategyCondition): string {
  if (c.operator === "pattern") return `形态: ${c.pattern_id ?? "?"}`;
  if (c.field2 && (c.value == null || c.value === 0))
    return `${c.field} ${opLabel(c.operator)} ${c.field2}`;
  if (c.value != null) return `${c.field} ${opLabel(c.operator)} ${c.value}`;
  return `${c.field} ${opLabel(c.operator)}`;
}

export default function StrategyCard({ strategy, onRun, running }: Props) {
  return (
    <div
      style={{
        padding: "var(--space-5)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface)",
        opacity: strategy.enabled ? 1 : 0.5,
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-primary)";
        e.currentTarget.style.background = "var(--color-surface-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.background = "var(--color-surface)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "Inter, var(--font-sans)" }}>
            {strategy.name}
            {strategy.is_builtin && (
              <span style={{
                fontSize: 11,
                fontFamily: "Inter, var(--font-sans)",
                color: "var(--color-primary)",
                marginLeft: "var(--space-2)",
                fontWeight: 400,
                padding: "1px 6px",
                border: "1px solid var(--color-primary)",
                borderRadius: "var(--radius-sm)",
              }}>
                内置
              </span>
            )}
            {!strategy.enabled && (
              <span style={{ fontSize: 11, color: "var(--color-muted)", marginLeft: "var(--space-2)", fontWeight: 400, fontFamily: "Inter, var(--font-sans)" }}>
                已禁用
              </span>
            )}
          </h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "var(--space-1) 0 0 0", fontFamily: "Inter, var(--font-sans)" }}>
            {strategy.description}
          </p>
        </div>
        {onRun && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRun(strategy.id);
            }}
            disabled={running || !strategy.enabled}
            style={{
              padding: "4px 14px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "Inter, var(--font-sans)",
              color: "var(--color-bg)",
              background: "var(--color-primary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: running ? "wait" : "pointer",
              whiteSpace: "nowrap",
              opacity: running || !strategy.enabled ? 0.6 : 1,
            }}
          >
            {running ? "扫描中..." : "扫描"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {strategy.conditions.map((c, i) => (
          <span
            key={i}
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-secondary)",
              background: "var(--color-bg)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
            }}
          >
            {condText(c)}
          </span>
        ))}
      </div>
    </div>
  );
}

export type { Strategy, StrategyCondition };
