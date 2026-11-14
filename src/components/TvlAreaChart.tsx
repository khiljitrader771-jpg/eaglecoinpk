import * as d3 from 'd3';
import { useMemo, useState } from 'react';
import { TvlHistoryPoint } from '../types/protocol';
import { formatCompactUsd } from '../utils/format';

interface TvlAreaChartProps {
  data: TvlHistoryPoint[];
}

export function TvlAreaChart({ data }: TvlAreaChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [seriesMode, setSeriesMode] = useState<'total' | 'autolp'>('total');

  const width = 960;
  const height = 270;
  const margin = { top: 20, right: 20, bottom: 32, left: 64 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const { xScale, yScale, yTicks, areaPath, linePath, autoLpAreaPath, autoLpLinePath } =
    useMemo(() => {
      const x = d3
        .scalePoint<string>()
        .domain(data.map((d) => d.date))
        .range([margin.left, width - margin.right])
        .padding(0.1);

      const maxVal =
        d3.max(data, (d) =>
          seriesMode === 'total' ? d.totalTvlUsd : d.autoLpContributionUsd
        ) ?? 5_000_000;

      const y = d3
        .scaleLinear()
        .domain([0, maxVal * 1.12])
        .nice(5)
        .range([margin.top + plotH, margin.top]);

      const totalAreaGen = d3
        .area<TvlHistoryPoint>()
        .x((d) => x(d.date) ?? margin.left)
        .y0(y(0))
        .y1((d) =>
          y(seriesMode === 'total' ? d.totalTvlUsd : d.autoLpContributionUsd)
        )
        .curve(d3.curveMonotoneX);

      const totalLineGen = d3
        .line<TvlHistoryPoint>()
        .x((d) => x(d.date) ?? margin.left)
        .y((d) =>
          y(seriesMode === 'total' ? d.totalTvlUsd : d.autoLpContributionUsd)
        )
        .curve(d3.curveMonotoneX);

      const subAreaGen = d3
        .area<TvlHistoryPoint>()
        .x((d) => x(d.date) ?? margin.left)
        .y0(y(0))
        .y1((d) => y(d.autoLpContributionUsd))
        .curve(d3.curveMonotoneX);

      const subLineGen = d3
        .line<TvlHistoryPoint>()
        .x((d) => x(d.date) ?? margin.left)
        .y((d) => y(d.autoLpContributionUsd))
        .curve(d3.curveMonotoneX);

      return {
        xScale: x,
        yScale: y,
        yTicks: y.ticks(5),
        areaPath: totalAreaGen(data) ?? '',
        linePath: totalLineGen(data) ?? '',
        autoLpAreaPath: subAreaGen(data) ?? '',
        autoLpLinePath: subLineGen(data) ?? '',
      };
    }, [data, plotH, seriesMode]);

  const activePoint = hoverIdx !== null ? data[hoverIdx] : data[data.length - 1];
  const firstVal =
    data.length > 0
      ? seriesMode === 'total'
        ? data[0].totalTvlUsd
        : data[0].autoLpContributionUsd
      : 0;
  const latestVal =
    data.length > 0
      ? seriesMode === 'total'
        ? data[data.length - 1].totalTvlUsd
        : data[data.length - 1].autoLpContributionUsd
      : 0;
  const growthPct = firstVal > 0 ? ((latestVal - firstVal) / firstVal) * 100 : 0;

  const stepWidth = data.length > 1 ? plotW / data.length : plotW;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-600">
          <span className="font-mono tabular-nums text-slate-900 font-semibold">
            {activePoint?.date}:{' '}
            {formatCompactUsd(
              seriesMode === 'total'
                ? activePoint?.totalTvlUsd ?? 0
                : activePoint?.autoLpContributionUsd ?? 0
            )}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono tabular-nums">
            Auto-LP Share: {formatCompactUsd(activePoint?.autoLpContributionUsd ?? 0)}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono tabular-nums text-emerald-700 font-medium">
            +{growthPct.toFixed(1)}% Growth ({activePoint?.activePoolsCount ?? 0} Active Pools)
          </span>
        </div>

        <div
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          role="group"
          aria-label="TVL Chart Series"
        >
          <button
            type="button"
            onClick={() => setSeriesMode('total')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              seriesMode === 'total'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Total Pool TVL
          </button>
          <button
            type="button"
            onClick={() => setSeriesMode('autolp')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              seriesMode === 'autolp'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Auto-LP Cumulative
          </button>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="D3 Historical Total Value Locked Area Chart across Active Liquidity Pools"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="tvlAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#047857" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#047857" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="autoLpSubGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#0f172a" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Ticks */}
          {yTicks.map((tick) => {
            const yPos = yScale(tick);
            return (
              <g key={tick}>
                <line
                  x1={margin.left}
                  y1={yPos}
                  x2={width - margin.right}
                  y2={yPos}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={margin.left - 10}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {formatCompactUsd(tick)}
                </text>
              </g>
            );
          })}

          {/* Primary D3 Area + Line */}
          <path d={areaPath} fill="url(#tvlAreaGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke="#047857"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Overlaid Auto-LP Contribution Curve when viewing Total Pool TVL */}
          {seriesMode === 'total' && (
            <>
              <path d={autoLpAreaPath} fill="url(#autoLpSubGradient)" />
              <path
                d={autoLpLinePath}
                fill="none"
                stroke="#0f172a"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            </>
          )}

          {/* Data Markers, X-Axis Labels & Hover Columns */}
          {data.map((d, i) => {
            const cx = xScale(d.date) ?? margin.left;
            const yVal =
              seriesMode === 'total' ? d.totalTvlUsd : d.autoLpContributionUsd;
            const cy = yScale(yVal);
            const isHovered = hoverIdx === i;

            return (
              <g key={d.date}>
                {isHovered && (
                  <line
                    x1={cx}
                    y1={margin.top}
                    x2={cx}
                    y2={margin.top + plotH}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : 3}
                  fill={isHovered ? '#0f172a' : '#047857'}
                  stroke="#ffffff"
                  strokeWidth={1.75}
                />
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {d.date}
                </text>
                <rect
                  x={cx - stepWidth / 2}
                  y={margin.top}
                  width={stepWidth}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {seriesMode === 'total' && (
        <div className="flex flex-wrap items-center gap-5 text-[11px] text-slate-500 pt-1">
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-0.5 bg-emerald-700" />
            <span>Total Active Pool TVL</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-0.5 border-t border-dashed border-slate-900" />
            <span>Protocol Auto-LP Cumulative Injection</span>
          </span>
        </div>
      )}
    </div>
  );
}
