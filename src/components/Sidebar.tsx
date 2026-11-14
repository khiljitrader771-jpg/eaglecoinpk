import { User } from 'firebase/auth';
import {
  Activity,
  ArrowLeftRight,
  Building2,
  Code2,
  Landmark,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { GovernanceLockTier, NavSection } from '../types/protocol';
import { formatNumber, formatPegPrice } from '../utils/format';
import { LOCK_MULTIPLIERS } from './GovernanceView';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  spotPriceUsd: number;
  userEpkBalance: number;
  userUsdcBalance: number;
  governanceLockTier: GovernanceLockTier;
  currentUser: User | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview & Peg', icon: Activity },
  { id: 'auto-liquidity', label: 'Auto-Liquidity', icon: ArrowLeftRight },
  { id: 'exchanges', label: 'Exchange Listings', icon: Building2 },
  { id: 'governance', label: 'Governance', icon: Landmark },
  { id: 'contracts', label: 'Smart Contracts', icon: Code2 },
  { id: 'reserves', label: 'Reserves & Ledger', icon: ShieldCheck },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  spotPriceUsd,
  userEpkBalance,
  userUsdcBalance,
  governanceLockTier,
  currentUser,
  authLoading,
  onSignIn,
  onSignOut,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pegDeltaPct = ((spotPriceUsd - 1) * 100).toFixed(2);
  const pegSign = spotPriceUsd >= 1 ? '+' : '';
  const votingPower = Math.floor(
    userEpkBalance * LOCK_MULTIPLIERS[governanceLockTier].multiplier
  );

  const content = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 w-64">
      <div>
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200">
          <img
            src="/src/assets/images/eaglecoin_crest_1794681024707.jpg"
            alt="Eaglecoinpk Crest"
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full object-cover border border-slate-200 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-display text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap">
              Eaglecoinpk
            </div>
            <div className="text-xs text-slate-500 whitespace-nowrap">
              EPK · USD Stablecoin
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1" aria-label="Primary Workspace">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/70">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">EPK Spot Price</span>
          <span className="font-mono tabular-nums font-medium text-slate-900">
            {formatPegPrice(spotPriceUsd)} ({pegSign}
            {pegDeltaPct}%)
          </span>
        </div>
        <div className="h-px bg-slate-200" />
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Wallet EPK</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {formatNumber(userEpkBalance, 2)} EPK
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Wallet USDC</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {formatNumber(userUsdcBalance, 2)} USDC
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Voting Power</span>
            <span className="font-mono tabular-nums font-medium text-emerald-700">
              {formatNumber(votingPower, 0)} vEPK
            </span>
          </div>
        </div>
        <div className="h-px bg-slate-200" />
        {currentUser ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-900 truncate">
                {currentUser.displayName || 'EPK Account'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {currentUser.email}
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors shrink-0"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={authLoading}
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            <span>{authLoading ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full">{content}</aside>
        </div>
      )}
    </>
  );
}
