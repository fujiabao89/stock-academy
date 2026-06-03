const GRADE_STYLES: Record<string, { color: string; bg: string; tooltip: string }> = {
  A: {
    color: "var(--color-confidence-a)",
    bg: "var(--color-confidence-a-bg)",
    tooltip: "高置信度 — 样本充足且胜率稳定",
  },
  B: {
    color: "var(--color-confidence-b)",
    bg: "var(--color-confidence-b-bg)",
    tooltip: "中等置信度 — 有一定参考价值，样本量尚可",
  },
  C: {
    color: "var(--color-confidence-c)",
    bg: "var(--color-confidence-c-bg)",
    tooltip: "低置信度 — 样本量有限，统计仅供参考",
  },
};

interface Props {
  grade: string | null;
}

export default function ConfidenceBadge({ grade }: Props) {
  if (!grade) return null;

  const style = GRADE_STYLES[grade] ?? GRADE_STYLES.C;

  return (
    <span
      title={style.tooltip}
      aria-label={`信心等级 ${grade}：${style.tooltip}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        color: style.color,
        background: style.bg,
        borderRadius: "var(--radius-sm)",
        cursor: "default",
        flexShrink: 0,
      }}
    >
      {grade}
    </span>
  );
}
