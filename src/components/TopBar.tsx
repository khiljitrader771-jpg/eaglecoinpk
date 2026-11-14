import { Menu } from 'lucide-react';
import { SUPPORTED_CHAINS } from '../data/initialProtocol';
import { ChainId, NavSection } from '../types/protocol';

interface TopBarProps {
  activeSection: NavSection;
  activeChain: ChainId;
  onChangeChain: (chain: ChainId) => void;
  onOpenSwapAction: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_LABELS: Record<NavSection, string> = {
  overview: 'Overview & Peg Stability',
  'auto-liquidity': 'Auto-Liquidity Engine',
  exchanges: 'Exchange Listings',
  governance: 'Protocol Governance',
  contracts: 'Smart Contracts & Deployment',
  reserves: 'Proof of Reserves & Ledger',
};

export function TopBar({
  activeSection,
  activeChain,
  onChangeChain,
  onOpenSwapAction,
  onOpenMobileMenu,
}: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 whitespace-nowrap hidden sm:inline">
            Eaglecoinpk
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {SECTION_LABELS[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <label htmlFor="chain-select" className="sr-only">
          Select Target Network
        </label>
        <select
          id="chain-select"
          value={activeChain}
          onChange={(e) => onChangeChain(e.target.value as ChainId)}
          className="h-9 px-3 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 whitespace-nowrap shrink-0"
        >
          {Object.values(SUPPORTED_CHAINS).map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onOpenSwapAction}
          className="h-9 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          Mint / Swap EPK
        </button>
      </div>
    </header>
  );
}
