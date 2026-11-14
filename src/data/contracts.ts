import { AutoLiquidityConfig, ChainConfig } from '../types/protocol';

export function generateEaglecoinSolidity(
  chain: ChainConfig,
  config: AutoLiquidityConfig
): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IDEXRouter {
    function factory() external pure returns (address);
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

interface IDEXFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

/**
 * @title Eaglecoinpk (EPK)
 * @notice USD-Pegged Stablecoin with Automated Liquidity Engine (swapAndLiquify)
 * @dev Target Network: ${chain.name} (Chain ID: ${chain.chainIdNum})
 */
contract EaglecoinPK is ERC20, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    IDEXRouter public immutable dexRouter;
    address public immutable quoteStablecoin; // USDC / USDT
    address public immutable liquidityPair;
    address public lpVault;

    uint256 public autoLpFeeBps = ${config.autoLpFeeBps}; // ${(config.autoLpFeeBps / 100).toFixed(2)}%
    uint256 public liquifyThreshold = ${config.liquifyThresholdEpk} * 1e18;
    uint256 public constant MAX_AUTO_LP_BPS = 100; // Capped at 1.00%

    bool private _inSwapAndLiquify;
    bool public autoLiquifyEnabled = true;

    mapping(address => bool) public isAutomatedMarketMakerPair;
    mapping(address => bool) public isFeeExempt;

    event AutoLiquidityInjected(uint256 epkSwapped, uint256 quotePaired, uint256 epkAddedToPool);
    event AutoLiquifyConfigUpdated(uint256 feeBps, uint256 threshold, bool enabled);

    modifier lockTheSwap() {
        _inSwapAndLiquify = true;
        _;
        _inSwapAndLiquify = false;
    }

    constructor(address _treasuryMultisig, address _lpVault)
        ERC20("Eaglecoinpk", "EPK")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, _treasuryMultisig);
        _grantRole(TREASURY_ROLE, _treasuryMultisig);
        _grantRole(MINTER_ROLE, _treasuryMultisig);

        dexRouter = IDEXRouter(${chain.routerAddress});
        quoteStablecoin = ${chain.usdcAddress};
        lpVault = _lpVault;

        liquidityPair = IDEXFactory(dexRouter.factory()).createPair(address(this), quoteStablecoin);
        isAutomatedMarketMakerPair[liquidityPair] = true;

        isFeeExempt[_treasuryMultisig] = true;
        isFeeExempt[address(this)] = true;
        isFeeExempt[_lpVault] = true;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burnFrom(address account, uint256 amount) external onlyRole(MINTER_ROLE) {
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        uint256 contractBalance = balanceOf(address(this));
        bool overThreshold = contractBalance >= liquifyThreshold;

        if (
            overThreshold &&
            !_inSwapAndLiquify &&
            !isAutomatedMarketMakerPair[from] &&
            autoLiquifyEnabled
        ) {
            _swapAndLiquify(liquifyThreshold);
        }

        bool takeFee = (isAutomatedMarketMakerPair[from] || isAutomatedMarketMakerPair[to]) &&
            !isFeeExempt[from] &&
            !isFeeExempt[to] &&
            !_inSwapAndLiquify;

        if (takeFee && autoLpFeeBps > 0) {
            uint256 feeAmount = (amount * autoLpFeeBps) / 10000;
            super._update(from, address(this), feeAmount);
            amount -= feeAmount;
        }

        super._update(from, to, amount);
    }

    function _swapAndLiquify(uint256 epkAmount) private lockTheSwap {
        uint256 half = epkAmount / 2;
        uint256 otherHalf = epkAmount - half;

        uint256 initialQuote = IERC20(quoteStablecoin).balanceOf(address(this));
        _swapEpkForQuote(half);
        uint256 newQuote = IERC20(quoteStablecoin).balanceOf(address(this)) - initialQuote;

        _approve(address(this), address(dexRouter), otherHalf);
        IERC20(quoteStablecoin).approve(address(dexRouter), newQuote);

        dexRouter.addLiquidity(
            address(this),
            quoteStablecoin,
            otherHalf,
            newQuote,
            0,
            0,
            lpVault,
            block.timestamp + 300
        );

        emit AutoLiquidityInjected(half, newQuote, otherHalf);
    }

    function _swapEpkForQuote(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = quoteStablecoin;

        _approve(address(this), address(dexRouter), tokenAmount);
        dexRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),
            block.timestamp + 300
        );
    }

    function setAutoLiquifyConfig(uint256 _feeBps, uint256 _threshold, bool _enabled)
        external
        onlyRole(TREASURY_ROLE)
    {
        require(_feeBps <= MAX_AUTO_LP_BPS, "Exceeds 1% cap");
        autoLpFeeBps = _feeBps;
        liquifyThreshold = _threshold;
        autoLiquifyEnabled = _enabled;
        emit AutoLiquifyConfigUpdated(_feeBps, _threshold, _enabled);
    }
}
`;
}

export function generatePsmSolidity(
  chain: ChainConfig,
  config: AutoLiquidityConfig
): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IEaglecoinPK {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

/**
 * @title EaglePegStabilityModule
 * @notice 1:1 Collateralized Mint & Redeem Module enforcing the $1.00 USD peg for EPK
 * @dev Target Network: ${chain.name}
 */
contract EaglePegStabilityModule is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IEaglecoinPK public immutable epk;
    IERC20 public immutable reserveStablecoin;

    uint256 public psmFeeBps = ${config.psmFeeBps}; // ${(config.psmFeeBps / 100).toFixed(2)}%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint8 public immutable reserveDecimals;

    event PegMinted(address indexed user, uint256 stableIn, uint256 epkOut, uint256 fee);
    event PegRedeemed(address indexed user, uint256 epkIn, uint256 stableOut, uint256 fee);

    constructor(
        address _epk,
        address _reserveStablecoin,
        uint8 _reserveDecimals,
        address _treasury
    ) Ownable(_treasury) {
        epk = IEaglecoinPK(_epk);
        reserveStablecoin = IERC20(_reserveStablecoin);
        reserveDecimals = _reserveDecimals;
    }

    function mintEPK(uint256 stableAmount) external nonReentrant returns (uint256 epkOut) {
        require(stableAmount > 0, "Amount must be > 0");
        reserveStablecoin.safeTransferFrom(msg.sender, address(this), stableAmount);

        uint256 scaledEpk = stableAmount * (10 ** (18 - reserveDecimals));
        uint256 fee = (scaledEpk * psmFeeBps) / BPS_DENOMINATOR;
        epkOut = scaledEpk - fee;

        epk.mint(msg.sender, epkOut);
        if (fee > 0) {
            epk.mint(owner(), fee);
        }

        emit PegMinted(msg.sender, stableAmount, epkOut, fee);
    }

    function redeemStable(uint256 epkAmount) external nonReentrant returns (uint256 stableOut) {
        require(epkAmount > 0, "Amount must be > 0");
        uint256 fee = (epkAmount * psmFeeBps) / BPS_DENOMINATOR;
        uint256 netEpk = epkAmount - fee;

        epk.burnFrom(msg.sender, epkAmount);

        stableOut = netEpk / (10 ** (18 - reserveDecimals));
        require(reserveStablecoin.balanceOf(address(this)) >= stableOut, "Insufficient PSM liquidity");

        reserveStablecoin.safeTransfer(msg.sender, stableOut);
        emit PegRedeemed(msg.sender, epkAmount, stableOut, fee);
    }
}
`;
}

