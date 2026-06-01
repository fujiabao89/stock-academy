import { useEffect, useRef } from "react";
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

export default function KlineChart({ data }: { data: KlineItem[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }

    const dates = data.map((d) => d.date);
    const ohlc = data.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = data.map((d) => d.volume);

    const option: echarts.EChartsOption = {
      backgroundColor: "#0F172A",
      animation: true,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: "#1E293B",
        borderColor: "#334155",
        textStyle: { color: "#F1F5F9", fontSize: 13 },
      },
      grid: [
        { left: "8%", right: "3%", top: "5%", height: "55%" },
        { left: "8%", right: "3%", top: "68%", height: "18%" },
      ],
      xAxis: [
        {
          type: "category",
          data: dates,
          gridIndex: 0,
          axisLine: { lineStyle: { color: "#334155" } },
          axisTick: { show: false },
          axisLabel: { color: "#64748B", fontSize: 11 },
        },
        {
          type: "category",
          data: dates,
          gridIndex: 1,
          axisLine: { lineStyle: { color: "#334155" } },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          scale: true,
          splitLine: { lineStyle: { color: "#1E293B" } },
          axisLabel: { color: "#64748B", fontSize: 11 },
        },
        {
          type: "value",
          gridIndex: 1,
          axisLabel: { color: "#64748B", fontSize: 11, formatter: (v: number) => v > 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e4).toFixed(0)}万` },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
          zoomOnMouseWheel: true,
          moveOnMouseWheel: false,
          moveOnMouseMove: true,
        },
        {
          type: "slider",
          xAxisIndex: [0, 1],
          bottom: 5,
          height: 24,
          borderColor: "#334155",
          backgroundColor: "#0F172A",
          fillerColor: "rgba(245, 158, 11, 0.15)",
          handleStyle: { color: "#F59E0B" },
          textStyle: { color: "#64748B" },
          start: 0,
          end: 100,
        },
      ],
      series: [
        {
          name: "K线",
          type: "candlestick",
          data: ohlc,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: "#22C55E",
            color0: "#EF4444",
            borderColor: "#22C55E",
            borderColor0: "#EF4444",
          },
        },
        {
          name: "MA5",
          type: "line",
          data: data.map((d) => d.ma5),
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#F59E0B" },
        },
        {
          name: "MA20",
          type: "line",
          data: data.map((d) => d.ma20),
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#8B5CF6" },
        },
        {
          name: "MA60",
          type: "line",
          data: data.map((d) => d.ma60),
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#64748B" },
        },
        {
          name: "MA120",
          type: "line",
          data: data.map((d) => d.ma120),
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#94A3B8" },
        },
        {
          name: "成交量",
          type: "bar",
          data: volumes,
          xAxisIndex: 1,
          yAxisIndex: 1,
          itemStyle: {
            color: (params: any) => {
              const idx = params.dataIndex;
              if (idx === 0) return "#334155";
              const prevClose = data[idx - 1].close;
              return data[idx].close >= prevClose ? "#22C55E" : "#EF4444";
            },
          },
        },
      ],
    };

    instanceRef.current.setOption(option, true);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data]);

  return (
    <div
      ref={chartRef}
      style={{
        width: "100%",
        height: 500,
        background: "var(--color-surface)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
      }}
    />
  );
}
