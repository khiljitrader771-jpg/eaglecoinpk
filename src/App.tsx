import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { AutoLiquidityView } from './components/AutoLiquidityView';
import { ContractsView } from './components/ContractsView';
import { ExchangesView } from './components/ExchangesView';
import { GovernanceView, LOCK_MULTIPLIERS } from './components/GovernanceView';
import { OverviewView } from './components/OverviewView';
import { ReservesLedgerView } from './components/ReservesLedgerView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { INITIAL_PROTOCOL_STATE } from './data/initialProtocol';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import {
  appendLedgerEvent,
  castProposalVoteInDb,
  createGovernanceProposalInDb,
  ensureUserAndWorkspaceSeeded,
  executeGovernanceProposalInDb,
  fetchUserVotesForProposals,
  syncUserProfile,
  syncWorkspaceState,
} from './lib/protocolStore';
import {
  AutoLiquidityConfig,
  ChainId,
  GovernanceLockTier,
  GovernanceParameterChange,
  GovernanceProposal,
  NavSection,
  ProposalCategory,
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const notify = (msg: string) => {
    setBannerMessage(msg);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !currentUser) {
      return;
    }

    const safeUid = currentUser.uid.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
    let cancelled = false;
    const unsubs: (() => void)[] = [];

    const setupSync = async () => {
      try {
        await ensureUserAndWorkspaceSeeded(currentUser);
      } catch (err) {
        if (!cancelled) {
          setBannerMessage(
            err instanceof Error
              ? 'Unable to initialize Firebase workspace. Check connection or permissions.'
              : 'Unable to initialize Firebase workspace.'
          );
        }
        return;
      }

      if (cancelled) return;

      // 1. User profile & wallet listener
      const userPath = `users/${safeUid}`;
      unsubs.push(
        onSnapshot(
          doc(db, 'users', safeUid),
          (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            setState((prev) => ({
              ...prev,
              userEpkBalance:
                typeof data.epkBalance === 'number'
                  ? data.epkBalance
                  : prev.userEpkBalance,
              userUsdcBalance:
                typeof data.usdcBalance === 'number'
                  ? data.usdcBalance
                  : prev.userUsdcBalance,
              governanceLockTier:
                (data.governanceLockTier as GovernanceLockTier) ||
                prev.governanceLockTier,
            }));
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, userPath);
          }
        )
      );

      // 2. Workspace protocol parameters & pools listener
      const wsPath = `workspaces/${safeUid}`;
      unsubs.push(
        onSnapshot(
          doc(db, 'workspaces', safeUid),
          (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            setState((prev) => ({
              ...prev,
              activeChain: (data.activeChain as ChainId) || prev.activeChain,
              spotPriceUsd:
                typeof data.spotPriceUsd === 'number'
                  ? data.spotPriceUsd
                  : prev.spotPriceUsd,
              totalSupplyEpk:
                typeof data.totalSupplyEpk === 'number'
                  ? data.totalSupplyEpk
                  : prev.totalSupplyEpk,
              treasuryReserveUsd:
                typeof data.treasuryReserveUsd === 'number'
                  ? data.treasuryReserveUsd
                  : prev.treasuryReserveUsd,
              pendingAutoLpEpk:
                typeof data.pendingAutoLpEpk === 'number'
                  ? data.pendingAutoLpEpk
                  : prev.pendingAutoLpEpk,
              totalAutoLpInjectedUsd:
                typeof data.totalAutoLpInjectedUsd === 'number'
                  ? data.totalAutoLpInjectedUsd
                  : prev.totalAutoLpInjectedUsd,
              autoLpConfig: data.autoLpConfig || prev.autoLpConfig,
              pools: Array.isArray(data.pools) ? data.pools : prev.pools,
              exchanges: Array.isArray(data.exchanges)
                ? data.exchanges
                : prev.exchanges,
              reserves: Array.isArray(data.reserves) ? data.reserves : prev.reserves,
              pegHistory: Array.isArray(data.pegHistory)
                ? data.pegHistory
                : prev.pegHistory,
              tvlHistory: Array.isArray(data.tvlHistory)
                ? data.tvlHistory
                : prev.tvlHistory,
            }));
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, wsPath);
          }
        )
      );

      // 3. Workspace ledger events listener
      const eventsPath = `workspaces/${safeUid}/events`;
      const eventsQuery = query(
        collection(db, 'workspaces', safeUid, 'events'),
        where('ownerUid', '==', safeUid),
        limit(50)
      );
      unsubs.push(
        onSnapshot(
          eventsQuery,
          (snapshot) => {
            const loaded: (ProtocolEvent & { sortMs: number })[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              const sortMs =
                d.createdAt && typeof d.createdAt.toMillis === 'function'
                  ? d.createdAt.toMillis()
                  : 0;
              loaded.push({
                id: docSnap.id,
                timestamp: String(d.timestamp || ''),
                type: d.type,
                summary: String(d.summary || ''),
                amountEpk: Number(d.amountEpk) || 0,
                usdValue: Number(d.usdValue) || 0,
                postPegPrice: Number(d.postPegPrice) || 1.0,
                txHash: String(d.txHash || ''),
                sortMs,
              });
            });
            loaded.sort((a, b) => b.sortMs - a.sortMs);
            if (loaded.length > 0) {
              setState((prev) => ({
                ...prev,
                events: loaded.map(({ sortMs: _omit, ...rest }) => rest),
              }));
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, eventsPath);
          }
        )
      );

      // 4. Shared governance proposals listener
      const proposalsPath = 'proposals';
      const proposalsQuery = query(
        collection(db, proposalsPath),
        where('visibility', '==', 'public')
      );
      unsubs.push(
        onSnapshot(
          proposalsQuery,
          async (snapshot) => {
            const rawList: GovernanceProposal[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              rawList.push({
                id: String(d.proposalCode || docSnap.id),
                title: String(d.title || ''),
                description: String(d.description || ''),
                proposer: String(d.proposerLabel || ''),
                category: d.category,
                parameterChange: d.parameterChange,
                votesFor: Number(d.votesFor) || 0,
                votesAgainst: Number(d.votesAgainst) || 0,
                votesAbstain: Number(d.votesAbstain) || 0,
                quorumRequired: Number(d.quorumRequired) || 500000,
                userVote: null,
                userVotePower: 0,
                status: d.status,
                createdAt: String(d.createdDate || ''),
                endsAt: String(d.endsAt || ''),
              });
            });

            if (rawList.length > 0 && !cancelled) {
              try {
                const voteMap = await fetchUserVotesForProposals(
                  safeUid,
                  rawList.map((p) => p.id)
                );
                if (!cancelled) {
                  const hydrated = rawList
                    .map((p) => {
                      const v = voteMap[p.id];
                      return v
                        ? { ...p, userVote: v.choice, userVotePower: v.votePower }
                        : p;
                    })
                    .sort((a, b) => b.id.localeCompare(a.id));
                  setState((prev) => ({ ...prev, proposals: hydrated }));
                }
              } catch {
                // Error already logged via handleFirestoreError
              }
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, proposalsPath);
          }
        )
      );
    };

    void setupSync();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [authReady, currentUser]);

  const persistWorkspaceAndEvent = (
    nextState: ProtocolState,
    newEvent?: ProtocolEvent
  ) => {
    if (!currentUser) return;
    void syncWorkspaceState(currentUser.uid, nextState).catch(() => {
      notify('Cloud sync failed. Check Firestore permissions.');
    });
    if (newEvent) {
      void appendLedgerEvent(currentUser.uid, newEvent).catch(() => {
        notify('Ledger event sync failed.');
      });
    }
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      notify('Signed in with Google. Protocol workspace synced to Firestore.');
    } catch (error) {
      notify(
        error instanceof Error
          ? `Sign-in cancelled or failed: ${error.message}`
          : 'Google sign-in failed.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setState(INITIAL_PROTOCOL_STATE);
    notify('Signed out. Switched back to local preview session.');
  };

  const handleChangeChain = (chain: ChainId) => {
    const nextState: ProtocolState = { ...state, activeChain: chain };
    setState(nextState);
    persistWorkspaceAndEvent(nextState);
    notify(`Switched active protocol network context to ${chain.toUpperCase()}.`);
  };

  const handleSimulateShock = (kind: 'sell' | 'buy' | 'rebalance') => {
    let nextPrice = state.spotPriceUsd;
    let nextPendingLp = state.pendingAutoLpEpk;
    let nextAutoLpTotal = state.totalAutoLpInjectedUsd;
    let nextSupply = state.totalSupplyEpk;
    let nextPools = [...state.pools];
    let event: ProtocolEvent;

    if (kind === 'sell') {
      const sellAmount = 250000;
      const feeEpk = (sellAmount * state.autoLpConfig.autoLpFeeBps) / 10000;
      nextPendingLp += feeEpk;
      nextPrice = Math.max(0.9964, Number((state.spotPriceUsd - 0.0031).toFixed(4)));
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
      const feeEpk = (buyAmount * state.autoLpConfig.autoLpFeeBps) / 10000;
      nextPendingLp += feeEpk;
      nextPrice = Math.min(1.0044, Number((state.spotPriceUsd + 0.0029).toFixed(4)));
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
      const arbEpk = Math.round(Math.abs(state.spotPriceUsd - 1) * 18000000 + 45000);
      if (state.spotPriceUsd > 1) {
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
      ...state.pegHistory.slice(1),
      {
        time: makeUtcTime().slice(0, 5),
        price: nextPrice,
        liquidityInjectedUsd:
          kind === 'rebalance' ? state.pendingAutoLpEpk : 12000,
        supplyM: Number((nextSupply / 1_000_000).toFixed(2)),
      },
    ];

    const nextState: ProtocolState = {
      ...state,
      spotPriceUsd: nextPrice,
      pendingAutoLpEpk: nextPendingLp,
      totalAutoLpInjectedUsd: nextAutoLpTotal,
      totalSupplyEpk: nextSupply,
      pools: nextPools,
      pegHistory: nextHistory,
      events: [event, ...state.events],
    };

    setState(nextState);
    persistWorkspaceAndEvent(nextState, event);

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
    let userEpk = state.userEpkBalance;
    let userUsdc = state.userUsdcBalance;
    let totalSupply = state.totalSupplyEpk;
    let reserveUsd = state.treasuryReserveUsd;
    let spotPrice = state.spotPriceUsd;
    let pendingLp = state.pendingAutoLpEpk;
    let totalAutoLp = state.totalAutoLpInjectedUsd;
    let pools = [...state.pools];
    const newEvents: ProtocolEvent[] = [];

    if (mode === 'psm-mint') {
      const fee = (amountIn * state.autoLpConfig.psmFeeBps) / 10000;
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
      const fee = (amountIn * state.autoLpConfig.psmFeeBps) / 10000;
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
      const fee = (amountIn * state.autoLpConfig.autoLpFeeBps) / 10000;
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
      const fee = (amountIn * state.autoLpConfig.autoLpFeeBps) / 10000;
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

    if (pendingLp >= state.autoLpConfig.liquifyThresholdEpk) {
      const batch = state.autoLpConfig.liquifyThresholdEpk;
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

    const nextState: ProtocolState = {
      ...state,
      userEpkBalance: userEpk,
      userUsdcBalance: userUsdc,
      totalSupplyEpk: totalSupply,
      treasuryReserveUsd: reserveUsd,
      spotPriceUsd: spotPrice,
      pendingAutoLpEpk: pendingLp,
      totalAutoLpInjectedUsd: totalAutoLp,
      pools,
      events: [...newEvents, ...state.events],
    };

    setState(nextState);
    if (currentUser) {
      void syncUserProfile(currentUser.uid, {
        epkBalance: userEpk,
        usdcBalance: userUsdc,
      }).catch(() => {});
      void syncWorkspaceState(currentUser.uid, nextState).catch(() => {});
      newEvents.forEach((ev) => {
        void appendLedgerEvent(currentUser.uid, ev).catch(() => {});
      });
    }
  };

  const handleUpdateAutoLpConfig = (partial: Partial<AutoLiquidityConfig>) => {
    const nextState: ProtocolState = {
      ...state,
      autoLpConfig: { ...state.autoLpConfig, ...partial },
    };
    setState(nextState);
    persistWorkspaceAndEvent(nextState);
  };

  const handleTriggerAutoLiquify = () => {
    if (state.pendingAutoLpEpk < 500) return;
    const batch = state.pendingAutoLpEpk;
    const half = batch / 2;
    const nextPools = state.pools.map((p, idx) =>
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
      summary: `Manual swapAndLiquify batch executed: ${Math.round(half).toLocaleString()} EPK paired with $${Math.round(half).toLocaleString()} USDC and locked for ${state.autoLpConfig.lpLockDays} days`,
      amountEpk: batch,
      usdValue: batch,
      postPegPrice: state.spotPriceUsd,
      txHash: makeTxHash(),
    };

    const nextState: ProtocolState = {
      ...state,
      pendingAutoLpEpk: 0,
      totalAutoLpInjectedUsd: state.totalAutoLpInjectedUsd + batch,
      pools: nextPools,
      events: [event, ...state.events],
    };

    setState(nextState);
    persistWorkspaceAndEvent(nextState, event);
    notify('Executed swapAndLiquify batch and locked generated LP tokens.');
  };

  const handleDeployDexPool = (exchangeId: string) => {
    const target = state.exchanges.find((e) => e.id === exchangeId);
    if (!target) return;

    const seedUsd = target.minLiquidityRequiredUsd;
    const nextExchanges = state.exchanges.map((e) =>
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

    const existingPendingPool = state.pools.find(
      (p) =>
        p.status === 'Pending Seed' &&
        p.venue.toLowerCase().includes(target.name.split(' ')[0].toLowerCase())
    );

    const nextPools = existingPendingPool
      ? state.pools.map((p) =>
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
          ...state.pools,
          {
            id: `pool-${Date.now()}`,
            venue: target.name,
            pair: target.pair,
            chain: state.activeChain,
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
      postPegPrice: state.spotPriceUsd,
      txHash: makeTxHash(),
    };

    const nextState: ProtocolState = {
      ...state,
      exchanges: nextExchanges,
      pools: nextPools,
      events: [event, ...state.events],
    };

    setState(nextState);
    persistWorkspaceAndEvent(nextState, event);
    notify('DEX liquidity pool deployed and added to active protocol routing.');
  };

  const handleToggleRequirement = (
    exchangeId: string,
    field: 'marketMakerCommitted' | 'apiFeedReady'
  ) => {
    const nextState: ProtocolState = {
      ...state,
      exchanges: state.exchanges.map((e) =>
        e.id === exchangeId ? { ...e, [field]: !e[field] } : e
      ),
    };
    setState(nextState);
    persistWorkspaceAndEvent(nextState);
  };

  const handleSubmitCexApplication = (exchangeId: string) => {
    const target = state.exchanges.find((e) => e.id === exchangeId);
    if (!target) return;

    const nextExchanges = state.exchanges.map((e) =>
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
      postPegPrice: state.spotPriceUsd,
      txHash: makeTxHash(),
    };

    const nextState: ProtocolState = {
      ...state,
      exchanges: nextExchanges,
      events: [event, ...state.events],
    };

    setState(nextState);
    persistWorkspaceAndEvent(nextState, event);
    notify('Institutional listing application submitted and logged to ledger.');
  };

  const handleAddCustomExchange = (venue: {
    name: string;
    category: 'DEX' | 'Tier-1 CEX' | 'Tier-2 CEX';
    pair: string;
    minLiquidityRequiredUsd: number;
  }) => {
    const nextState: ProtocolState = {
      ...state,
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
        ...state.exchanges,
      ],
    };
    setState(nextState);
    persistWorkspaceAndEvent(nextState);
    notify(`Added ${venue.name} to exchange listing pipeline.`);
  };

  const handleRunAttestation = () => {
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    const event: ProtocolEvent = {
      id: `evt-${Date.now()}`,
      timestamp: makeUtcTime(),
      type: 'Rebalance',
      summary: `Treasury Proof-of-Reserves attestation verified ($${state.treasuryReserveUsd.toLocaleString()} backing ${state.totalSupplyEpk.toLocaleString()} EPK)`,
      amountEpk: state.totalSupplyEpk,
      usdValue: state.treasuryReserveUsd,
      postPegPrice: state.spotPriceUsd,
      txHash: makeTxHash(),
    };
    const nextState: ProtocolState = {
      ...state,
      reserves: state.reserves.map((r) => ({ ...r, lastAttested: timestamp })),
      events: [event, ...state.events],
    };
    setState(nextState);
    persistWorkspaceAndEvent(nextState, event);
    notify('Proof of Reserves attestation verified and timestamped.');
  };

  const handleChangeLockTier = (tier: GovernanceLockTier) => {
    setState((prev) => ({ ...prev, governanceLockTier: tier }));
    if (currentUser) {
      void syncUserProfile(currentUser.uid, { governanceLockTier: tier }).catch(
        () => {}
      );
    }
    notify(`Governance voting multiplier updated to ${LOCK_MULTIPLIERS[tier].label}.`);
  };

  const handleCastVote = (
    proposalId: string,
    choice: 'for' | 'against' | 'abstain'
  ) => {
    const vp = Math.floor(
      state.userEpkBalance * LOCK_MULTIPLIERS[state.governanceLockTier].multiplier
    );
    if (vp <= 0) return;

    const target = state.proposals.find((p) => p.id === proposalId);
    if (!target || target.status === 'Executed') return;

    const hadExistingVote = target.userVote !== null;
    let updatedProposal: GovernanceProposal = target;

    const nextProposals = state.proposals.map((p) => {
      if (p.id !== proposalId) return p;
      let nextFor = p.votesFor;
      let nextAgainst = p.votesAgainst;
      let nextAbstain = p.votesAbstain;

      if (p.userVote === 'for') nextFor = Math.max(0, nextFor - p.userVotePower);
      if (p.userVote === 'against')
        nextAgainst = Math.max(0, nextAgainst - p.userVotePower);
      if (p.userVote === 'abstain')
        nextAbstain = Math.max(0, nextAbstain - p.userVotePower);

      if (choice === 'for') nextFor += vp;
      if (choice === 'against') nextAgainst += vp;
      if (choice === 'abstain') nextAbstain += vp;

      const totalVotes = nextFor + nextAgainst + nextAbstain;
      const nextStatus =
        totalVotes >= p.quorumRequired && nextFor > nextAgainst
          ? ('Passed' as const)
          : ('Active' as const);

      updatedProposal = {
        ...p,
        votesFor: nextFor,
        votesAgainst: nextAgainst,
        votesAbstain: nextAbstain,
        userVote: choice,
        userVotePower: vp,
        status: p.status === 'Active' || p.status === 'Passed' ? nextStatus : p.status,
      };
      return updatedProposal;
    });

    const event: ProtocolEvent = {
      id: `evt-${Date.now()}`,
      timestamp: makeUtcTime(),
      type: 'Governance',
      summary: `Cast ${vp.toLocaleString()} vEPK vote (${choice.toUpperCase()}) on ${target.id}: ${target.title}`,
      amountEpk: vp,
      usdValue: state.userEpkBalance,
      postPegPrice: state.spotPriceUsd,
      txHash: makeTxHash(),
    };

    setState((prev) => ({
      ...prev,
      proposals: nextProposals,
      events: [event, ...prev.events],
    }));

    if (currentUser) {
      void castProposalVoteInDb(
        currentUser.uid,
        updatedProposal,
        choice,
        vp,
        hadExistingVote
      ).catch(() => {
        notify('Unable to persist governance vote.');
      });
      void appendLedgerEvent(currentUser.uid, event).catch(() => {});
    }
    notify(`Vote recorded on ${proposalId}.`);
  };

  const handleCreateProposal = (input: {
    title: string;
    description: string;
    category: ProposalCategory;
    parameterChange?: GovernanceParameterChange;
  }) => {
    const vp = Math.floor(
      state.userEpkBalance * LOCK_MULTIPLIERS[state.governanceLockTier].multiplier
    );
    const nextNum = state.proposals.length + 4;
    const newId = `EPK-GIP-${String(nextNum).padStart(2, '0')}`;
    const today = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 5 * 86400000)
      .toISOString()
      .slice(0, 10);

    const proposerLabel = currentUser?.displayName || currentUser?.email || '0xYou...EPK';

    const newProposal: GovernanceProposal = {
      id: newId,
      title: input.title,
      description: input.description,
      proposer: proposerLabel,
      category: input.category,
      parameterChange: input.parameterChange,
      votesFor: vp,
      votesAgainst: 0,
      votesAbstain: 0,
      quorumRequired: 500000,
      userVote: 'for',
      userVotePower: vp,
      status: 'Active',
      createdAt: today,
      endsAt: endDate,
    };

    const event: ProtocolEvent = {
      id: `evt-${Date.now()}`,
      timestamp: makeUtcTime(),
      type: 'Governance',
      summary: `Published ${newId}: ${input.title} (initial ${vp.toLocaleString()} vEPK support)`,
      amountEpk: vp,
      usdValue: state.userEpkBalance,
      postPegPrice: state.spotPriceUsd,
      txHash: makeTxHash(),
    };

    setState((prev) => ({
      ...prev,
      proposals: [newProposal, ...prev.proposals],
      events: [event, ...prev.events],
    }));

    if (currentUser) {
      void createGovernanceProposalInDb(
        currentUser.uid,
        proposerLabel,
        newProposal,
        vp
      ).catch(() => {
        notify('Unable to persist governance proposal.');
      });
      void appendLedgerEvent(currentUser.uid, event).catch(() => {});
    }
    notify('New governance proposal published and open for voting.');
  };

  const handleExecuteProposal = (proposalId: string) => {
    const target = state.proposals.find((p) => p.id === proposalId);
    if (!target || target.status !== 'Passed') return;

    const nextConfig = target.parameterChange
      ? {
          ...state.autoLpConfig,
          [target.parameterChange.field]: target.parameterChange.targetValue,
        }
      : state.autoLpConfig;

    const nextProposals = state.proposals.map((p) =>
      p.id === proposalId ? { ...p, status: 'Executed' as const } : p
    );

    const event: ProtocolEvent = {
      id: `evt-${Date.now()}`,
      timestamp: makeUtcTime(),
      type: 'Governance',
      summary: `Executed ${target.id} on-chain${
        target.parameterChange ? ` (${target.parameterChange.summaryLabel})` : ''
      }`,
      amountEpk: target.votesFor,
      usdValue: target.votesFor,
      postPegPrice: state.spotPriceUsd,
      txHash: makeTxHash(),
    };

    const nextState: ProtocolState = {
      ...state,
      autoLpConfig: nextConfig,
      proposals: nextProposals,
      events: [event, ...state.events],
    };

    setState(nextState);

    if (currentUser) {
      void executeGovernanceProposalInDb(proposalId).catch(() => {
        notify('Unable to mark proposal executed in Firestore.');
      });
      void syncWorkspaceState(currentUser.uid, nextState).catch(() => {});
      void appendLedgerEvent(currentUser.uid, event).catch(() => {});
    }
    notify(`Executed ${proposalId} and updated live protocol parameters.`);
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
        governanceLockTier={state.governanceLockTier}
        currentUser={currentUser}
        authLoading={authLoading}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
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

          {activeSection === 'governance' && (
            <GovernanceView
              proposals={state.proposals}
              userEpkBalance={state.userEpkBalance}
              lockTier={state.governanceLockTier}
              autoLpConfig={state.autoLpConfig}
              onChangeLockTier={handleChangeLockTier}
              onCastVote={handleCastVote}
              onCreateProposal={handleCreateProposal}
              onExecuteProposal={handleExecuteProposal}
              onNavigateToSwap={() => setActiveSection('auto-liquidity')}
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
