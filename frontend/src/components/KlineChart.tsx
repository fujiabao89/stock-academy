import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as echarts from "echarts";

interface KlineItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
}

interface SignalInfo {
  code: string;
  date: string;
  pattern_id: string;
  pattern_name: string;
  category: string;
  direction: string;
  confidence: number;
  description: string;
  backtest: { win_rate: number; avg_return: number; occurrences: number } | null;
  limitations: string[];
  related_patterns: string[];
}

/* ========== 技术指标计算 ========== */

function ema(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = new Array(prices.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  out[period - 1] = sum / period;
  for (let i = period; i < prices.length; i++) {
    out[i] = prices[i] * k + (out[i - 1] ?? 0) * (1 - k);
  }
  return out;
}

function calcMACD(closes: number[]): {
  dif: (number | null)[];
  dea: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const n = closes.length;
  const dif: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (ema12[i] != null && ema26[i] != null) dif[i] = ema12[i]! - ema26[i]!;
  }

  const difClean = dif.filter((v): v is number => v != null);
  const deaRaw = ema(difClean, 9);
  const dea: (number | null)[] = new Array(n).fill(null);
  let offset = 0;
  for (let i = 0; i < n; i++) {
    if (dif[i] == null) { offset++; continue; }
    const di = i - offset;
    if (di >= 8) dea[i] = deaRaw[di];
  }

  const histogram: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (dif[i] != null && dea[i] != null) {
      histogram[i] = +(2 * (dif[i]! - dea[i]!)).toFixed(4);
    }
  }

  return { dif, dea, histogram };
}

function calcBOLL(
  closes: number[],
  period = 20,
  mult = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const n = closes.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const middle: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    middle[i] = +mean.toFixed(3);
    upper[i] = +(mean + mult * std).toFixed(3);
    lower[i] = +(mean - mult * std).toFixed(3);
  }
  return { upper, middle, lower };
}

/* ========== 颜色常量 ========== */

const C = {
  bg: "#0F172A",
  surface: "#1E293B",
  border: "#334155",
  muted: "#64748B",
  text: "#F1F5F9",
  text2: "#94A3B8",
  primary: "#F59E0B",
  accent: "#8B5CF6",
  bullish: "#EF4444",
  bearish: "#22C55E",
} as const;

/* ========== 数据窗口组件 ========== */

