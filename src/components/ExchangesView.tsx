import { useState } from 'react';
import { Check, Download, Search, X } from 'lucide-react';
import { SUPPORTED_CHAINS } from '../data/initialProtocol';
import { generateTokenListJson } from '../data/contracts';
import { ChainId, ExchangeVenue } from '../types/protocol';
import { downloadTextFile, formatCompactUsd } from '../utils/format';

interface ExchangesViewProps {
  exchanges: ExchangeVenue[];
  activeChain: ChainId;
  onDeployDexPool: (exchangeId: string) => void;
  onToggleRequirement: (
    exchangeId: string,
    field: 'marketMakerCommitted' | 'apiFeedReady'
  ) => void;
  onSubmitCexApplication: (exchangeId: string) => void;
  onAddCustomExchange: (venue: {
    name: string;
    category: 'DEX' | 'Tier-1 CEX' | 'Tier-2 CEX';
    pair: string;
    minLiquidityRequiredUsd: number;
  }) => void;
}

export function ExchangesView({
  exchanges,
  activeChain,
  onDeployDexPool,
  onToggleRequirement,
  onSubmitCexApplication,
  onAddCustomExchange,
}: ExchangesViewProps) {
  const [filter, setFilter] = useState<'all' | 'DEX' | 'Tier-1 CEX' | 'Tier-2 CEX'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    exchanges[2]?.id ?? null
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'DEX' | 'Tier-1 CEX' | 'Tier-2 CEX'>(
    'Tier-2 CEX'
  );
  const [newPair, setNewPair] = useState('EPK / USDT');
  const [newMinLiq, setNewMinLiq] = useState('300000');

  const filtered = exchanges.filter((ex) => {
    const matchesFilter = filter === 'all' || ex.category === filter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ex.name.toLowerCase().includes(q) ||
      ex.pair.toLowerCase().includes(q) ||
      ex.status.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const selectedExchange =
    exchanges.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  const listedCount = exchanges.filter((e) => e.status === 'Listed').length;
  const inReviewCount = exchanges.filter((e) => e.status === 'In Review').length;
  const totalExchangeLiquidity = exchanges.reduce(
    (sum, e) => sum + e.liquidityUsd,
    0
  );

  const handleDownloadTokenList = () => {
    const chain = SUPPORTED_CHAINS[activeChain];
    downloadTextFile(
      'epk.tokenlist.json',
      generateTokenListJson(chain),
      'application/json'
    );
  };

  const handleCreateVenue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddCustomExchange({
      name: newName.trim(),
      category: newCategory,
      pair: newPair.trim() || 'EPK / USDT',
      minLiquidityRequiredUsd: Math.max(50000, Number(newMinLiq) || 250000),
    });
    setNewName('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Strip */}
      <section className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <div className="text-xs text-slate-500">Active Exchange Listings</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {listedCount} Live · {inReviewCount} In Review
          </div>
        </div>
        <div className="p-5 space-y-1">
          <div className="text-xs text-slate-500">Total Exchange Orderbook & Pool Depth</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {formatCompactUsd(totalExchangeLiquidity)}
          </div>
        </div>
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">DEX & Aggregator Metadata</div>
            <div className="text-sm font-medium text-slate-900">
              Uniswap / CoinGecko TokenList JSON
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadTokenList}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </section>

      {/* Main Split: Exchange Table + Listing Dossier Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  01. DEX & CEX Exchange Pipeline
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deploy automated liquidity pools on DEXs and submit institutional dossiers to centralized exchanges
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm((prev) => !prev)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {showAddForm ? 'Close Form' : 'Add Target Exchange'}
              </button>
            </div>

            {showAddForm && (
              <form
                onSubmit={handleCreateVenue}
                className="p-4 border border-slate-200 rounded-lg bg-slate-50 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Exchange Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kraken"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Venue Type
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) =>
                      setNewCategory(
                        e.target.value as 'DEX' | 'Tier-1 CEX' | 'Tier-2 CEX'
                      )
                    }
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="DEX">DEX</option>
                    <option value="Tier-1 CEX">Tier-1 CEX</option>
                    <option value="Tier-2 CEX">Tier-2 CEX</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Trading Pair & Min Depth ($)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPair}
                      onChange={(e) => setNewPair(e.target.value)}
                      className="w-1/2 h-9 px-2.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
                    />
                    <input
                      type="number"
                      value={newMinLiq}
                      onChange={(e) => setNewMinLiq(e.target.value)}
                      className="w-1/2 h-9 px-2.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="h-9 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md whitespace-nowrap"
                >
                  Save Venue
                </button>
              </form>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'DEX', 'Tier-1 CEX', 'Tier-2 CEX'] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilter(tab)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        filter === tab
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab === 'all' ? 'All Venues' : tab}
                    </button>
                  )
                )}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Search exchange or pair..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  No exchange venues match your filter
                </p>
                <p className="text-xs text-slate-500">
                  Reset the category filter or search term to inspect all listing targets.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSearchQuery('');
                  }}
                  className="mt-2 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-5">Exchange</th>
                    <th className="py-2.5 px-4">Pair</th>
                    <th className="py-2.5 px-4 text-right">Liquidity</th>
                    <th className="py-2.5 px-4 text-right">Min Depth</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filtered.map((ex) => {
                    const isSelected = selectedExchange?.id === ex.id;
                    const statusColor =
                      ex.status === 'Listed'
                        ? 'text-emerald-700'
                        : ex.status === 'In Review'
                          ? 'text-amber-700'
                          : 'text-slate-600';

                    return (
                      <tr
                        key={ex.id}
                        onClick={() => setSelectedId(ex.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-5 whitespace-nowrap">
                          <div className="font-medium text-slate-900">{ex.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {ex.category} · {ex.estimatedLaunch}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          {ex.pair}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {ex.liquidityUsd > 0
                            ? formatCompactUsd(ex.liquidityUsd)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {formatCompactUsd(ex.minLiquidityRequiredUsd)}
                        </td>
                        <td
                          className={`py-3 px-4 font-medium whitespace-nowrap ${statusColor}`}
                        >
                          {ex.status}
                        </td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(ex.id);
                            }}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            {ex.status === 'Listed' ? 'Inspect' : 'Manage →'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Right: Selected Venue Listing Dossier */}
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {selectedExchange ? (
            <>
              <div className="border-b border-slate-200 pb-4">
                <div className="text-xs text-slate-500">
                  {selectedExchange.category} · {selectedExchange.pair}
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900 mt-1">
                  {selectedExchange.name}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {selectedExchange.notes}
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="font-semibold text-slate-900">
                  Institutional Listing Checklist
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Smart Contract Security Audit</span>
                  <span className="flex items-center gap-1 font-medium text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Stablecoin Reserve Legal Opinion</span>
                  <span className="flex items-center gap-1 font-medium text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Signed
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">
                    Market Maker Depth ({formatCompactUsd(selectedExchange.minLiquidityRequiredUsd)})
                  </span>
                  {selectedExchange.status === 'Listed' ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleRequirement(
                          selectedExchange.id,
                          'marketMakerCommitted'
                        )
                      }
                      className={`font-medium ${
                        selectedExchange.marketMakerCommitted
                          ? 'text-emerald-700'
                          : 'text-amber-700 underline underline-offset-2'
                      }`}
                    >
                      {selectedExchange.marketMakerCommitted
                        ? 'Committed'
                        : 'Commit Depth'}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">
                    Oracle & Exchange API Sync
                  </span>
                  {selectedExchange.status === 'Listed' ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> Synced
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleRequirement(selectedExchange.id, 'apiFeedReady')
                      }
                      className={`font-medium ${
                        selectedExchange.apiFeedReady
                          ? 'text-emerald-700'
                          : 'text-amber-700 underline underline-offset-2'
                      }`}
                    >
                      {selectedExchange.apiFeedReady ? 'Synced' : 'Enable Feed'}
                    </button>
                  )}
                </div>
              </div>

              {selectedExchange.status === 'Listed' ? (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                  EPK spot liquidity is live on {selectedExchange.name} with{' '}
                  <span className="font-mono font-semibold">
                    {formatCompactUsd(selectedExchange.liquidityUsd)}
                  </span>{' '}
                  active depth.
                </div>
              ) : selectedExchange.category === 'DEX' ? (
                <button
                  type="button"
                  onClick={() => onDeployDexPool(selectedExchange.id)}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  Deploy & Seed {selectedExchange.name} Pool ({formatCompactUsd(selectedExchange.minLiquidityRequiredUsd)})
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    selectedExchange.status === 'In Review' ||
                    !selectedExchange.marketMakerCommitted ||
                    !selectedExchange.apiFeedReady
                  }
                  onClick={() => onSubmitCexApplication(selectedExchange.id)}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
                >
                  {selectedExchange.status === 'In Review'
                    ? 'Application Under Exchange Review'
                    : !selectedExchange.marketMakerCommitted ||
                        !selectedExchange.apiFeedReady
                      ? 'Complete Checklist Above to Submit'
                      : `Submit ${selectedExchange.name} Listing Dossier`}
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
              <X className="h-4 w-4 text-slate-400" />
              Select an exchange from the pipeline to view its listing requirements.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
