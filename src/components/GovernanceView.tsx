import { useState } from 'react';
import { Check, Plus, Search, Vote } from 'lucide-react';
import {
  AutoLiquidityConfig,
  GovernanceLockTier,
  GovernanceParameterChange,
  GovernanceProposal,
  ProposalCategory,
} from '../types/protocol';
import { formatNumber } from '../utils/format';

interface GovernanceViewProps {
  proposals: GovernanceProposal[];
  userEpkBalance: number;
  lockTier: GovernanceLockTier;
  autoLpConfig: AutoLiquidityConfig;
  onChangeLockTier: (tier: GovernanceLockTier) => void;
  onCastVote: (proposalId: string, choice: 'for' | 'against' | 'abstain') => void;
  onCreateProposal: (input: {
    title: string;
    description: string;
    category: ProposalCategory;
    parameterChange?: GovernanceParameterChange;
  }) => void;
  onExecuteProposal: (proposalId: string) => void;
  onNavigateToSwap: () => void;
}

export const LOCK_MULTIPLIERS: Record<
  GovernanceLockTier,
  { label: string; shortLabel: string; multiplier: number }
> = {
  liquid: { label: 'Liquid Wallet EPK (1.0x)', shortLabel: 'Liquid · 1.0x', multiplier: 1.0 },
  '90d': { label: '90-Day Staked veEPK (1.25x)', shortLabel: '90d Lock · 1.25x', multiplier: 1.25 },
  '365d': { label: '365-Day Locked veEPK (2.0x)', shortLabel: '365d Lock · 2.0x', multiplier: 2.0 },
};

const PROPOSAL_MIN_VP = 10000;

