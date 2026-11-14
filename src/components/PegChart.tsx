import { useState } from 'react';
import { PegHistoryPoint } from '../types/protocol';
import { formatCompactUsd, formatPegPrice } from '../utils/format';

interface PegChartProps {
  data: PegHistoryPoint[];
  guardBandBps: number;
}

export function PegChart({ data, guardBandBps }: PegChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 720;
  const height = 260;
  const padLeft = 56;
  const padRight = 18;
  const padTop = 22;
  const padBottom = 32;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minPrice = 0.995;
  const maxPrice = 1.005;
  const guardDelta = guardBandBps / 10000;
  const upperGuard = 1 + guardDelta;
  const lowerGuard = 1 - guardDelta;

  const yForPrice = (p: number) => {
    const clamped = Math.max(minPrice, Math.min(maxPrice, p));
    const ratio = (clamped - minPrice) / (maxPrice - minPrice);
    return padTop + plotH - ratio * plotH;
  };

  const xForIndex = (i: number) => {
    if (data.length <= 1) return padLeft;
    return padLeft + (i / (data.length - 1)) * plotW;
  };

  const maxLp = Math.max(...data.map((d) => d.liquidityInjectedUsd), 50000);

  const linePoints = data
    .map((d, i) => `${xForIndex(i).toFixed(1)},${yForPrice(d.price).toFixed(1)}`)
    .join(' ');

  const upperBandY = yForPrice(Math.min(maxPrice, upperGuard));
  const lowerBandY = yForPrice(Math.max(minPrice, lowerGuard));
  const pegY = yForPrice(1.0);

  const activePoint = hoverIdx !== null ? data[hoverIdx] : data[data.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 text-slate-600">
          <span className="font-mono tabular-nums text-slate-900 font-semibold">
            {activePoint.time}: {formatPegPrice(activePoint.price)}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono tabular-nums">
            Auto-LP Injected: {formatCompactUsd(activePoint.liquidityInjectedUsd)}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono tabular-nums">
            Supply: {activePoint.supplyM.toFixed(2)}M EPK
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <span>Target: $1.0000</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>Guard Band: ±{(guardDelta * 100).toFixed(2)}%</span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="EPK USD Peg Stability and Auto-Liquidity Injection Chart"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Peg Guard Band Shading */}
          <rect
            x={padLeft}
            y={upperBandY}
            width={plotW}
            height={Math.max(2, lowerBandY - upperBandY)}
            fill="#ecfdf5"
          />

          {/* Horizontal Y-Axis Gridlines */}
          {[1.004, 1.002, 1.0, 0.998, 0.996].map((tick) => {
            const y = yForPrice(tick);
            const isPeg = tick === 1.0;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={isPeg ? '#059669' : '#e2e8f0'}
                  strokeWidth={isPeg ? 1.25 : 1}
                  strokeDasharray={isPeg ? '4 4' : undefined}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  ${tick.toFixed(3)}
                </text>
              </g>
            );
          })}

          {/* Auto-Liquidity Injection Bars (Bottom 25% of plot) */}
          {data.map((d, i) => {
            const cx = xForIndex(i);
            const barH = (d.liquidityInjectedUsd / maxLp) * (plotH * 0.28);
            const barW = Math.max(10, (plotW / data.length) * 0.42);
            return (
              <rect
                key={d.time}
                x={cx - barW / 2}
                y={padTop + plotH - barH}
                width={barW}
                height={barH}
                rx={2}
                fill={hoverIdx === i ? '#0f172a' : '#cbd5e1'}
                opacity={0.7}
              />
            );
          })}

          {/* Price Line */}
          <polyline
            fill="none"
            stroke="#0f172a"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={linePoints}
          />

          {/* Data Points & Hover Targets */}
          {data.map((d, i) => {
            const cx = xForIndex(i);
            const cy = yForPrice(d.price);
            const isHovered = hoverIdx === i;
            return (
              <g key={d.time}>
                {isHovered && (
                  <line
                    x1={cx}
                    y1={padTop}
                    x2={cx}
                    y2={padTop + plotH}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 4.5 : 2.8}
                  fill={isHovered ? '#047857' : '#0f172a'}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {d.time}
                </text>
                <rect
                  x={cx - plotW / data.length / 2}
                  y={padTop}
                  width={plotW / data.length}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              </g>
            );
          })}

          {/* Peg Label */}
          <text
            x={width - padRight - 4}
            y={pegY - 5}
            textAnchor="end"
            className="fill-emerald-700 text-[10px] font-mono font-medium"
          >
            $1.000 Peg
          </text>
        </svg>
      </div>
    </div>
  );
}
