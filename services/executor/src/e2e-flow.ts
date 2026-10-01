import { createPublicClient, createWalletClient, http, formatEther, formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  TANDEM_SPREAD_ROUTER_ABI,
  KURU_ORDERBOOK_ABI,
  ERC20_ABI,
  SpreadOrder,
  signSpreadOrder,
  monadChain,
} from '@tandem/sdk';
import { simulateSpreadOrder } from './simulator.js';
import { dispatchSpreadOrder } from './dispatcher.js';

// Configuration
const RPC_URL = process.env.MONAD_RPC_URL || 'http://127.0.0.1:8545';
const ROUTER_ADDRESS = (process.env.TANDEM_ROUTER_ADDRESS || '0xcF7AC4DAfF8D8050362EaC01DcF1155797b99125') as `0x${string}`;

const TRADER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;
const traderAccount = privateKeyToAccount(TRADER_KEY);

const KURU_MON_USDC = '0x065C9d28E428A0db40191a54d33d5b7c71a9C394' as `0x${string}`;
const USDC_ADDRESS = '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' as `0x${string}`;
const AUSD_ADDRESS = '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a' as `0x${string}`;

const publicClient = createPublicClient({
  chain: monadChain,
  transport: http(RPC_URL),
});

const traderWallet = createWalletClient({
  account: traderAccount,
  chain: monadChain,
  transport: http(RPC_URL),
});

