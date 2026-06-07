interface Props {
  width?: string | number;
  height?: string | number;
  radius?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)", style }: Props) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: "var(--color-border)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      padding: "var(--space-5)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      background: "var(--color-surface)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
    }}>
      <Skeleton width="60%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={`${85 - i * 10}%`} height={14} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-3) 0" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${40 + c * 15}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}
