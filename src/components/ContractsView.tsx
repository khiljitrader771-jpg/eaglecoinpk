import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import {
  generateDeployScript,
  generateEaglecoinSolidity,
  generatePsmSolidity,
  generateTokenListJson,
} from '../data/contracts';
import { SUPPORTED_CHAINS } from '../data/initialProtocol';
import { AutoLiquidityConfig, ChainId } from '../types/protocol';
import { downloadTextFile } from '../utils/format';

interface ContractsViewProps {
  activeChain: ChainId;
  config: AutoLiquidityConfig;
}

type ContractTab = 'epk' | 'psm' | 'deploy' | 'tokenlist';

export function ContractsView({ activeChain, config }: ContractsViewProps) {
  const [activeTab, setActiveTab] = useState<ContractTab>('epk');
  const [copied, setCopied] = useState(false);

  const chain = SUPPORTED_CHAINS[activeChain];

  const files: Record<
    ContractTab,
    { label: string; filename: string; content: string; summary: string }
  > = {
    epk: {
      label: 'EaglecoinPK.sol',
      filename: 'EaglecoinPK.sol',
      content: generateEaglecoinSolidity(chain, config),
      summary:
        'ERC-20 USD stablecoin with built-in swapAndLiquify Auto-Liquidity Engine and Treasury Role access control.',
    },
    psm: {
      label: 'EaglePegStabilityModule.sol',
      filename: 'EaglePegStabilityModule.sol',
      content: generatePsmSolidity(chain, config),
      summary:
        'Zero-slippage 1:1 USDC/USDT mint and redeem module anchoring EPK to $1.0000 USD.',
    },
    deploy: {
      label: 'deploy.ts',
      filename: 'deploy.ts',
      content: generateDeployScript(chain),
      summary:
        'Hardhat / Ethers v6 deployment script linking EPK, PSM, and initial DEX pool seeding.',
    },
    tokenlist: {
      label: 'epk.tokenlist.json',
      filename: 'epk.tokenlist.json',
      content: generateTokenListJson(chain),
      summary:
        'Standard TokenList metadata schema for Uniswap, PancakeSwap, TrustWallet, and CoinGecko indexing.',
    },
  };

  const currentFile = files[activeTab];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    downloadTextFile(currentFile.filename, currentFile.content);
  };

  return (
    <div className="space-y-6">
      {/* Network Parameters Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-slate-500">Target Network</div>
          <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
            {chain.name} (ID {chain.chainIdNum})
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">DEX Router</div>
          <div className="font-mono text-xs text-slate-800 mt-1 truncate">
            {chain.routerAddress}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Quote Reserve Asset (USDC)</div>
          <div className="font-mono text-xs text-slate-800 mt-1 truncate">
            {chain.usdcAddress}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Synced Auto-LP Parameters</div>
          <div className="font-mono tabular-nums text-xs font-medium text-emerald-700 mt-1">
            {config.autoLpFeeBps} bps · {config.liquifyThresholdEpk.toLocaleString()} EPK threshold
          </div>
        </div>
      </section>

      {/* Code Explorer */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(Object.keys(files) as ContractTab[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {files[key].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download {currentFile.filename}</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
          {currentFile.summary}
        </div>

        <pre className="p-6 bg-slate-950 text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto max-h-[600px]">
          <code>{currentFile.content}</code>
        </pre>
      </section>
    </div>
  );
}
