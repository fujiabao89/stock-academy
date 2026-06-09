import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as echarts from "echarts";

interface MarkPointItem {
  name: string;
  coord: [string, number];
  value: string;
  symbol: string;
  symbolRotate?: number;
  symbolOffset?: [number, number];
  symbolSize: number;
  itemStyle: Record<string, string | number>;
  _pid: string;
}

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

/* ========== 技术指标 ========== */

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

function calcMACD(closes: number[]) {
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

function calcBOLL(closes: number[], period = 20, mult = 2) {
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

/* ========== 配色 ========== */

const C = {
  bg: "#050608",
  surface: "#0a0c10",
  border: "#1f2937",
  grid: "rgba(255,255,255,0.05)",
  muted: "#6b7280",
  text: "#e0e0e0",
  text2: "#9ca3af",
  bullish: "#00ff9d",
  bearish: "#ff4d4d",
  ma5: "#F59E0B",
  ma20: "#EC4899",
  ma60: "#8B5CF6",
  ma120: "#06B6D4",
  bollUpper: "#00ff9d",
  bollMid: "#F59E0B",
  bollLower: "#ff4d4d",
  dif: "#F59E0B",
  dea: "#8B5CF6",
} as const;

/* ========== 数据窗 ========== */

function DataWindow({
  item,
  prevClose,
}: {
  item: KlineItem;
  prevClose: number | null;
}) {
  const chg = prevClose != null ? ((item.close - prevClose) / prevClose) * 100 : 0;
  const chgColor = chg >= 0 ? C.bullish : C.bearish;

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        background: "rgba(5, 6, 8, 0.95)",
        border: "1px solid #1f2937",
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 12,
        lineHeight: "1.9",
        zIndex: 10,
        pointerEvents: "none",
        fontVariantNumeric: "tabular-nums",
        minWidth: 175,
        backdropFilter: "blur(6px)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {prevClose != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 6 }}>
          <span style={{ color: C.muted, fontSize: 11 }}>涨幅</span>
          <span style={{ color: chgColor, fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
            {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
          </span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>日期</span>
        <span style={{ color: C.text, fontWeight: 600 }}>{item.date}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>开</span>
        <span style={{ color: C.text }}>{item.open.toFixed(2)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>高</span>
        <span style={{ color: C.text }}>{item.high.toFixed(2)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>低</span>
        <span style={{ color: C.text }}>{item.low.toFixed(2)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>收</span>
        <span style={{ color: C.text }}>{item.close.toFixed(2)}</span>
      </div>
      <div style={{ marginTop: 2, borderTop: "1px solid #1f2937" }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <span style={{ color: C.muted }}>量</span>
        <span style={{ color: C.text }}>
          {item.volume > 1e6 ? `${(item.volume / 1e6).toFixed(1)}M` : `${(item.volume / 1e4).toFixed(0)}万`}
        </span>
      </div>

    </div>
  );
}

/* ========== 主组件 ========== */

export default function KlineChart({ data, signals = [] }: { data: KlineItem[]; signals?: SignalInfo[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const [chartH, setChartH] = useState(0);

  const [showMA, setShowMA] = useState(true);
  const [showBOLL, setShowBOLL] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dataZoomStart, setDataZoomStart] = useState<number | null>(null);
  const [dataZoomEnd, setDataZoomEnd] = useState<number | null>(null);
  const prevDataLen = useRef(data.length);

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
    const result: MarkPointItem[] = [];
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
          itemStyle: {
            color,
            borderColor: C.text,
            borderWidth: 1.5,
            shadowBlur: 4,
            shadowColor: "rgba(0,0,0,0.5)",
          },
          _pid: s.pattern_id,
        });
      }
    }
    return result;
  }, [signals, data]);

  const navigate = useNavigate();

  const buildOption = useCallback((): echarts.EChartsOption => {
    const dates = data.map((d) => d.date);
    const ohlc = data.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = data.map((d) => d.volume);
    const n = data.length;

    // 重置缩放：数据长度变化 >20 说明切换了股票或时间范围
    if (Math.abs(n - prevDataLen.current) > 20) {
      prevDataLen.current = n;
      setDataZoomStart(null);
      setDataZoomEnd(null);
    }
    prevDataLen.current = n;

    const zoomStart = dataZoomStart ?? Math.max(0, 100 - (35 / n) * 100);
    const zoomEnd = dataZoomEnd ?? 100;

    // 根据可见数据计算 Y 轴范围，确保蜡烛体足够长
    const visStart = Math.floor(n * zoomStart / 100);
    const visEnd = Math.min(n - 1, Math.ceil(n * zoomEnd / 100));
    let visLow = Infinity, visHigh = -Infinity;
    for (let i = visStart; i <= visEnd; i++) {
      if (data[i].low < visLow) visLow = data[i].low;
      if (data[i].high > visHigh) visHigh = data[i].high;
    }
    const yPad = (visHigh - visLow) * 0.18;
    const yMin = visLow - yPad;
    const yMax = visHigh + yPad;

    const series: echarts.EChartsOption["series"] = [];

    // K 线
    const prevClose = data.length > 1 ? data[data.length - 2].close : null;
    const latestClose = data.length > 0 ? data[data.length - 1].close : null;
    const latestChg = prevClose != null && latestClose != null ? ((latestClose - prevClose) / prevClose) * 100 : 0;
    const chgColor = latestChg >= 0 ? C.bullish : C.bearish;

    const candlestick: Record<string, unknown> = {
      type: "candlestick",
      name: "K",
      data: ohlc,
      xAxisIndex: 0,
      yAxisIndex: 0,
      itemStyle: {
        color: C.bullish,
        color0: C.bearish,
        borderColor: "#00cc7d",
        borderColor0: "#cc0000",
        borderWidth: 1,
      },
      barWidth: "72%",
      barMaxWidth: 28,
    };
    if (markPoints.length > 0) {
      candlestick.markPoint = {
        data: markPoints,
        symbol: "arrow",
        symbolSize: 14,
        animation: false,
        tooltip: {
          trigger: "item",
          formatter: (p: { data: { value: string } }) => p.data.value,
        },
      };
    }
    // 昨收参考线 + 最新价标注
    if (prevClose != null) {
      const lines: Record<string, unknown>[] = [
        {
          yAxis: prevClose,
          lineStyle: { color: "rgba(255,255,255,0.3)", type: "dashed" as const, width: 1 },
          label: {
            show: true,
            position: "end" as const,
            formatter: `昨收 ${prevClose.toFixed(2)}`,
            color: C.text2,
            fontSize: 11,
            padding: [0, 0, 0, 4],
          },
        },
      ];
      if (latestClose != null) {
        lines.push({
          yAxis: latestClose,
          lineStyle: { color: chgColor, type: "solid" as const, width: 1.5 },
          label: {
            show: true,
            position: "end" as const,
            formatter: `${latestClose.toFixed(2)}  ${latestChg >= 0 ? "+" : ""}${latestChg.toFixed(2)}%`,
            color: chgColor,
            fontSize: 11,
            fontWeight: "bold" as const,
            padding: [0, 0, 0, 4],
          },
        });
      }
      candlestick.markLine = { silent: true, symbol: "none", data: lines };
    }
    series.push(candlestick);

    // MA
    if (showMA) {
      const mas: [string, string, (number | null)[]][] = [
        ["MA5", C.ma5, data.map((d) => d.ma5)],
        ["MA20", C.ma20, data.map((d) => d.ma20)],
        ["MA60", C.ma60, data.map((d) => d.ma60)],
        ["MA120", C.ma120, data.map((d) => d.ma120)],
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
          emphasis: { lineStyle: { width: 2 } },
        });
      }
    }

    // BOLL
    if (showBOLL) {
      series.push(
        {
          type: "line", name: "BOLL上轨", data: boll.upper,
          xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: C.bollUpper, type: "dashed" },
        },
        {
          type: "line", name: "BOLL中轨", data: boll.middle,
          xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: C.bollMid, type: "dashed" },
        },
        {
          type: "line", name: "BOLL下轨", data: boll.lower,
          xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: C.bollLower, type: "dashed" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(0, 255, 157, 0.04)" },
              { offset: 1, color: "rgba(255, 77, 77, 0.04)" },
            ]),
          },
        },
      );
    }

    // 成交量
    series.push({
      type: "bar",
      name: "VOL",
      data: volumes.map((v, i) => {
        const up = i === 0 || data[i].close >= data[i - 1].close;
        return {
          value: v,
          itemStyle: {
            color: up ? "rgba(0, 255, 157, 0.45)" : "rgba(255, 77, 77, 0.45)",
          },
        };
      }),
      xAxisIndex: 1,
      yAxisIndex: 1,
    });

    // MACD
    series.push(
      {
        type: "line", name: "DIF", data: macd.dif,
        xAxisIndex: 2, yAxisIndex: 2, showSymbol: false,
        lineStyle: { width: 1, color: C.dif },
      },
      {
        type: "line", name: "DEA", data: macd.dea,
        xAxisIndex: 2, yAxisIndex: 2, showSymbol: false,
        lineStyle: { width: 1, color: C.dea },
      },
      {
        type: "bar", name: "MACD+",
        data: macd.histogram.map((v) => (v != null && v >= 0 ? v : null)),
        xAxisIndex: 2, yAxisIndex: 2,
        itemStyle: { color: "rgba(0, 255, 157, 0.55)" },
      },
      {
        type: "bar", name: "MACD-",
        data: macd.histogram.map((v) => (v != null && v < 0 ? v : null)),
        xAxisIndex: 2, yAxisIndex: 2,
        itemStyle: { color: "rgba(255, 77, 77, 0.55)" },
      },
    );

    return {
      backgroundColor: C.bg,
      animation: true,
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          crossStyle: { color: C.muted },
          lineStyle: { color: "rgba(255,255,255,0.08)", type: "dashed", width: 1 },
        },
        backgroundColor: "rgba(5, 6, 8, 0.95)",
        borderColor: "#1f2937",
        textStyle: { color: C.text, fontSize: 12 },
      },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [
        { left: "8%", right: "2%", top: "18%", height: "58%" },
        { left: "8%", right: "2%", top: "80%", height: "8%" },
        { left: "8%", right: "2%", top: "90%", height: "6%" },
      ],
      xAxis: [
        {
          type: "category", data: dates, gridIndex: 0,
          axisLine: { lineStyle: { color: C.border } },
          axisTick: { show: false },
          axisLabel: { color: C.muted, fontSize: 11 },
        },
        {
          type: "category", data: dates, gridIndex: 1,
          axisLine: { lineStyle: { color: C.border } },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
        {
          type: "category", data: dates, gridIndex: 2,
          axisLine: { lineStyle: { color: C.border } },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
      ],
      yAxis: [
        {
          type: "value", gridIndex: 0, min: yMin, max: yMax,
          splitNumber: 6,
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)", width: 0.5 } },
          axisLabel: { color: C.text2, fontSize: 11 },
          nameTextStyle: { color: C.muted },
        },
        {
          type: "value", gridIndex: 1,
          axisLabel: {
            color: C.muted, fontSize: 10,
            formatter: (v: number) => v > 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e4).toFixed(0)}万`,
          },
          splitLine: { show: false },
        },
        {
          type: "value", gridIndex: 2, scale: true,
          splitLine: { lineStyle: { color: C.grid, width: 0.5 } },
          axisLabel: { color: C.muted, fontSize: 10 },
        },
      ],
      dataZoom: [
        {
          type: "inside", xAxisIndex: [0, 1, 2],
          zoomOnMouseWheel: true, moveOnMouseWheel: false, moveOnMouseMove: true,
        },
      ],
      series,
    };
  }, [data, showMA, showBOLL, boll, macd, markPoints]);

  useEffect(() => {
    if (!chartRef.current || data.length === 0 || chartH === 0) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, null, { renderer: "svg" });
    }
    instanceRef.current.setOption(buildOption(), true);
  }, [buildOption, data, chartH]);

  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;

    const onMouseOver = (params: Record<string, unknown>) => {
      if (params.dataIndex != null) setHoveredIndex(params.dataIndex as number);
    };
    const onMouseOut = () => setHoveredIndex(null);
    const onClick = (params: Record<string, unknown>) => {
      if (params.componentType === "markPoint") {
        const data = params.data as Record<string, unknown> | undefined;
        const patternId = data?._pid as string | undefined;
        if (patternId) navigate(`/learn/patterns/${patternId}`);
        return;
      }
      if (params.dataIndex != null) {
        const idx = params.dataIndex as number;
        setPinnedIndex((prev) => (prev === idx ? null : idx));
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinnedIndex(null);
    };
    const onDataZoom = (...args: unknown[]) => {
      const params = args[0] as Record<string, unknown>;
      const batch = (params.batch as Array<{ start: number; end: number }>) || [params];
      for (const z of batch) {
        if (z.start != null) setDataZoomStart(z.start as number);
        if (z.end != null) setDataZoomEnd(z.end as number);
      }
    };

    inst.on("mouseover", onMouseOver);
    inst.on("mouseout", onMouseOut);
    inst.on("click", onClick);
    inst.on("dataZoom", onDataZoom);
    window.addEventListener("keydown", onKeyDown);

    const onResize = () => inst.resize();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => inst.resize());
    if (chartRef.current) ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      inst.off("mouseover", onMouseOver);
      inst.off("mouseout", onMouseOut);
      inst.off("click", onClick);
      inst.off("dataZoom", onDataZoom);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [navigate]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setChartH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (chartH > 0) instanceRef.current?.resize();
  }, [chartH]);

  const activeIndex = pinnedIndex ?? hoveredIndex;

  // 最新行情摘要（同花顺式价格头栏）
  const latestBar = data.length > 0 ? data[data.length - 1] : null;
  const prevBar = data.length > 1 ? data[data.length - 2] : null;
  const priceChg = latestBar && prevBar ? latestBar.close - prevBar.close : 0;
  const priceChgPct = latestBar && prevBar ? ((latestBar.close - prevBar.close) / prevBar.close) * 100 : 0;
  const priceColor = priceChg >= 0 ? C.bullish : C.bearish;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* 价格头栏 + 指标切换（同行，同花顺式紧凑布局） */}
      {latestBar && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 2, padding: "2px 8px", flexShrink: 0,
          background: C.surface, border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: priceColor, fontFamily: "var(--font-mono)", lineHeight: 1 }}>
              {latestBar.close.toFixed(2)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: priceColor, fontFamily: "var(--font-mono)" }}>
              {priceChg >= 0 ? "+" : ""}{priceChg.toFixed(2)}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: priceColor, fontFamily: "var(--font-mono)",
              background: priceColor + "18", padding: "1px 5px", borderRadius: 3,
            }}>
              {priceChgPct >= 0 ? "+" : ""}{priceChgPct.toFixed(2)}%
            </span>
            <span style={{ color: C.muted, fontSize: 10 }}>
              {[
                ["开", latestBar.open],
                ["高", latestBar.high],
                ["低", latestBar.low],
                ["昨收", prevBar?.close],
              ].map(([label, val]) => (
                <span key={label} style={{ marginLeft: 8 }}>
                  <span style={{ color: C.muted }}>{label} </span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{val != null ? (val as number).toFixed(2) : "-"}</span>
                </span>
              ))}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {([
              ["MA", showMA, () => setShowMA((v) => !v), C.ma5],
              ["BOLL", showBOLL, () => setShowBOLL((v) => !v), C.bollMid],
            ] as [string, boolean, () => void, string][]).map(([label, active, toggle, color]) => (
              <button
                key={label}
                onClick={toggle}
                style={{
                  padding: "1px 8px",
                  fontSize: 10,
                  fontWeight: 500,
                  borderRadius: 3,
                  border: `1px solid ${active ? color : "transparent"}`,
                  background: active ? `${color}18` : "transparent",
                  color: active ? color : C.muted,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 图表 */}
      <div ref={areaRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div
          ref={chartRef}
          style={{
            width: "100%",
            height: chartH > 0 ? chartH : "100%",
            background: C.bg,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        />
        {activeIndex != null && data[activeIndex] && (
          <DataWindow
            item={data[activeIndex]}
            prevClose={activeIndex > 0 ? data[activeIndex - 1].close : null}
          />
        )}
      </div>
    </div>
  );
}
