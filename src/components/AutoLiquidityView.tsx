import { useState } from 'react';
import { ArrowDownUp, Droplets, Lock } from 'lucide-react';
import { AutoLiquidityConfig, ProtocolState } from '../types/protocol';
import { formatCompactUsd, formatNumber, formatPegPrice } from '../utils/format';

interface AutoLiquidityViewProps {
  state: ProtocolState;
  onExecuteSwapOrMint: (params: {
    mode: 'psm-mint' | 'psm-redeem' | 'amm-buy' | 'amm-sell';
    amountIn: number;
  }) => void;
  onUpdateConfig: (partial: Partial<AutoLiquidityConfig>) => void;
  onTriggerAutoLiquify: () => void;
}

export function AutoLiquidityView({
  state,
  onExecuteSwapOrMint,
  onUpdateConfig,
  onTriggerAutoLiquify,
}: AutoLiquidityViewProps) {
  const [tradeMode, setTradeMode] = useState<'psm' | 'amm'>('psm');
  const [direction, setDirection] = useState<'in-to-epk' | 'epk-to-out'>('in-to-epk');
  const [amountInput, setAmountInput] = useState<string>('5000');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const parsedAmount = Math.max(0, Number(amountInput) || 0);

  const isPsm = tradeMode === 'psm';
  const feeBps = isPsm ? state.autoLpConfig.psmFeeBps : state.autoLpConfig.autoLpFeeBps;
  const feeAmount = (parsedAmount * feeBps) / 10000;

  let estimatedOutput = 0;
  let effectiveRate = 1.0;

  if (parsedAmount > 0) {
    if (isPsm) {
      estimatedOutput = parsedAmount - feeAmount;
      effectiveRate = 1.0;
    } else if (direction === 'in-to-epk') {
      // AMM constant-product estimate across primary pool
      const netUsd = parsedAmount - feeAmount;
      estimatedOutput = netUsd / state.spotPriceUsd;
      effectiveRate = state.spotPriceUsd;
    } else {
      const netEpk = parsedAmount - feeAmount;
      estimatedOutput = netEpk * state.spotPriceUsd;
      effectiveRate = state.spotPriceUsd;
    }
  }

  const maxSpendable =
    direction === 'in-to-epk' ? state.userUsdcBalance : state.userEpkBalance;
  const insufficientBalance = parsedAmount > maxSpendable;

  const bucketPct = Math.min(
    100,
    (state.pendingAutoLpEpk / state.autoLpConfig.liquifyThresholdEpk) * 100
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0 || insufficientBalance) return;

    const actionMode = isPsm
      ? direction === 'in-to-epk'
        ? 'psm-mint'
        : 'psm-redeem'
      : direction === 'in-to-epk'
        ? 'amm-buy'
        : 'amm-sell';

    onExecuteSwapOrMint({ mode: actionMode, amountIn: parsedAmount });
    setFeedbackMsg(
      isPsm
        ? `Executed 1:1 PSM ${direction === 'in-to-epk' ? 'Mint' : 'Redeem'} for ${formatNumber(estimatedOutput, 2)} ${direction === 'in-to-epk' ? 'EPK' : 'USDC'}.`
        : `Executed AMM swap; ${formatNumber(feeAmount, 2)} routed to Auto-Liquidity Bucket.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Swap & 1:1 PSM Terminal */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                01. Swap & Peg Stability Terminal
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mint 1:1 via USDC collateral or trade on AMM pools with auto-LP fee routing
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
            role="tablist"
            aria-label="Execution Mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tradeMode === 'psm'}
              onClick={() => {
                setTradeMode('psm');
                setFeedbackMsg(null);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tradeMode === 'psm'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1:1 PSM Mint / Redeem
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tradeMode === 'amm'}
              onClick={() => {
                setTradeMode('amm');
                setFeedbackMsg(null);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tradeMode === 'amm'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AMM Swap (Auto-LP)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border border-slate-200 rounded-lg p-4 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <label htmlFor="amount-in">
                  Pay ({direction === 'in-to-epk' ? 'USDC' : 'EPK'})
                </label>
                <button
                  type="button"
                  onClick={() => setAmountInput(String(Math.floor(maxSpendable)))}
                  className="font-mono tabular-nums text-emerald-700 hover:text-emerald-800"
                >
                  Max: {formatNumber(maxSpendable, 2)}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="amount-in"
                  type="number"
                  min="0"
                  step="any"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setFeedbackMsg(null);
                  }}
                  className="w-full bg-transparent font-mono tabular-nums text-xl font-semibold text-slate-900 focus:outline-none"
                />
                <span className="text-xs font-semibold text-slate-700 px-2.5 py-1 bg-white border border-slate-200 rounded-md shrink-0">
                  {direction === 'in-to-epk' ? 'USDC' : 'EPK'}
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() =>
                  setDirection((d) =>
                    d === 'in-to-epk' ? 'epk-to-out' : 'in-to-epk'
                  )
                }
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                aria-label="Reverse swap direction"
              >
                <ArrowDownUp className="h-4 w-4" />
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Receive (Estimated)</span>
                <span className="font-mono tabular-nums">
                  Rate: 1 EPK = {formatPegPrice(effectiveRate)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono tabular-nums text-xl font-semibold text-slate-900">
                  {formatNumber(estimatedOutput, 2)}
                </div>
                <span className="text-xs font-semibold text-slate-700 px-2.5 py-1 bg-white border border-slate-200 rounded-md shrink-0">
                  {direction === 'in-to-epk' ? 'EPK' : 'USDC'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 pt-1">
              <div className="flex items-center justify-between">
                <span>
                  {isPsm ? 'PSM Protocol Mint/Redeem Fee' : 'Auto-Liquidity Pool Fee'}
                </span>
                <span className="font-mono tabular-nums text-slate-900">
                  {(feeBps / 100).toFixed(2)}% ({formatNumber(feeAmount, 2)})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Execution Route</span>
                <span className="font-mono text-slate-900">
                  {isPsm ? 'EaglePegStabilityModule' : 'PancakeSwap V3 + Auto-LP'}
                </span>
              </div>
            </div>

            {insufficientBalance && (
              <p className="text-xs font-medium text-rose-700">
                Insufficient {direction === 'in-to-epk' ? 'USDC' : 'EPK'} wallet balance.
              </p>
            )}

            {feedbackMsg && (
              <p className="text-xs font-medium text-emerald-700">{feedbackMsg}</p>
            )}

            <button
              type="submit"
              disabled={parsedAmount <= 0 || insufficientBalance}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
            >
              {isPsm
                ? direction === 'in-to-epk'
                  ? 'Mint EPK at $1.00 Peg'
                  : 'Redeem USDC at $1.00 Peg'
                : 'Execute Swap & Fund Auto-LP'}
            </button>
          </form>
        </section>

        {/* Right: Auto-Liquidity Engine & Parameters */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                02. Automated Liquidity Engine (swapAndLiquify)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every AMM transfer accumulates EPK in the contract bucket, splits 50/50 into EPK + USDC, and locks LP tokens.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Total Auto-LP Injected</div>
              <div className="font-mono tabular-nums text-lg font-semibold text-slate-900">
                {formatCompactUsd(state.totalAutoLpInjectedUsd)}
              </div>
            </div>
          </div>

          {/* Pending Bucket Progress */}
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Droplets className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>Contract Auto-LP Accumulation Bucket</span>
              </div>
              <span className="font-mono tabular-nums text-xs font-medium text-slate-700">
                {formatNumber(state.pendingAutoLpEpk, 0)} /{' '}
                {formatNumber(state.autoLpConfig.liquifyThresholdEpk, 0)} EPK (
                {bucketPct.toFixed(1)}%)
              </span>
            </div>

            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-700 transition-all duration-200"
                style={{ width: `${bucketPct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-500">
                Next batch adds{' '}
                <span className="font-mono tabular-nums text-slate-800 font-medium">
                  {formatNumber(state.pendingAutoLpEpk / 2, 0)} EPK +{' '}
                  {formatCompactUsd(state.pendingAutoLpEpk / 2)} USDC
                </span>{' '}
                to locked liquidity.
              </div>
              <button
                type="button"
                onClick={onTriggerAutoLiquify}
                disabled={state.pendingAutoLpEpk < 500}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Execute swapAndLiquify Batch
              </button>
            </div>
          </div>

          {/* Parameter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="autolp-bps" className="font-medium text-slate-700">
                  Auto-LP Fee Rate
                </label>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {state.autoLpConfig.autoLpFeeBps} bps (
                  {(state.autoLpConfig.autoLpFeeBps / 100).toFixed(2)}%)
                </span>
              </div>
              <input
                id="autolp-bps"
                type="range"
                min={5}
                max={100}
                step={5}
                value={state.autoLpConfig.autoLpFeeBps}
                onChange={(e) =>
                  onUpdateConfig({ autoLpFeeBps: Number(e.target.value) })
                }
                className="w-full accent-emerald-700"
              />
              <p className="text-xs text-slate-500">
                Capped at 100 bps (1.00%) in EaglecoinPK.sol to protect tight peg spreads.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="threshold-epk" className="font-medium text-slate-700">
                  Liquify Trigger Threshold
                </label>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatNumber(state.autoLpConfig.liquifyThresholdEpk, 0)} EPK
                </span>
              </div>
              <input
                id="threshold-epk"
                type="range"
                min={10000}
                max={150000}
                step={5000}
                value={state.autoLpConfig.liquifyThresholdEpk}
                onChange={(e) =>
                  onUpdateConfig({ liquifyThresholdEpk: Number(e.target.value) })
                }
                className="w-full accent-emerald-700"
              />
              <p className="text-xs text-slate-500">
                Contract automatically executes LP pairing once bucket reaches threshold.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="guard-band" className="font-medium text-slate-700">
                  Peg Guard Arbitrage Band
                </label>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  ±{(state.autoLpConfig.pegGuardBandBps / 100).toFixed(2)}%
                </span>
              </div>
              <input
                id="guard-band"
                type="range"
                min={10}
                max={100}
                step={5}
                value={state.autoLpConfig.pegGuardBandBps}
                onChange={(e) =>
                  onUpdateConfig({ pegGuardBandBps: Number(e.target.value) })
                }
                className="w-full accent-emerald-700"
              />
              <p className="text-xs text-slate-500">
                Triggers automated PSM arbitrage when spot diverges beyond band.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">LP Lock Governance</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700 flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  {state.autoLpConfig.lpLockDays} Days Locked
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                {[180, 365, 730].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => onUpdateConfig({ lpLockDays: days })}
                    className={`flex-1 py-1.5 px-2 text-xs font-mono rounded-md border transition-colors ${
                      state.autoLpConfig.lpLockDays === days
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Generated LP tokens route directly to the time-locked Treasury Vault.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Active Liquidity Pools Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900">
            03. Multi-Chain Automated Liquidity Pools
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Protocol-owned and auto-compounded liquidity positions maintaining tight stablecoin spreads
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-6">DEX Venue</th>
                <th className="py-2.5 px-4">Pair</th>
                <th className="py-2.5 px-4 text-right">EPK Reserve</th>
                <th className="py-2.5 px-4 text-right">Total Pool TVL</th>
                <th className="py-2.5 px-4 text-right">24h Volume</th>
                <th className="py-2.5 px-4 text-right">LP Lock</th>
                <th className="py-2.5 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {state.pools.map((pool) => (
                <tr key={pool.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-6 font-medium text-slate-900 whitespace-nowrap">
                    {pool.venue} ·{' '}
                    <span className="font-mono text-slate-500 uppercase">
                      {pool.chain}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {pool.pair}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {formatNumber(pool.epkReserve, 0)} EPK
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {formatCompactUsd(pool.tvlUsd)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {formatCompactUsd(pool.volume24hUsd)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {pool.lpLockedPct}%
                  </td>
                  <td
                    className={`py-3 px-6 text-right font-medium whitespace-nowrap ${
                      pool.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {pool.status}
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
