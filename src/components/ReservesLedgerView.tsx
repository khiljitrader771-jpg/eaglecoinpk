import { useState } from 'react';
import { Download, Search, ShieldCheck } from 'lucide-react';
import { ProtocolEvent, ProtocolState } from '../types/protocol';
import { downloadTextFile, formatNumber, formatUsd } from '../utils/format';

interface ReservesLedgerViewProps {
  state: ProtocolState;
  onRunAttestation: () => void;
}

export function ReservesLedgerView({
  state,
  onRunAttestation,
}: ReservesLedgerViewProps) {
  const [eventFilter, setEventFilter] = useState<'All' | ProtocolEvent['type']>(
    'All'
  );
  const [search, setSearch] = useState('');

  const reserveRatio =
    state.totalSupplyEpk > 0
      ? (state.treasuryReserveUsd / state.totalSupplyEpk) * 100
      : 100;

  const filteredEvents = state.events.filter((ev) => {
    const matchesType = eventFilter === 'All' || ev.type === eventFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ev.summary.toLowerCase().includes(q) ||
      ev.txHash.toLowerCase().includes(q) ||
      ev.type.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const handleExportCsv = () => {
    const header = 'Timestamp,Type,Summary,Amount_EPK,USD_Value,Post_Peg_USD,Tx_Hash\n';
    const rows = filteredEvents
      .map(
        (e) =>
          `"${e.timestamp}","${e.type}","${e.summary.replace(/"/g, '""')}",${e.amountEpk},${e.usdValue},${e.postPegPrice.toFixed(4)},"${e.txHash}"`
      )
      .join('\n');
    downloadTextFile('eaglecoinpk_ledger.csv', header + rows, 'text/csv');
  };

  return (
    <div className="space-y-6">
      {/* Proof of Reserves Breakdown */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              01. Treasury Proof of Reserves
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Total Reserves{' '}
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {formatUsd(state.treasuryReserveUsd, 0)}
              </span>{' '}
              backing{' '}
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {formatNumber(state.totalSupplyEpk, 0)} EPK
              </span>{' '}
              ({reserveRatio.toFixed(2)}% collateralization ratio)
            </p>
          </div>
          <button
            type="button"
            onClick={onRunAttestation}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Run Live Reserve Attestation</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-6">Reserve Instrument</th>
                <th className="py-2.5 px-4">Custodian</th>
                <th className="py-2.5 px-4">Class</th>
                <th className="py-2.5 px-4 text-right">USD Value</th>
                <th className="py-2.5 px-4 text-right">Allocation</th>
                <th className="py-2.5 px-6 text-right">Account / Last Attested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {state.reserves.map((res) => (
                <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-6 font-medium text-slate-900 whitespace-nowrap">
                    {res.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                    {res.custodian}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {res.assetType}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                    {formatUsd(res.amountUsd, 0)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {res.sharePct.toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono text-slate-500 whitespace-nowrap">
                    {res.walletOrAccount} · {res.lastAttested}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Full Protocol Ledger */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                02. Immutable Protocol & Liquidity Ledger
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Filterable audit trail of every mint, redeem, auto-LP batch, and peg rebalance event
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  'All',
                  'Mint',
                  'Redeem',
                  'Swap',
                  'Auto-LP',
                  'Rebalance',
                  'Exchange',
                  'Governance',
                ] as const
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventFilter(type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    eventFilter === type
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search summary or hash..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredEvents.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">
                No ledger records match your search
              </p>
              <button
                type="button"
                onClick={() => {
                  setEventFilter('All');
                  setSearch('');
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Timestamp</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Summary</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Post-Tx Peg</th>
                  <th className="py-2.5 px-6 text-right">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {evt.timestamp}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {evt.type}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-lg">
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
          )}
        </div>
      </section>
    </div>
  );
}