export function generateDeployScript(chain: ChainConfig): string {
  return `import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Eaglecoinpk (EPK) on ${chain.name} with:", deployer.address);

  const TREASURY_MULTISIG = process.env.TREASURY_MULTISIG || deployer.address;
  const LP_LOCK_VAULT = process.env.LP_LOCK_VAULT || deployer.address;
  const QUOTE_STABLE = "${chain.usdcAddress}";

  // 1. Deploy EaglecoinPK Token + Auto-Liquidity Engine
  const EPKFactory = await ethers.getContractFactory("EaglecoinPK");
  const epk = await EPKFactory.deploy(TREASURY_MULTISIG, LP_LOCK_VAULT);
  await epk.waitForDeployment();
  const epkAddress = await epk.getAddress();
  console.log("EaglecoinPK deployed to:", epkAddress);

  // 2. Deploy 1:1 Peg Stability Module (PSM)
  const PSMFactory = await ethers.getContractFactory("EaglePegStabilityModule");
  const psm = await PSMFactory.deploy(epkAddress, QUOTE_STABLE, 18, TREASURY_MULTISIG);
  await psm.waitForDeployment();
  const psmAddress = await psm.getAddress();
  console.log("EaglePegStabilityModule deployed to:", psmAddress);

  // 3. Grant MINTER_ROLE to PSM and exempt PSM from swap fees
  const MINTER_ROLE = await epk.MINTER_ROLE();
  await (await epk.grantRole(MINTER_ROLE, psmAddress)).wait();
  console.log("PSM granted MINTER_ROLE for 1:1 USD peg arbitrage");

  // 4. Seed Initial DEX Liquidity (${chain.dexName})
  const initialLiquidityEpk = ethers.parseUnits("500000", 18);
  await (await epk.mint(deployer.address, initialLiquidityEpk)).wait();
  console.log("Initial 500,000 EPK ready to pair with 500,000 quote stablecoin on ${chain.dexName}");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;
}

export function generateTokenListJson(chain: ChainConfig): string {
  return JSON.stringify(
    {
      name: 'Eaglecoinpk Official Token List',
      timestamp: '2026-11-14T10:30:00Z',
      version: { major: 1, minor: 2, patch: 0 },
      tags: {
        stablecoin: {
          name: 'USD Pegged Stablecoin',
          description: '1:1 USD reserve-backed stablecoin with automated DEX liquidity',
        },
      },
      tokens: [
        {
          chainId: chain.chainIdNum,
          address: '0xE4G1e00000000000000000000000000000000EPK',
          name: 'Eaglecoinpk',
          symbol: 'EPK',
          decimals: 18,
          logoURI: 'https://assets.eaglecoinpk.org/epk-crest-256.png',
          tags: ['stablecoin'],
          extensions: {
            pegCurrency: 'USD',
            autoLiquidityBps: 25,
            proofOfReserves: 'https://reserves.eaglecoinpk.org/attestation.json',
          },
        },
      ],
    },
    null,
    2
  );
}