export function GovernanceView({
  proposals,
  userEpkBalance,
  lockTier,
  autoLpConfig,
  onChangeLockTier,
  onCastVote,
  onCreateProposal,
  onExecuteProposal,
  onNavigateToSwap,
}: GovernanceViewProps) {
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Active' | 'Passed' | 'Executed'
  >('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(proposals[0]?.id ?? '');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Proposal creation form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProposalCategory>('PSM Fee');
  const [targetValueInput, setTargetValueInput] = useState('3');

  const multiplier = LOCK_MULTIPLIERS[lockTier].multiplier;
  const votingPower = Math.floor(userEpkBalance * multiplier);
  const quorumReference = 500000;
  const quorumSharePct = Math.min(100, (votingPower / quorumReference) * 100);
  const canCreateProposal = votingPower >= PROPOSAL_MIN_VP;

  const activeCount = proposals.filter((p) => p.status === 'Active').length;
  const executableCount = proposals.filter((p) => p.status === 'Passed').length;

  const filtered = proposals.filter((p) => {
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.id.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const selectedProposal =
    proposals.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  const getCategoryMeta = (cat: ProposalCategory) => {
    switch (cat) {
      case 'PSM Fee':
        return {
          field: 'psmFeeBps' as const,
          current: autoLpConfig.psmFeeBps,
          unit: 'bps',
          placeholder: '3',
          hint: `Current PSM Fee: ${autoLpConfig.psmFeeBps} bps (${(autoLpConfig.psmFeeBps / 100).toFixed(2)}%)`,
        };
      case 'Auto-LP Threshold':
        return {
          field: 'liquifyThresholdEpk' as const,
          current: autoLpConfig.liquifyThresholdEpk,
          unit: 'EPK',
          placeholder: '30000',
          hint: `Current Threshold: ${formatNumber(autoLpConfig.liquifyThresholdEpk, 0)} EPK`,
        };
      case 'Auto-LP Fee':
        return {
          field: 'autoLpFeeBps' as const,
          current: autoLpConfig.autoLpFeeBps,
          unit: 'bps',
          placeholder: '20',
          hint: `Current Auto-LP Fee: ${autoLpConfig.autoLpFeeBps} bps (${(autoLpConfig.autoLpFeeBps / 100).toFixed(2)}%)`,
        };
      case 'Peg Guard Band':
        return {
          field: 'pegGuardBandBps' as const,
          current: autoLpConfig.pegGuardBandBps,
          unit: 'bps',
          placeholder: '15',
          hint: `Current Peg Band: ±${autoLpConfig.pegGuardBandBps} bps`,
        };
      default:
        return null;
    }
  };

  const handleCategoryChange = (nextCat: ProposalCategory) => {
    setCategory(nextCat);
    const meta = getCategoryMeta(nextCat);
    if (meta) {
      setTargetValueInput(meta.placeholder);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateProposal || !title.trim() || !description.trim()) return;

    const meta = getCategoryMeta(category);
    let parameterChange: GovernanceParameterChange | undefined;

    if (meta) {
      const numericVal = Math.max(0, Number(targetValueInput) || 0);
      parameterChange = {
        field: meta.field,
        targetValue: numericVal,
        summaryLabel: `${category}: ${formatNumber(meta.current, 0)} ${meta.unit} → ${formatNumber(numericVal, 0)} ${meta.unit}`,
      };
    }

    onCreateProposal({
      title: title.trim(),
      description: description.trim(),
      category,
      parameterChange,
    });

    setTitle('');
    setDescription('');
    setShowCreateForm(false);
  };

  const getCurrentFieldValue = (
    field: GovernanceParameterChange['field']
  ): string => {
    switch (field) {
      case 'psmFeeBps':
        return `${autoLpConfig.psmFeeBps} bps`;
      case 'liquifyThresholdEpk':
        return `${formatNumber(autoLpConfig.liquifyThresholdEpk, 0)} EPK`;
      case 'autoLpFeeBps':
        return `${autoLpConfig.autoLpFeeBps} bps`;
      case 'pegGuardBandBps':
        return `±${autoLpConfig.pegGuardBandBps} bps`;
    }
  };

  return (
    <div className="space-y-6">
      {/* 4-Column Flat KPI & Voting Power Strip */}
      <section
        aria-label="Governance Voting Power Metrics"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Wallet EPK Holdings
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatNumber(userEpkBalance, 0)}
            </span>
            <button
              type="button"
              onClick={onNavigateToSwap}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Acquire EPK →
            </button>
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Calculated Voting Power
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatNumber(votingPower, 0)}
            </span>
            <span className="text-xs font-mono text-emerald-700 font-medium">
              vEPK ({multiplier.toFixed(2)}x)
            </span>
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Share of Proposal Quorum
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {quorumSharePct.toFixed(2)}%
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              of {formatNumber(quorumReference, 0)} vEPK
            </span>
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Governance Queue
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {activeCount} Active
            </span>
            <span className="text-xs font-mono tabular-nums text-emerald-700 font-medium">
              {executableCount} Ready to Execute
            </span>
          </div>
        </div>
      </section>

      {/* Voting Power Calculator & Lock Multiplier Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. Voting Power Weighting Formula
          </h2>
          <p className="text-xs text-slate-500">
            Mock voting power scales linearly with wallet EPK holdings:{' '}
            <span className="font-mono tabular-nums text-slate-800 font-medium">
              {formatNumber(userEpkBalance, 0)} EPK × {multiplier.toFixed(2)}x ={' '}
              {formatNumber(votingPower, 0)} vEPK
            </span>
            . Creating a proposal requires at least{' '}
            <span className="font-mono tabular-nums text-slate-700">
              {formatNumber(PROPOSAL_MIN_VP, 0)} vEPK
            </span>
            .
          </p>
        </div>

        <div
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0"
          role="group"
          aria-label="EPK Governance Lock Multiplier"
        >
          {(Object.keys(LOCK_MULTIPLIERS) as GovernanceLockTier[]).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => onChangeLockTier(tier)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                lockTier === tier
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {LOCK_MULTIPLIERS[tier].shortLabel}
            </button>
          ))}
        </div>
      </section>

      {/* Main Split: Proposals Pipeline + Proposal Voting & Execution Dossier */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  02. Protocol Improvement Proposals
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vote on fee parameters, auto-liquidity thresholds, and treasury allocations
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm((prev) => !prev)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{showCreateForm ? 'Close Form' : 'New Proposal'}</span>
              </button>
            </div>

            {showCreateForm && (
              <form
                onSubmit={handleCreateSubmit}
                className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Draft New Governance Proposal
                  </span>
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      canCreateProposal ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {canCreateProposal
                      ? `Eligible (${formatNumber(votingPower, 0)} vEPK)`
                      : `Requires ${formatNumber(PROPOSAL_MIN_VP, 0)} vEPK`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="prop-category"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Parameter Scope
                    </label>
                    <select
                      id="prop-category"
                      value={category}
                      onChange={(e) =>
                        handleCategoryChange(e.target.value as ProposalCategory)
                      }
                      className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="PSM Fee">PSM Fee (bps)</option>
                      <option value="Auto-LP Threshold">
                        Auto-LP Trigger Threshold (EPK)
                      </option>
                      <option value="Auto-LP Fee">Auto-LP Swap Fee (bps)</option>
                      <option value="Peg Guard Band">Peg Guard Band (bps)</option>
                      <option value="Treasury">Treasury Directive</option>
                    </select>
                  </div>

                  {category !== 'Treasury' && (
                    <div>
                      <label
                        htmlFor="prop-target"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Proposed Value ({getCategoryMeta(category)?.unit})
                      </label>
                      <input
                        id="prop-target"
                        type="number"
                        min={0}
                        required
                        value={targetValueInput}
                        onChange={(e) => setTargetValueInput(e.target.value)}
                        className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        {getCategoryMeta(category)?.hint}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="prop-title"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Proposal Title
                  </label>
                  <input
                    id="prop-title"
                    type="text"
                    required
                    placeholder="e.g. Reduce PSM Mint Fee to 3 bps for Arbitrage Volume"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prop-desc"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Rationale & Peg Impact
                  </label>
                  <textarea
                    id="prop-desc"
                    rows={3}
                    required
                    placeholder="Summarize how this change strengthens the $1.0000 peg or DEX liquidity depth..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canCreateProposal}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md whitespace-nowrap"
                  >
                    Publish Proposal
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['All', 'Active', 'Passed', 'Executed'] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        statusFilter === tab
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  )
                )}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Search proposals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {filtered.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  No proposals match your filter
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('All');
                    setSearchQuery('');
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filtered.map((prop) => {
                const isSelected = selectedProposal?.id === prop.id;
                const totalVotes =
                  prop.votesFor + prop.votesAgainst + prop.votesAbstain;
                const forPct =
                  totalVotes > 0 ? (prop.votesFor / totalVotes) * 100 : 0;

                const statusColor =
                  prop.status === 'Executed'
                    ? 'text-slate-600'
                    : prop.status === 'Passed'
                      ? 'text-emerald-700'
                      : prop.status === 'Active'
                        ? 'text-amber-700'
                        : 'text-rose-700';

                return (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() => setSelectedId(prop.id)}
                    className={`w-full text-left p-5 transition-colors block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
                      isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono text-slate-500">
                        {prop.id} · {prop.category} · Ends {prop.endsAt}
                      </span>
                      <span className={`font-semibold whitespace-nowrap ${statusColor}`}>
                        {prop.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 mt-1.5">
                      {prop.title}
                    </h3>

                    <div className="mt-3 flex items-center justify-between gap-4 text-xs text-slate-500">
                      <span className="font-mono tabular-nums">
                        For: {forPct.toFixed(1)}% ({formatNumber(prop.votesFor, 0)} vEPK)
                      </span>
                      <span className="font-mono tabular-nums">
                        {prop.userVote
                          ? `You voted ${prop.userVote.toUpperCase()}`
                          : 'Not voted'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Proposal Detail & Voting Console */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {selectedProposal ? (
            <>
              <div className="border-b border-slate-200 pb-4 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-mono">
                    {selectedProposal.id} · {selectedProposal.category}
                  </span>
                  <span className="font-mono">
                    Proposer {selectedProposal.proposer}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900">
                  {selectedProposal.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedProposal.description}
                </p>
              </div>

              {selectedProposal.parameterChange && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs">
                  <div className="font-medium text-slate-500">
                    On-Chain Parameter Payload
                  </div>
                  <div className="font-mono font-semibold text-slate-900">
                    {selectedProposal.parameterChange.summaryLabel}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Live protocol value:{' '}
                    {getCurrentFieldValue(selectedProposal.parameterChange.field)}
                  </div>
                </div>
              )}

              {/* Vote Tallies */}
              {(() => {
                const total =
                  selectedProposal.votesFor +
                  selectedProposal.votesAgainst +
                  selectedProposal.votesAbstain;
                const forPct =
                  total > 0 ? (selectedProposal.votesFor / total) * 100 : 0;
                const againstPct =
                  total > 0 ? (selectedProposal.votesAgainst / total) * 100 : 0;
                const abstainPct =
                  total > 0 ? (selectedProposal.votesAbstain / total) * 100 : 0;
                const quorumPct = Math.min(
                  100,
                  (total / selectedProposal.quorumRequired) * 100
                );

                return (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>Vote Tally</span>
                      <span className="font-mono tabular-nums text-slate-600 font-normal">
                        Quorum: {formatNumber(total, 0)} /{' '}
                        {formatNumber(selectedProposal.quorumRequired, 0)} vEPK (
                        {quorumPct.toFixed(0)}%)
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-700 font-medium">For</span>
                          <span className="font-mono tabular-nums text-emerald-700 font-medium">
                            {formatNumber(selectedProposal.votesFor, 0)} vEPK (
                            {forPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-700 transition-all duration-200"
                            style={{ width: `${forPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-700 font-medium">Against</span>
                          <span className="font-mono tabular-nums text-rose-700 font-medium">
                            {formatNumber(selectedProposal.votesAgainst, 0)} vEPK (
                            {againstPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-600 transition-all duration-200"
                            style={{ width: `${againstPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-700 font-medium">Abstain</span>
                          <span className="font-mono tabular-nums text-slate-600">
                            {formatNumber(selectedProposal.votesAbstain, 0)} vEPK (
                            {abstainPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-400 transition-all duration-200"
                            style={{ width: `${abstainPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Voting Controls */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                {selectedProposal.status === 'Executed' ? (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>
                      Proposal executed on-chain. Protocol state updated.
                    </span>
                  </div>
                ) : selectedProposal.status === 'Passed' ? (
                  <button
                    type="button"
                    onClick={() => onExecuteProposal(selectedProposal.id)}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Execute Passed Proposal On-Chain
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Cast Vote Weight</span>
                      <span className="font-mono tabular-nums font-medium text-slate-900">
                        {formatNumber(votingPower, 0)} vEPK
                      </span>
                    </div>

                    {selectedProposal.userVote && (
                      <div className="text-xs font-medium text-emerald-700">
                        Recorded vote: {selectedProposal.userVote.toUpperCase()} (
                        {formatNumber(selectedProposal.userVotePower, 0)} vEPK) —
                        click below to switch your vote.
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={votingPower <= 0}
                        onClick={() => onCastVote(selectedProposal.id, 'for')}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                          selectedProposal.userVote === 'for'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-800 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                        }`}
                      >
                        Vote For
                      </button>
                      <button
                        type="button"
                        disabled={votingPower <= 0}
                        onClick={() => onCastVote(selectedProposal.id, 'against')}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                          selectedProposal.userVote === 'against'
                            ? 'bg-rose-700 text-white border-rose-700'
                            : 'bg-white text-slate-800 border-slate-200 hover:bg-rose-50 hover:border-rose-300'
                        }`}
                      >
                        Vote Against
                      </button>
                      <button
                        type="button"
                        disabled={votingPower <= 0}
                        onClick={() => onCastVote(selectedProposal.id, 'abstain')}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                          selectedProposal.userVote === 'abstain'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Abstain
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <Vote className="h-4 w-4 text-slate-400" />
              <span>Select a proposal to inspect parameters and cast your vote.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
