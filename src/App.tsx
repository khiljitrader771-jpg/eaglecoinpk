import { useState } from 'react';
import { AutoLiquidityView } from './components/AutoLiquidityView';
import { ContractsView } from './components/ContractsView';
import { ExchangesView } from './components/ExchangesView';
import { OverviewView } from './components/OverviewView';
import { ReservesLedgerView } from './components/ReservesLedgerView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { INITIAL_PROTOCOL_STATE } from './data/initialProtocol';
import {
  AutoLiquidityConfig,
  ChainId,
  NavSection,
  ProtocolEvent,
  ProtocolState,
} from './types/protocol';

function makeUtcTime(): string {
  const now = new Date();
  return now.toISOString().slice(11, 19) + ' UTC';
}

function makeTxHash(): string {
  const hex = '0123456789abcdef';
  let prefix = '0x';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    prefix += hex[Math.floor(Math.random() * 16)];
    suffix += hex[Math.floor(Math.random() * 16)];
  }
  return `${prefix}...${suffix}`;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [state, setState] = useState<ProtocolState>(INITIAL_PROTOCOL_STATE);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const notify = (msg: string) => {
    setBannerMessage(msg);
  };

  const handleChangeChain = (chain: ChainId) => {
    setState((prev) => ({ ...prev, activeChain: chain }));
    notify(`Switched active protocol network context to ${chain.toUpperCase()}.`);
  };

  const handleSimulateShock = (kind: 'sell' | 'buy' | 'rebalance') => {
    setState((prev) => {
      let nextPrice = prev.spotPriceUsd;
      let nextPendingLp = prev.pendingAutoLpEpk;
      let nextAutoLpTotal = prev.totalAutoLpInjectedUsd;
      let nextSupply = prev.totalSupplyEpk;
      let nextPools = [...prev.pools];
      let event: ProtocolEvent;

      if (kind === 'sell') {
        const sellAmount = 250000;
        const feeEpk = (sellAmount * prev.autoLpConfig.autoLpFeeBps) / 10000;
        nextPendingLp += feeEpk;
        nextPrice = Math.max(0.9964, Number((prev.spotPriceUsd - 0.0031).toFixed(4)));
        event = {
          id: `evt-${Date.now()}`,
          timestamp: makeUtcTime(),
          type: 'Swap',
          summary: `Simulated -$250k sell shock absorbed by DEX depth; ${Math.round(feeEpk)} EPK routed to Auto-LP bucket`,
          amountEpk: sellAmount,
          usdValue: sellAmount * nextPrice,
          postPegPrice: nextPrice,
          txHash: makeTxHash(),
        };
      } else if (kind === 'buy') {
        const buyAmount = 500000;
        const feeEpk = (buyAmount * prev.autoLpConfig.autoLpFeeBps) / 10000;
        nextPendingLp += feeEpk;
        nextPrice = Math.min(1.0044, Number((prev.spotPriceUsd + 0.0029).toFixed(4)));
        event = {
          id: `evt-${Date.now()}`,
          timestamp: makeUtcTime(),
          type: 'Swap',
          summary: `Simulated +$500k buy surge; ${Math.round(feeEpk)} EPK captured by Auto-LP engine`,
          amountEpk: buyAmount,
          usdValue: buyAmount * nextPrice,
          postPegPrice: nextPrice,
          txHash: makeTxHash(),
        };
      } else {
        const lpAddedUsd = nextPendingLp;
        nextAutoLpTotal += lpAddedUsd;
        nextPools = nextPools.map((pool, idx) =>
          idx === 0
            ? {
                ...pool,
                epkReserve: pool.epkReserve + lpAddedUsd / 2,
                quoteReserve: pool.quoteReserve + lpAddedUsd / 2,
                tvlUsd: pool.tvlUsd + lpAddedUsd,
              }
            : pool
        );
        const arbEpk = Math.round(Math.abs(prev.spotPriceUsd - 1) * 18000000 + 45000);
        if (prev.spotPriceUsd > 1) {
          nextSupply += arbEpk;
        }
        nextPendingLp = 0;
        nextPrice = 1.0;
        event = {
          id: `evt-${Date.now()}`,
          timestamp: makeUtcTime(),
          type: 'Rebalance',
          summary: `Peg Stability Module arbitrage & swapAndLiquify injected $${Math.round(lpAddedUsd).toLocaleString()} LP and restored $1.0000 peg`,
          amountEpk: arbEpk,
          usdValue: arbEpk,
          postPegPrice: 1.0,
          txHash: makeTxHash(),
        };
      }

      const nextHistory = [
        ...prev.pegHistory.slice(1),
        {
          time: makeUtcTime().slice(0, 5),
          price: nextPrice,
          liquidityInjectedUsd:
            kind === 'rebalance' ? prev.pendingAutoLpEpk : 12000,
          supplyM: Number((nextSupply / 1_000_000).toFixed(2)),
        },
      ];

      return {
        ...prev,
        spotPriceUsd: nextPrice,
        pendingAutoLpEpk: nextPendingLp,
        totalAutoLpInjectedUsd: nextAutoLpTotal,
        totalSupplyEpk: nextSupply,
        pools: nextPools,
        pegHistory: nextHistory,
        events: [event, ...prev.events],
      };
    });

    if (kind === 'rebalance') {
      notify('Peg Stability Module restored $1.0000 USD peg and injected locked liquidity.');
    } else if (kind === 'sell') {
      notify('Simulated -$250k sell shock. Run Peg Arbitrage & Auto-LP to restore $1.0000.');
    } else {
      notify('Simulated +$500k buy surge. Auto-LP bucket accumulated swap fees.');
    }
  };

  const handleExecuteSwapOrMint = ({
    mode,
    amountIn,
  }: {
    mode: 'psm-mint' | 'psm-redeem' | 'amm-buy' | 'amm-sell';
    amountIn: number;
  }) => {
    setState((prev) => {
      let userEpk = prev.userEpkBalance;
      let userUsdc = prev.userUsdcBalance;
      let totalSupply = prev.totalSupplyEpk;
      let reserveUsd = prev.treasuryReserveUsd;
      let spotPrice = prev.spotPriceUsd;
      let pendingLp = prev.pendingAutoLpEpk;
      let totalAutoLp = prev.totalAutoLpInjectedUsd;
      let pools = [...prev.pools];
      const newEvents: ProtocolEvent[] = [];

      if (mode === 'psm-mint') {
        const fee = (amountIn * prev.autoLpConfig.psmFeeBps) / 10000;
        const epkOut = amountIn - fee;
        userUsdc -= amountIn;
        userEpk += epkOut;
        totalSupply += epkOut;
        reserveUsd += amountIn;
        spotPrice = Number((spotPrice * 0.6 + 1.0 * 0.4).toFixed(4));
        newEvents.push({
          id: `evt-${Date.now()}`,
          timestamp: makeUtcTime(),
          type: 'Mint',
          summary: `1:1 PSM Mint: deposited ${amountIn.toLocaleString()} USDC for ${epkOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPK`,
          amountEpk: epkOut,
          usdValue: amountIn,
          postPegPrice: spotPrice,
          txHash: makeTxHash(),
        });
      } else if (mode === 'psm-redeem') {
        const fee = (amountIn * prev.autoLpConfig.psmFeeBps) / 10000;
        const usdcOut = amountIn - fee;
        userEpk -= amountIn;
        userUsdc += usdcOut;
        totalSupply -= amountIn;
        reserveUsd -= usdcOut;
        spotPrice = Number((spotPrice * 0.6 + 1.0 * 0.4).toFixed(4));
        newEvents.push({
          id: `evt-${Date.now()}`,
          timestamp: makeUtcTime(),
          type: 'Redeem',
          summary: `1:1 PSM Redeem: burned ${amountIn.toLocaleString()} EPK for ${usdcOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`,
          amountEpk: amountIn,
          usdValue: usdcOut,
          postPegPrice: spotPrice,
          txHash: makeTxHash(),
        });
      } else if (mode === 'amm-buy') {
        const fee = (amountIn * prev.autoLpConfig.autoLpFeeBps) / 10000;
        const epkOut = (amountIn - fee) / spotPrice;
        userUsdc -= amountIn;
        userEpk += epkOut;
        pendingLp += fee;
        spotPrice = Math.min(1.0035, Number((spotPrice + amountIn / 25000000).toFixed(4)));
        pools = pools.map((p, i) =>
          i === 0
            ? {
                ...p,
                quoteReserve: p.quoteReserve + amountIn,
                epkReserve: Math.max(100000, p.epkReserve - epkOut),
                volume24hUsd: p.volume24hUsd + amountIn,
              }
            : p
        );
        newEvents.push({
          id: `evt-${Date.now()}`,
          timestamp: makeUtcTime(),
          type: 'Swap',
          summary: `AMM Buy Swap: ${amountIn.toLocaleString()} USDC → ${epkOut.toFixed(2)} EPK (${fee.toFixed(2)} EPK to Auto-LP)`,
          amountEpk: epkOut,
          usdValue: amountIn,
          postPegPrice: spotPrice,
          txHash: makeTxHash(),
        });
      } else {
        const fee = (amountIn * prev.autoLpConfig.autoLpFeeBps) / 10000;
        const usdcOut = (amountIn - fee) * spotPrice;
        userEpk -= amountIn;
        userUsdc += usdcOut;
        pendingLp += fee;
        spotPrice = Math.max(0.9965, Number((spotPrice - amountIn / 25000000).toFixed(4)));
        pools = pools.map((p, i) =>
          i === 0
            ? {
                ...p,
                epkReserve: p.epkReserve + amountIn,
                quoteReserve: Math.max(100000, p.quoteReserve - usdcOut),
                volume24hUsd: p.volume24hUsd + usdcOut,
              }
            : p
        );
        newEvents.push({
          id: `evt-${Date.now()}`,
          timestamp: makeUtcTime(),
          type: 'Swap',
          summary: `AMM Sell Swap: ${amountIn.toLocaleString()} EPK → ${usdcOut.toFixed(2)} USDC (${fee.toFixed(2)} EPK to Auto-LP)`,
          amountEpk: amountIn,
          usdValue: usdcOut,
          postPegPrice: spotPrice,
          txHash: makeTxHash(),
        });
      }

      // Automatic swapAndLiquify trigger if bucket crosses threshold
      if (pendingLp >= prev.autoLpConfig.liquifyThresholdEpk) {
        const batch = prev.autoLpConfig.liquifyThresholdEpk;
        pendingLp -= batch;
        totalAutoLp += batch;
        pools = pools.map((p, i) =>
          i === 0
            ? {
                ...p,
                epkReserve: p.epkReserve + batch / 2,
                quoteReserve: p.quoteReserve + batch / 2,
                tvlUsd: p.tvlUsd + batch,
              }
            : p
        );
        newEvents.unshift({
          id: `evt-autolp-${Date.now() + 1}`,
          timestamp: makeUtcTime(),
          type: 'Auto-LP',
          summary: `Automatic swapAndLiquify threshold reached: paired ${(batch / 2).toLocaleString()} EPK + $${(batch / 2).toLocaleString()} USDC into locked LP`,
          amountEpk: batch,
          usdValue: batch,
          postPegPrice: spotPrice,
          txHash: makeTxHash(),
        });
      }

      return {
        ...prev,
        userEpkBalance: userEpk,
        userUsdcBalance: userUsdc,
        totalSupplyEpk: totalSupply,
        treasuryReserveUsd: reserveUsd,
        spotPriceUsd: spotPrice,
        pendingAutoLpEpk: pendingLp,
        totalAutoLpInjectedUsd: totalAutoLp,
        pools,
        events: [...newEvents, ...prev.events],
      };
    });
  };

  const handleUpdateAutoLpConfig = (partial: Partial<AutoLiquidityConfig>) => {
    setState((prev) => ({
      ...prev,
      autoLpConfig: { ...prev.autoLpConfig, ...partial },
    }));
  };

  const handleTriggerAutoLiquify = () => {
    setState((prev) => {
      if (prev.pendingAutoLpEpk < 500) return prev;
      const batch = prev.pendingAutoLpEpk;
      const half = batch / 2;
      const nextPools = prev.pools.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              epkReserve: p.epkReserve + half,
              quoteReserve: p.quoteReserve + half,
              tvlUsd: p.tvlUsd + batch,
            }
          : p
      );

      const event: ProtocolEvent = {
        id: `evt-${Date.now()}`,
        timestamp: makeUtcTime(),
        type: 'Auto-LP',
        summary: `Manual swapAndLiquify batch executed: ${Math.round(half).toLocaleString()} EPK paired with $${Math.round(half).toLocaleString()} USDC and locked for ${prev.autoLpConfig.lpLockDays} days`,
        amountEpk: batch,
        usdValue: batch,
        postPegPrice: prev.spotPriceUsd,
        txHash: makeTxHash(),
      };

      return {
        ...prev,
        pendingAutoLpEpk: 0,
        totalAutoLpInjectedUsd: prev.totalAutoLpInjectedUsd + batch,
        pools: nextPools,
        events: [event, ...prev.events],
      };
    });
    notify('Executed swapAndLiquify batch and locked generated LP tokens.');
  };

  const handleDeployDexPool = (exchangeId: string) => {
    setState((prev) => {
      const target = prev.exchanges.find((e) => e.id === exchangeId);
      if (!target) return prev;

      const seedUsd = target.minLiquidityRequiredUsd;
      const nextExchanges = prev.exchanges.map((e) =>
        e.id === exchangeId
          ? {
              ...e,
              status: 'Listed' as const,
              liquidityUsd: seedUsd,
              estimatedLaunch: 'Live',
              marketMakerCommitted: true,
              apiFeedReady: true,
            }
          : e
      );

      const existingPendingPool = prev.pools.find(
        (p) =>
          p.status === 'Pending Seed' &&
          p.venue.toLowerCase().includes(target.name.split(' ')[0].toLowerCase())
      );

      const nextPools = existingPendingPool
        ? prev.pools.map((p) =>
            p.id === existingPendingPool.id
              ? {
                  ...p,
                  epkReserve: seedUsd / 2,
                  quoteReserve: seedUsd / 2,
                  tvlUsd: seedUsd,
                  status: 'Active' as const,
                  poolAddress: makeTxHash(),
                }
              : p
          )
        : [
            ...prev.pools,
            {
              id: `pool-${Date.now()}`,
              venue: target.name,
              pair: target.pair,
              chain: prev.activeChain,
              epkReserve: seedUsd / 2,
              quoteReserve: seedUsd / 2,
              tvlUsd: seedUsd,
              volume24hUsd: Math.round(seedUsd * 0.25),
              feeBps: 5,
              apyPct: 10.4,
              lpLockedPct: 100,
              status: 'Active' as const,
              poolAddress: makeTxHash(),
            },
          ];

      const event: ProtocolEvent = {
        id: `evt-${Date.now()}`,
        timestamp: makeUtcTime(),
        type: 'Exchange',
        summary: `Deployed & seeded ${target.name} (${target.pair}) pool with $${seedUsd.toLocaleString()} initial locked liquidity`,
        amountEpk: seedUsd / 2,
        usdValue: seedUsd,
        postPegPrice: prev.spotPriceUsd,
        txHash: makeTxHash(),
      };

      return {
        ...prev,
        exchanges: nextExchanges,
        pools: nextPools,
        events: [event, ...prev.events],
      };
    });
    notify('DEX liquidity pool deployed and added to active protocol routing.');
  };

  const handleToggleRequirement = (
    exchangeId: string,
    field: 'marketMakerCommitted' | 'apiFeedReady'
  ) => {
    setState((prev) => ({
      ...prev,
      exchanges: prev.exchanges.map((e) =>
        e.id === exchangeId ? { ...e, [field]: !e[field] } : e
      ),
    }));
  };

  const handleSubmitCexApplication = (exchangeId: string) => {
    setState((prev) => {
      const target = prev.exchanges.find((e) => e.id === exchangeId);
      if (!target) return prev;

      const nextExchanges = prev.exchanges.map((e) =>
        e.id === exchangeId
          ? {
              ...e,
              status: 'In Review' as const,
              liquidityUsd: e.minLiquidityRequiredUsd,
            }
          : e
      );

      const event: ProtocolEvent = {
        id: `evt-${Date.now()}`,
        timestamp: makeUtcTime(),
        type: 'Exchange',
        summary: `Submitted institutional EPK listing dossier & market-maker commitment to ${target.name}`,
        amountEpk: target.minLiquidityRequiredUsd,
        usdValue: target.minLiquidityRequiredUsd,
        postPegPrice: prev.spotPriceUsd,
        txHash: makeTxHash(),
      };

      return {
        ...prev,
        exchanges: nextExchanges,
        events: [event, ...prev.events],
      };
    });
    notify('Institutional listing application submitted and logged to ledger.');
  };

  const handleAddCustomExchange = (venue: {
    name: string;
    category: 'DEX' | 'Tier-1 CEX' | 'Tier-2 CEX';
    pair: string;
    minLiquidityRequiredUsd: number;
  }) => {
    setState((prev) => ({
      ...prev,
      exchanges: [
        {
          id: `ex-${Date.now()}`,
          name: venue.name,
          category: venue.category,
          pair: venue.pair,
          status: 'Ready',
          liquidityUsd: 0,
          volume24hUsd: 0,
          minLiquidityRequiredUsd: venue.minLiquidityRequiredUsd,
          auditVerified: true,
          legalOpinionReady: true,
          marketMakerCommitted: venue.category === 'DEX',
          apiFeedReady: true,
          estimatedLaunch:
            venue.category === 'DEX' ? 'Instant Pool Deploy' : '14 Business Days',
          notes: 'Added via Eaglecoinpk Exchange Listing Portal.',
        },
        ...prev.exchanges,
      ],
    }));
    notify(`Added ${venue.name} to exchange listing pipeline.`);
  };

  const handleRunAttestation = () => {
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    setState((prev) => ({
      ...prev,
      reserves: prev.reserves.map((r) => ({ ...r, lastAttested: timestamp })),
      events: [
        {
          id: `evt-${Date.now()}`,
          timestamp: makeUtcTime(),
          type: 'Rebalance',
          summary: `Treasury Proof-of-Reserves attestation verified ($${prev.treasuryReserveUsd.toLocaleString()} backing ${prev.totalSupplyEpk.toLocaleString()} EPK)`,
          amountEpk: prev.totalSupplyEpk,
          usdValue: prev.treasuryReserveUsd,
          postPegPrice: prev.spotPriceUsd,
          txHash: makeTxHash(),
        },
        ...prev.events,
      ],
    }));
    notify('Proof of Reserves attestation verified and timestamped.');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          setBannerMessage(null);
        }}
        spotPriceUsd={state.spotPriceUsd}
        userEpkBalance={state.userEpkBalance}
        userUsdcBalance={state.userUsdcBalance}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          activeChain={state.activeChain}
          onChangeChain={handleChangeChain}
          onOpenSwapAction={() => {
            setActiveSection('auto-liquidity');
            setBannerMessage(null);
          }}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-8 max-w-[1360px] w-full mx-auto space-y-6">
          {bannerMessage && (
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
              <span>{bannerMessage}</span>
              <button
                type="button"
                onClick={() => setBannerMessage(null)}
                className="text-slate-500 hover:text-slate-900 font-medium whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeSection === 'overview' && (
            <OverviewView
              state={state}
              onSimulateShock={handleSimulateShock}
              onNavigate={(sec) => setActiveSection(sec)}
            />
          )}

          {activeSection === 'auto-liquidity' && (
            <AutoLiquidityView
              state={state}
              onExecuteSwapOrMint={handleExecuteSwapOrMint}
              onUpdateConfig={handleUpdateAutoLpConfig}
              onTriggerAutoLiquify={handleTriggerAutoLiquify}
            />
          )}

          {activeSection === 'exchanges' && (
            <ExchangesView
              exchanges={state.exchanges}
              activeChain={state.activeChain}
              onDeployDexPool={handleDeployDexPool}
              onToggleRequirement={handleToggleRequirement}
              onSubmitCexApplication={handleSubmitCexApplication}
              onAddCustomExchange={handleAddCustomExchange}
            />
          )}

          {activeSection === 'contracts' && (
            <ContractsView
              activeChain={state.activeChain}
              config={state.autoLpConfig}
            />
          )}

          {activeSection === 'reserves' && (
            <ReservesLedgerView
              state={state}
              onRunAttestation={handleRunAttestation}
            />
          )}
        </main>
      </div>
    </div>
  );
}
