import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';
import { NavSection, ProtocolState } from '../types/protocol';
import {
  formatCompactUsd,
  formatNumber,
  formatPegPrice,
  formatUsd,
} from '../utils/format';
import { PegChart } from './PegChart';
import { TvlAreaChart } from './TvlAreaChart';

interface OverviewViewProps {
  state: ProtocolState;
  onSimulateShock: (kind: 'sell' | 'buy' | 'rebalance') => void;
  onNavigate: (section: NavSection) => void;
}

export function OverviewView({
  state,
  onSimulateShock,
  onNavigate,
}: OverviewViewProps) {
  const totalLiquidityDepth = state.pools.reduce((acc, p) => acc + p.tvlUsd, 0);
  const reserveRatioPct =
    state.totalSupplyEpk > 0
      ? (state.treasuryReserveUsd / state.totalSupplyEpk) * 100
      : 100;
  const pegDeviationBps = Math.round((state.spotPriceUsd - 1) * 10000);
  const listedVenuesCount = state.exchanges.filter(
    (e) => e.status === 'Listed'
  ).length;
  const activePools = state.pools.filter((p) => p.status === 'Active');
  const liveActiveTvl = activePools.reduce((acc, p) => acc + p.tvlUsd, 0);
  const liveTvlSeries = state.tvlHistory.map((pt, idx) =>
    idx === state.tvlHistory.length - 1
      ? {
          ...pt,
          totalTvlUsd: liveActiveTvl,
          activePoolsCount: activePools.length,
          autoLpContributionUsd: state.totalAutoLpInjectedUsd,
        }
      : pt
  );
  const isPegHealthy = Math.abs(pegDeviationBps) <= state.autoLpConfig.pegGuardBandBps;

  return (
    <div className="space-y-6">
      {/* 4-Column Flat KPI Strip */}
      <section
        aria-label="Key Protocol Metrics"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            EPK Spot Price (Peg $1.0000)
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatPegPrice(state.spotPriceUsd)}
            </span>
            <span
              className={`text-xs font-mono tabular-nums font-medium ${
                isPegHealthy ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {pegDeviationBps >= 0 ? '+' : ''}
              {pegDeviationBps} bps · {isPegHealthy ? 'Pegged' : 'Rebalancing'}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Circulating Supply
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatNumber(state.totalSupplyEpk, 0)}
            </span>
            <span className="text-xs text-slate-500 font-mono">EPK</span>
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Treasury Reserve Backing
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatCompactUsd(state.treasuryReserveUsd)}
            </span>
            <span className="text-xs font-mono tabular-nums font-medium text-emerald-700">
              {reserveRatioPct.toFixed(2)}% Backed
            </span>
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Locked DEX Liquidity Depth
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatCompactUsd(totalLiquidityDepth)}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {listedVenuesCount} Active Venues
            </span>
          </div>
        </div>
      </section>

      {/* Main 2-Column Split: Peg Chart + Stress Test & Coin Profile */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                01. USD Peg Stability & Auto-Liquidity Flow
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hourly EPK spot price against the $1.0000 USD target and automated liquidity injections
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('auto-liquidity')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
            >
              Configure Auto-LP Engine →
            </button>
          </div>

          <PegChart
            data={state.pegHistory}
            guardBandBps={state.autoLpConfig.pegGuardBandBps}
          />
        </section>

        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
              <img
                src="/src/assets/images/eaglecoin_crest_1794681024707.jpg"
                alt="Eaglecoinpk Sovereign Stablecoin Medallion"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Eaglecoinpk (EPK)
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Over-collateralized 1:1 USD stablecoin with on-chain{' '}
                <span className="font-mono text-slate-700">swapAndLiquify</span>{' '}
                depth injection and Peg Stability Module arbitrage.
              </p>
              <div className="mt-2 text-xs text-slate-500 font-mono">
                Auto-LP: {(state.autoLpConfig.autoLpFeeBps / 100).toFixed(2)}% · Lock:{' '}
                {state.autoLpConfig.lpLockDays}d
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Peg Stress & Arbitrage Simulator
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Test market shocks and verify automated liquidity + PSM peg defense.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onSimulateShock('sell')}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <span className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Simulate -$250,000 Sell Shock</span>
                </span>
                <span className="font-mono text-slate-500">Test Support</span>
              </button>

              <button
                type="button"
                onClick={() => onSimulateShock('buy')}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <span className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Simulate +$500,000 Buy Demand</span>
                </span>
                <span className="font-mono text-slate-500">Test Ceiling</span>
              </button>

              <button
                type="button"
                onClick={() => onSimulateShock('rebalance')}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  <span>Run Peg Arbitrage & Auto-LP</span>
                </span>
                <span className="font-mono text-slate-300">Restore $1.00</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* D3 Historical TVL Area Chart across Active Pools */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              02. Active Liquidity Pools — Historical TVL Growth
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cumulative Total Value Locked across {activePools.length} active DEX pools and automated protocol liquidity injections
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('exchanges')}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
          >
            Deploy Additional Pools →
          </button>
        </div>

        <TvlAreaChart data={liveTvlSeries} />
      </section>

      {/* Recent Protocol Activity Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              03. Recent Protocol & Auto-Liquidity Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time state transitions from mints, swaps, liquidity injections, and exchange updates
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('reserves')}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
          >
            View Full Ledger →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-6">Time</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Protocol Action</th>
                <th className="py-2.5 px-4 text-right">Volume (EPK)</th>
                <th className="py-2.5 px-4 text-right">Post-Tx Peg</th>
                <th className="py-2.5 px-6 text-right">Tx Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {state.events.slice(0, 5).map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-6 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {evt.timestamp}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {evt.type}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                    {evt.summary}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {formatNumber(evt.amountEpk, 0)} EPK
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                    {formatUsd(evt.postPegPrice, 4)}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-slate-500 whitespace-nowrap">
                    {evt.txHash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
