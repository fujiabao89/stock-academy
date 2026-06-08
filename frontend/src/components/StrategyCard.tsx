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
        padding: "var(--space-4)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface)",
        opacity: strategy.enabled ? 1 : 0.5,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--color-text)" }}>
            {strategy.name}
            {strategy.is_builtin && (
              <span style={{ fontSize: 11, color: "var(--color-primary)", marginLeft: "var(--space-2)", fontWeight: 400 }}>
                内置
              </span>
            )}
            {!strategy.enabled && (
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: "var(--space-2)", fontWeight: 400 }}>
                已禁用
              </span>
            )}
          </h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "var(--space-1) 0 0 0" }}>
            {strategy.description}
          </p>
        </div>
        {onRun && (
          <button
            onClick={() => onRun(strategy.id)}
            disabled={running || !strategy.enabled}
            style={{
              padding: "4px 12px",
              fontSize: 13,
              fontWeight: 500,
              color: "#fff",
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
              color: "var(--color-text-secondary)",
              background: "var(--color-bg)",
              padding: "2px 8px",
              borderRadius: 4,
              fontFamily: "monospace",
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