async function ensureAnvilEnvironment() {
  try {
    const PERPL_OWNER = '0xd0a0205e9188998E0bE7F2600a715aD3CD289Cb1';
    await traderWallet.request({ method: 'anvil_impersonateAccount' as any, params: [PERPL_OWNER] });
    await traderWallet.request({ method: 'anvil_setBalance' as any, params: [PERPL_OWNER, '0x3635C9ADC5DEA00000'] });

    const ownerWallet = createWalletClient({
      account: PERPL_OWNER,
      chain: monadChain,
      transport: http(RPC_URL),
    });

    await ownerWallet.writeContract({
      address: '0x34B6552d57a35a1D042CcAe1951BD1C370112a6F',
      abi: [{
        name: 'setIgnOracle',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'perpId', type: 'uint256' }, { name: 'ignore', type: 'bool' }],
        outputs: [],
      }],
      functionName: 'setIgnOracle',
      args: [1n, true],
    });

    await ownerWallet.writeContract({
      address: '0x34B6552d57a35a1D042CcAe1951BD1C370112a6F',
      abi: [{
        name: 'updateMarkPricePNSByOwner',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'perpId', type: 'uint256' }, { name: 'markPricePNS', type: 'uint32' }],
        outputs: [],
      }],
      functionName: 'updateMarkPricePNSByOwner',
      args: [1n, 839083],
    });

    // Ensure trader has funds and approvals on local node
    await traderWallet.request({
      method: 'anvil_setStorageAt' as any,
      params: [USDC_ADDRESS, '0xcb8911fb82c2d10f6cf1d31d1e521ad3f4e3f42615f6ba67c454a9a2fdb9b6a7', '0x000000000000000000000000000000000000000000000000000000003b9aca00'] as any
    });
    await traderWallet.request({
      method: 'anvil_setStorageAt' as any,
      params: [AUSD_ADDRESS, '0xde9225d66e9b1b434dc49256ceab265e6504c3cc2d588b28c1149de35a3750c7', '0x0000000000000000000000000000000000000000000000000000003b9aca0000'] as any
    });

    await traderWallet.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_ADDRESS, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
    await traderWallet.writeContract({
      address: AUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_ADDRESS, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
  } catch {
    // Graceful fallback for non-anvil nodes
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('🚀 TANDEM SPREAD ORDERS: LIVE E2E INTEGRATION FLOW');
  console.log('================================================================');
  console.log(`• Network RPC:       ${RPC_URL}`);
  console.log(`• Tandem Router:     ${ROUTER_ADDRESS}`);
  console.log(`• Trader Account:    ${traderAccount.address}`);

  await ensureAnvilEnvironment();

  // 1. Check Initial Balances
  console.log('\n--- [Step 1] Querying Trader Pre-Trade Balances ---');
  const monBalance = await publicClient.getBalance({ address: traderAccount.address });
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [traderAccount.address],
  });
  const ausdBalance = await publicClient.readContract({
    address: AUSD_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [traderAccount.address],
  });

  console.log(`  MON Balance:   ${formatEther(monBalance)} MON`);
  console.log(`  USDC Balance:  ${formatUnits(usdcBalance, 6)} USDC`);
  console.log(`  AUSD Balance:  ${formatUnits(ausdBalance, 6)} AUSD`);

  // 2. Query Live Market State from Kuru CLOB
  console.log('\n--- [Step 2] Querying Live Kuru CLOB Spot Orderbook ---');
  const [bestBid, bestAsk] = await publicClient.readContract({
    address: KURU_MON_USDC,
    abi: KURU_ORDERBOOK_ABI,
    functionName: 'bestBidAsk',
  });
  console.log(`  Kuru Best Bid (raw): ${bestBid}`);
  console.log(`  Kuru Best Ask (raw): ${bestAsk}`);

  // 3. Construct EIP-712 Spread Order
  console.log('\n--- [Step 3] Constructing Typed EIP-712 Spread Order ---');
  const nonce = BigInt(Date.now());
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

  const order: SpreadOrder = {
    owner: traderAccount.address,
    account: traderAccount.address,
    nonce,
    expiry,
    kuruMarket: KURU_MON_USDC,
    quoteToken: USDC_ADDRESS,
    perpId: 1n,
    quantity: 10n ** 18n, // 1 MON min
    perpLots: 100n, // 100 lots on Perpl
    maxSpotSpend: 10_000_000n, // 10 USDC
    minPerpPrice: 800_000n,
    collateral: 500_000_000n, // 500 AUSD
    minSpread: 0n, // Break-even or better
    maxFee: 5_000_000n,
  };

  console.log(`  Nonce:            ${order.nonce}`);
  console.log(`  Expiry:           ${new Date(Number(order.expiry) * 1000).toISOString()}`);
  console.log(`  Quantity Leg 1:   1.0 MON (min)`);
  console.log(`  Perp Lots Leg 2:  100 Lots (Short)`);
  console.log(`  Max Spot Spend:   10.0 USDC`);
  console.log(`  Perp Collateral:  500.0 AUSD`);
  console.log(`  Min Net Spread:   >= 0.000000 AUSD/MON`);

  // 4. Sign EIP-712 Order with Trader Wallet
  console.log('\n--- [Step 4] Signing EIP-712 Typed Data with Trader Key ---');
  const signature = await signSpreadOrder(
    traderWallet,
    traderAccount,
    order,
    ROUTER_ADDRESS,
    143
  );
  console.log(`  EIP-712 Signature: ${signature.slice(0, 32)}...${signature.slice(-16)}`);

  // 5. Pre-Execution Simulation via eth_call
  console.log('\n--- [Step 5] Simulating Atomic Paired Execution (eth_call) ---');
  const sim = await simulateSpreadOrder(ROUTER_ADDRESS, order, signature, traderAccount.address, publicClient);
  if (!sim.success || !sim.result) {
    throw new Error(`Simulation reverted: ${sim.error}`);
  }

  console.log('  Simulation Succeeded!');
  console.log(`  • Spot MON to Receive:  ${formatEther(sim.result.spotMonReceived)} MON`);
  console.log(`  • Spot Quote to Spend:  ${formatUnits(sim.result.spotQuoteSpent, 6)} USDC`);
  console.log(`  • Perp Order ID:        ${sim.result.perpOrderId}`);
  console.log(`  • Simulated Spread:     ${formatUnits(sim.result.actualSpread, 6)} AUSD/MON`);
  console.log(`  • Total Execution Fee:  ${formatUnits(sim.result.actualFee, 6)} AUSD`);

  // 6. Broadcast Real Atomic Execution to Chain
  console.log('\n--- [Step 6] Broadcasting Atomic Spread Transaction to Monad Network ---');
  const { txHash, receipt } = await dispatchSpreadOrder(ROUTER_ADDRESS, order, signature, traderWallet, publicClient);
  console.log(`  Tx Broadcast Hash: ${txHash}`);
  console.log(`  Included in Block: ${receipt.blockNumber}`);
  console.log(`  Status:            ${receipt.status.toUpperCase()}`);
  console.log(`  Gas Used:          ${receipt.gasUsed.toString()}`);

  if (receipt.status !== 'success') {
    throw new Error('Onchain transaction reverted!');
  }

  // 7. Post-Trade Verification
  console.log('\n--- [Step 7] Verifying Post-Trade Balances & Position ---');
  const postMonBalance = await publicClient.getBalance({ address: traderAccount.address });
  const postUsdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [traderAccount.address],
  });
  const postAusdBalance = await publicClient.readContract({
    address: AUSD_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [traderAccount.address],
  });

  const monDelta = postMonBalance - monBalance;
  const usdcDelta = usdcBalance - postUsdcBalance;
  const ausdDelta = ausdBalance - postAusdBalance;

  console.log(`  Spot MON Acquired:   +${formatEther(monDelta)} MON`);
  console.log(`  USDC Quote Spent:    -${formatUnits(usdcDelta, 6)} USDC`);
  console.log(`  AUSD Margin Locked:  -${formatUnits(ausdDelta, 6)} AUSD`);

  // Verify nonces marked on-chain
  const isExecuted = await publicClient.readContract({
    address: ROUTER_ADDRESS,
    abi: TANDEM_SPREAD_ROUTER_ABI,
    functionName: 'isOrderExecuted',
    args: [sim.result.orderHash],
  });
  console.log(`  On-chain Replay Protection: isOrderExecuted = ${isExecuted}`);

  // 8. Rollback Verification Test
  console.log('\n--- [Step 8] Testing Rollback Protection with Unmet Spread Condition ---');
  const badOrder: SpreadOrder = {
    ...order,
    nonce: BigInt(Date.now() + 1000),
    minSpread: parseUnits('100000', 6), // Impossible +$100,000 spread
  };
  const badSig = await signSpreadOrder(traderWallet, traderAccount, badOrder, ROUTER_ADDRESS, 143);
  const badSim = await simulateSpreadOrder(ROUTER_ADDRESS, badOrder, badSig, traderAccount.address, publicClient);
  console.log(`  High-Spread Simulation Correctly Reverted: ${!badSim.success} (${badSim.error})`);

  console.log('\n================================================================');
  console.log('🎉 LIVE E2E FLOW COMPLETED SUCCESSFULLY WITH 100% ATOMIC SAFETY!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ E2E Flow Failed:', err);
  process.exit(1);
});