function DataWindow({
  item,
  prevClose,
  macd,
  boll,
  idx,
}: {
  item: KlineItem;
  prevClose: number | null;
  macd: ReturnType<typeof calcMACD>;
  boll: ReturnType<typeof calcBOLL>;
  idx: number;
}) {
  const chg = prevClose != null ? ((item.close - prevClose) / prevClose) * 100 : 0;
  const chgColor = chg >= 0 ? C.bullish : C.bearish;

  const rows: [string, string, string?][] = [
    ["日期", item.date],
    ["开盘", item.open.toFixed(2)],
    ["最高", item.high.toFixed(2)],
    ["最低", item.low.toFixed(2)],
    ["收盘", item.close.toFixed(2)],
  ];

  if (prevClose != null) {
    rows.push(["涨幅", `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`, chgColor]);
  }
  rows.push(
    ["成交量", item.volume > 1e6 ? `${(item.volume / 1e6).toFixed(1)}M` : `${(item.volume / 1e4).toFixed(0)}万`],
    ["MA5", item.ma5?.toFixed(2) ?? "-"],
    ["MA20", item.ma20?.toFixed(2) ?? "-"],
    ["MA60", item.ma60?.toFixed(2) ?? "-"],
    ["MA120", item.ma120?.toFixed(2) ?? "-"],
    ["BOLL上轨", boll.upper[idx]?.toFixed(2) ?? "-"],
    ["BOLL中轨", boll.middle[idx]?.toFixed(2) ?? "-"],
    ["BOLL下轨", boll.lower[idx]?.toFixed(2) ?? "-"],
    ["MACD DIF", macd.dif[idx]?.toFixed(4) ?? "-"],
    ["MACD DEA", macd.dea[idx]?.toFixed(4) ?? "-"],
    ["MACD 柱", macd.histogram[idx]?.toFixed(4) ?? "-"],
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: "rgba(15, 23, 42, 0.92)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 14px",
        fontSize: 12,
        lineHeight: "1.8",
        zIndex: 10,
        pointerEvents: "none",
        fontVariantNumeric: "tabular-nums",
        minWidth: 170,
        backdropFilter: "blur(4px)",
      }}
    >
      {rows.map(([label, value, color]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
          <span style={{ color: color ?? "var(--color-text)", fontWeight: label === "日期" ? 600 : 400 }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ========== 主组件 ========== */

export default function KlineChart({ data, signals = [] }: { data: KlineItem[]; signals?: SignalInfo[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  const [showMA, setShowMA] = useState(true);
  const [showBOLL, setShowBOLL] = useState(true);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const closes = useMemo(() => data.map((d) => d.close), [data]);
  const macd = useMemo(() => calcMACD(closes), [closes]);
  const boll = useMemo(() => calcBOLL(closes), [closes]);

  const markPoints = useMemo(() => {
    if (signals.length === 0) return [];
    const dates = data.map((d) => d.date);
    const byDate = new Map<string, SignalInfo[]>();
    for (const s of signals) {
      const arr = byDate.get(s.date) || [];
      arr.push(s);
      byDate.set(s.date, arr);
    }
    const result: any[] = [];
    for (const [date, sigs] of byDate) {
      const idx = dates.indexOf(date);
      if (idx === -1) continue;
      const bar = data[idx];
      let bullCount = 0, bearCount = 0;
      for (const s of sigs) {
        const isBull = s.direction === "bullish";
        const step = isBull ? bullCount : bearCount;
        const color = isBull ? C.bullish : C.bearish;
        const offset: [number, number] = isBull
          ? [step * 6, -(step * 22 + 18)]
          : [step * 6, step * 22 + 18];
        if (isBull) bullCount++;
        else bearCount++;
        result.push({
          name: s.pattern_name,
          coord: [date, isBull ? bar.high : bar.low],
          value: s.pattern_name,
          symbol: "arrow",
          symbolRotate: isBull ? 0 : 180,
          symbolSize: 14,
          symbolOffset: offset,
          itemStyle: { color, borderColor: "#F1F5F9", borderWidth: 1, shadowBlur: 3, shadowColor: "rgba(0,0,0,0.4)" },
          _pid: s.pattern_id,
        });
      }
    }
    return result;
  }, [signals, data]);

  const navigate = useNavigate();

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }

    const dates = data.map((d) => d.date);
    const ohlc = data.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = data.map((d) => d.volume);
    const n = data.length;

    const series: echarts.EChartsOption["series"] = [];

    // ---- Grid 0: K 线 ----
    const candlestick: any = {
      type: "candlestick",
      name: "K线",
      data: ohlc,
      xAxisIndex: 0,
      yAxisIndex: 0,
      itemStyle: { color: C.bullish, color0: C.bearish, borderColor: C.bullish, borderColor0: C.bearish },
    };
    if (markPoints.length > 0) {
      candlestick.markPoint = {
        data: markPoints,
        symbol: "arrow",
        symbolSize: 14,
        animation: false,
        tooltip: {
          trigger: "item",
          formatter: (p: any) => `${p.data.value}`,
        },
      };
    }
    series.push(candlestick);

    // MA 均线
    if (showMA) {
      const mas: [string, string, (number | null)[]][] = [
        ["MA5", C.primary, data.map((d) => d.ma5)],
        ["MA20", C.accent, data.map((d) => d.ma20)],
        ["MA60", C.muted, data.map((d) => d.ma60)],
        ["MA120", C.text2, data.map((d) => d.ma120)],
      ];
      for (const [name, color, values] of mas) {
        series.push({
          type: "line",
          name,
          data: values,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color },
        });
      }
    }

    // BOLL 布林带
    if (showBOLL) {
      series.push(
        {
          type: "line",
          name: "BOLL上轨",
          data: boll.upper,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#F87171", type: "dashed" },
        },
        {
          type: "line",
          name: "BOLL中轨",
          data: boll.middle,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#FBBF24", type: "dashed" },
        },
        {
          type: "line",
          name: "BOLL下轨",
          data: boll.lower,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#34D399", type: "dashed" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(248, 113, 113, 0.06)" },
              { offset: 1, color: "rgba(52, 211, 153, 0.06)" },
            ]),
          },
        },
      );
    }

    // ---- Grid 1: 成交量 ----
    series.push({
      type: "bar",
      name: "成交量",
      data: volumes.map((v, i) => {
        if (i === 0) return { value: v, itemStyle: { color: C.border } };
        const up = data[i].close >= data[i - 1].close;
        return { value: v, itemStyle: { color: up ? C.bullish : C.bearish } };
      }),
      xAxisIndex: 1,
      yAxisIndex: 1,
    });

    // ---- Grid 2: MACD ----
    series.push(
      {
        type: "line",
        name: "DIF",
        data: macd.dif,
        xAxisIndex: 2,
        yAxisIndex: 2,
        showSymbol: false,
        lineStyle: { width: 1, color: "#F59E0B" },
      },
      {
        type: "line",
        name: "DEA",
        data: macd.dea,
        xAxisIndex: 2,
        yAxisIndex: 2,
        showSymbol: false,
        lineStyle: { width: 1, color: "#8B5CF6" },
      },
      {
        type: "bar",
        name: "MACD+",
        data: macd.histogram.map((v) => (v != null && v >= 0 ? v : null)),
        xAxisIndex: 2,
        yAxisIndex: 2,
        itemStyle: { color: C.bullish },
        barWidth: "60%",
      },
      {
        type: "bar",
        name: "MACD-",
        data: macd.histogram.map((v) => (v != null && v < 0 ? v : null)),
        xAxisIndex: 2,
        yAxisIndex: 2,
        itemStyle: { color: C.bearish },
        barWidth: "60%",
      },
    );

    const option: echarts.EChartsOption = {
      backgroundColor: C.bg,
      animation: true,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", lineStyle: { type: "dashed", color: "#64748B", width: 1 } },
        backgroundColor: C.surface,
        borderColor: C.border,
        textStyle: { color: C.text, fontSize: 12 },
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
      },
      grid: [
        { left: "8%", right: "3%", top: "5%", height: "42%" },
        { left: "8%", right: "3%", top: "52%", height: "16%" },
        { left: "8%", right: "3%", top: "73%", height: "12%" },
      ],
      xAxis: [
        { type: "category", data: dates, gridIndex: 0, axisLine: { lineStyle: { color: C.border } }, axisTick: { show: false }, axisLabel: { color: C.muted, fontSize: 11 } },
        { type: "category", data: dates, gridIndex: 1, axisLine: { lineStyle: { color: C.border } }, axisTick: { show: false }, axisLabel: { show: false } },
        { type: "category", data: dates, gridIndex: 2, axisLine: { lineStyle: { color: C.border } }, axisTick: { show: false }, axisLabel: { show: false } },
      ],
      yAxis: [
        {
          type: "value", gridIndex: 0, scale: true,
          splitLine: { lineStyle: { color: C.surface } },
          axisLabel: { color: C.muted, fontSize: 11 },
        },
        {
          type: "value", gridIndex: 1,
          axisLabel: { color: C.muted, fontSize: 11, formatter: (v: number) => v > 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e4).toFixed(0)}万` },
          splitLine: { show: false },
        },
        {
          type: "value", gridIndex: 2, scale: true,
          splitLine: { lineStyle: { color: C.surface } },
          axisLabel: { color: C.muted, fontSize: 10 },
        },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1, 2], zoomOnMouseWheel: true, moveOnMouseWheel: false, moveOnMouseMove: true },
        {
          type: "slider", xAxisIndex: [0, 1, 2], bottom: 2, height: 20,
          borderColor: C.border, backgroundColor: C.bg,
          fillerColor: "rgba(245, 158, 11, 0.15)", handleStyle: { color: C.primary },
          textStyle: { color: C.muted, fontSize: 10 },
          start: Math.max(0, 100 - (80 / n) * 100), end: 100,
        },
      ],
      series,
    };

    instanceRef.current.setOption(option, true);
  }, [data, showMA, showBOLL, boll, macd, markPoints]);

  // 十字光标 + 数据窗口事件
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;

    const onMouseOver = (params: any) => {
      if (params.dataIndex != null) setHoveredIndex(params.dataIndex);
    };
    const onMouseOut = () => setHoveredIndex(null);
    const onClick = (params: any) => {
      if (params.componentType === "markPoint") {
        const patternId = params.data?._pid;
        if (patternId) navigate(`/learn/patterns/${patternId}`);
        return;
      }
      if (params.dataIndex != null) {
        setPinnedIndex((prev) => (prev === params.dataIndex ? null : params.dataIndex));
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinnedIndex(null);
    };

    inst.on("mouseover", onMouseOver);
    inst.on("mouseout", onMouseOut);
    inst.on("click", onClick);
    window.addEventListener("keydown", onKeyDown);

    const handleResize = () => inst.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      inst.off("mouseover", onMouseOver);
      inst.off("mouseout", onMouseOut);
      inst.off("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const activeIndex = pinnedIndex ?? hoveredIndex;

  return (
    <div style={{ position: "relative" }}>
      {/* 指标切换按钮 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {([
          ["MA", showMA, () => setShowMA((v) => !v)],
          ["BOLL", showBOLL, () => setShowBOLL((v) => !v)],
        ] as [string, boolean, () => void][]).map(([label, active, toggle]) => (
          <button
            key={label}
            onClick={toggle}
            style={{
              padding: "3px 12px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
              background: active ? "rgba(245, 158, 11, 0.1)" : "var(--color-surface)",
              color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: 11, color: "var(--color-muted)", marginLeft: "auto", alignSelf: "center" }}>
          点击 K 线固定数据窗 · Esc 取消
        </span>
      </div>

      {/* 图表 */}
      <div style={{ position: "relative" }}>
        <div
          ref={chartRef}
          style={{
            width: "100%",
            height: "var(--chart-height)",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
          }}
        />
        {activeIndex != null && data[activeIndex] && (
          <DataWindow
            item={data[activeIndex]}
            prevClose={activeIndex > 0 ? data[activeIndex - 1].close : null}
            macd={macd}
            boll={boll}
            idx={activeIndex}
          />
        )}
      </div>
    </div>
  );
}
