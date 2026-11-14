export type NavSection =
  | 'overview'
  | 'auto-liquidity'
  | 'exchanges'
  | 'governance'
  | 'contracts'
  | 'reserves';

export type ChainId = 'bsc' | 'ethereum' | 'base' | 'polygon';

export interface ChainConfig {
  id: ChainId;
  name: string;
  shortName: string;
  chainIdNum: number;
  nativeSymbol: string;
  dexName: string;
  routerAddress: string;
  usdcAddress: string;
  oracleFeed: string;
  blockExplorer: string;
}

export interface LiquidityPool {
  id: string;
  venue: string;
  pair: string;
  chain: ChainId;
  epkReserve: number;
  quoteReserve: number;
  tvlUsd: number;
  volume24hUsd: number;
  feeBps: number;
  apyPct: number;
  lpLockedPct: number;
  status: 'Active' | 'Pending Seed';
  poolAddress: string;
}

export interface ExchangeVenue {
  id: string;
  name: string;
  category: 'DEX' | 'Tier-1 CEX' | 'Tier-2 CEX';
  pair: string;
  status: 'Listed' | 'In Review' | 'Ready' | 'Requirements Pending';
  liquidityUsd: number;
  volume24hUsd: number;
  minLiquidityRequiredUsd: number;
  auditVerified: boolean;
  legalOpinionReady: boolean;
  marketMakerCommitted: boolean;
  apiFeedReady: boolean;
  estimatedLaunch: string;
  notes: string;
}

export interface ReserveAsset {
  id: string;
  name: string;
  custodian: string;
  assetType: 'US Treasury' | 'Stablecoin Custody' | 'DEX Reserve' | 'Commodity Hedge';
  amountUsd: number;
  sharePct: number;
  walletOrAccount: string;
  lastAttested: string;
}

export interface PegHistoryPoint {
  time: string;
  price: number;
  liquidityInjectedUsd: number;
  supplyM: number;
}

export interface TvlHistoryPoint {
  date: string;
  totalTvlUsd: number;
  activePoolsCount: number;
  autoLpContributionUsd: number;
}

export interface ProtocolEvent {
  id: string;
  timestamp: string;
  type: 'Mint' | 'Redeem' | 'Swap' | 'Auto-LP' | 'Rebalance' | 'Exchange' | 'Governance';
  summary: string;
  amountEpk: number;
  usdValue: number;
  postPegPrice: number;
  txHash: string;
}

export type ProposalCategory =
  | 'PSM Fee'
  | 'Auto-LP Threshold'
  | 'Auto-LP Fee'
  | 'Peg Guard Band'
  | 'Treasury';

export type GovernanceLockTier = 'liquid' | '90d' | '365d';

export interface GovernanceParameterChange {
  field: 'psmFeeBps' | 'liquifyThresholdEpk' | 'autoLpFeeBps' | 'pegGuardBandBps';
  targetValue: number;
  summaryLabel: string;
}

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  category: ProposalCategory;
  parameterChange?: GovernanceParameterChange;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorumRequired: number;
  userVote: 'for' | 'against' | 'abstain' | null;
  userVotePower: number;
  status: 'Active' | 'Passed' | 'Executed' | 'Rejected';
  createdAt: string;
  endsAt: string;
}

export interface AutoLiquidityConfig {
  autoLpFeeBps: number; // e.g., 25 = 0.25%
  liquifyThresholdEpk: number; // e.g., 50,000 EPK
  pegGuardBandBps: number; // e.g., 30 = ±0.30%
  lpLockDays: number; // e.g., 365 days
  autoCompoundEnabled: boolean;
  psmFeeBps: number; // e.g., 5 = 0.05% mint/redeem fee
}

export interface ProtocolState {
  activeChain: ChainId;
  spotPriceUsd: number;
  targetPegUsd: number;
  totalSupplyEpk: number;
  treasuryReserveUsd: number;
  pendingAutoLpEpk: number;
  totalAutoLpInjectedUsd: number;
  userEpkBalance: number;
  userUsdcBalance: number;
  governanceLockTier: GovernanceLockTier;
  autoLpConfig: AutoLiquidityConfig;
  pools: LiquidityPool[];
  exchanges: ExchangeVenue[];
  reserves: ReserveAsset[];
  pegHistory: PegHistoryPoint[];
  tvlHistory: TvlHistoryPoint[];
  proposals: GovernanceProposal[];
  events: ProtocolEvent[];
}
