import { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface DistributionBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

interface Props {
  bins: DistributionBin[];
  randomBaseline?: {
    win_rate: number | null;
    avg_return: number | null;
    occurrences: number;
  } | null;
}

const C = {
  bg: "#0F172A",
  surface: "#1E293B",
  border: "#334155",
  muted: "#94A3B8",
  text: "#F1F5F9",
  text2: "#CBD5E1",
  primary: "#F59E0B",
  primaryBright: "#FBBF24",
  baseline: "#64748B",
};

export default function DistributionBar({ bins, randomBaseline }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !bins || bins.length === 0) return;

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, null, { renderer: "svg" });
    }

    const labels = bins.map((b) => {
      const s = b.bin_start * 100;
      const e = b.bin_end * 100;
      return `${s >= 0 ? "+" : ""}${s.toFixed(0)}% ~ ${e >= 0 ? "+" : ""}${e.toFixed(0)}%`;
    });

    const data = bins.map((b) => b.count);
    const maxCount = Math.max(...data, 1);

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: C.surface,
        borderColor: C.border,
        textStyle: { color: C.text, fontSize: 13 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p.dataIndex;
          const bin = bins[idx];
          return `
            <div style="font-weight:600;margin-bottom:4px">${labels[idx]}</div>
            <div>样本数: <b>${bin.count.toLocaleString()}</b></div>
            <div>占比: <b>${((bin.count / bins.reduce((s, b) => s + b.count, 0)) * 100).toFixed(1)}%</b></div>
          `;
        },
      },
      grid: { left: 64, right: 24, top: 28, bottom: 48 },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: C.border } },
        axisTick: { show: false },
        axisLabel: {
          color: C.muted,
          fontSize: 11,
          rotate: 35,
          interval: "auto",
          formatter: (v: string) => v.split(" ~ ")[0],
        },
      },
      yAxis: {
        type: "value",
        name: "样本数",
        nameTextStyle: { color: C.muted, fontSize: 12 },
        axisLabel: { color: C.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: C.border, width: 0.5 } },
      },
      series: [
        {
          type: "bar",
          data: data.map((count, i) => {
            const bin = bins[i];
            const ratio = count / maxCount;
            return {
              value: count,
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: `rgba(245, 158, 11, ${0.55 + ratio * 0.45})` },
                  { offset: 1, color: `rgba(245, 158, 11, ${0.3 + ratio * 0.35})` },
                ]),
                borderRadius: [4, 4, 0, 0],
                borderColor: bin.bin_start >= 0.03
                  ? "rgba(16, 185, 129, 0.6)"
                  : bin.bin_end <= 0.03
                    ? "rgba(239, 68, 68, 0.5)"
                    : "rgba(148, 163, 184, 0.4)",
                borderWidth: 0.5,
              },
              _bin: bin,
            };
          }),
          barMaxWidth: 48,
          emphasis: {
            itemStyle: { color: C.primaryBright },
          },
          markLine: randomBaseline?.win_rate != null ? {
            silent: true,
            symbol: "none",
            lineStyle: { color: C.baseline, type: "dashed", width: 2 },
            label: {
              color: C.baseline,
              fontSize: 12,
              fontWeight: 600,
              formatter: `随机基线 ${(randomBaseline.win_rate * 100).toFixed(1)}%`,
              position: "insideEndTop",
            },
            data: [
              {
                yAxis: Math.round(randomBaseline.win_rate * bins.reduce((s, b) => s + b.count, 0)),
                name: "随机入场基线",
              },
            ],
          } : undefined,
        },
      ],
    };

    instanceRef.current.setOption(option, true);
  }, [bins, randomBaseline]);

  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    const onResize = () => inst.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-3)" }}>
        收益分布
        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-muted)", marginLeft: "var(--space-2)" }}>
          （信号发出后 20 个交易日的实际收益统计）
        </span>
      </div>
      <div
        ref={chartRef}
        style={{
          width: "100%",
          height: 320,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
        }}
      />
      <div style={{
        fontSize: 12, color: "var(--color-disclaimer)", fontStyle: "italic",
        marginTop: "var(--space-2)", paddingLeft: "var(--space-3)",
        borderLeft: "2px solid var(--color-disclaimer-border)", lineHeight: 1.6,
      }}>
        历史统计不构成投资建议。每个柱子代表信号发出后 20 日内实际收益落在该区间的次数。
        虚线为随机入场基线：从所有有效交易日中随机抽取同等数量样本的胜率。
      </div>
    </div>
  );
}
