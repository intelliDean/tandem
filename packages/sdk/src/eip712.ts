import { Address, WalletClient, Account, hashTypedData } from 'viem';
import { SpreadOrder, CloseOrder } from './types.js';

export function getTandemDomain(verifyingContract: Address, chainId: number = 143) {
  return {
    name: 'TandemSpreadOrders',
    version: '1',
    chainId: BigInt(chainId || 143),
    verifyingContract,
  } as const;
}

export const SPREAD_ORDER_TYPES = {
  SpreadOrder: [
    { name: 'owner', type: 'address' },
    { name: 'account', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'kuruMarket', type: 'address' },
    { name: 'quoteToken', type: 'address' },
    { name: 'perpId', type: 'uint256' },
    { name: 'quantity', type: 'uint96' },
    { name: 'perpLots', type: 'uint256' },
    { name: 'maxSpotSpend', type: 'uint256' },
    { name: 'minPerpPrice', type: 'uint256' },
    { name: 'collateral', type: 'uint256' },
    { name: 'minSpread', type: 'int256' },
    { name: 'maxFee', type: 'uint256' },
  ],
} as const;

export const CLOSE_ORDER_TYPES = {
  CloseOrder: [
    { name: 'owner', type: 'address' },
    { name: 'account', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'kuruMarket', type: 'address' },
    { name: 'quoteToken', type: 'address' },
    { name: 'perpId', type: 'uint256' },
    { name: 'quantity', type: 'uint96' },
    { name: 'perpLots', type: 'uint256' },
    { name: 'minSpotProceeds', type: 'uint256' },
    { name: 'maxPerpClosePrice', type: 'uint256' },
    { name: 'minExitSpread', type: 'int256' },
  ],
} as const;

export async function signSpreadOrder(
  client: WalletClient,
  account: Account | Address | undefined,
  order: SpreadOrder,
  verifyingContract: Address,
  chainId: number = 143
): Promise<`0x${string}`> {
  const domain = getTandemDomain(verifyingContract, chainId);
  const signingAccount = account || client.account;
  if (!signingAccount) throw new Error('Signing account is required');

  return client.signTypedData({
    account: signingAccount,
    domain,
    types: SPREAD_ORDER_TYPES,
    primaryType: 'SpreadOrder',
    message: {
      owner: order.owner,
      account: order.account,
      nonce: order.nonce,
      expiry: order.expiry,
      kuruMarket: order.kuruMarket,
      quoteToken: order.quoteToken,
      perpId: order.perpId,
      quantity: order.quantity,
      perpLots: order.perpLots,
      maxSpotSpend: order.maxSpotSpend,
      minPerpPrice: order.minPerpPrice,
      collateral: order.collateral,
      minSpread: order.minSpread,
      maxFee: order.maxFee,
    },
  });
}

export async function signCloseOrder(
  client: WalletClient,
  account: Account | Address | undefined,
  order: CloseOrder,
  verifyingContract: Address,
  chainId: number = 143
): Promise<`0x${string}`> {
  const domain = getTandemDomain(verifyingContract, chainId);
  const signingAccount = account || client.account;
  if (!signingAccount) throw new Error('Signing account is required');

  return client.signTypedData({
    account: signingAccount,
    domain,
    types: CLOSE_ORDER_TYPES,
    primaryType: 'CloseOrder',
    message: {
      owner: order.owner,
      account: order.account,
      nonce: order.nonce,
      expiry: order.expiry,
      kuruMarket: order.kuruMarket,
      quoteToken: order.quoteToken,
      perpId: order.perpId,
      quantity: order.quantity,
      perpLots: order.perpLots,
      minSpotProceeds: order.minSpotProceeds,
      maxPerpClosePrice: order.maxPerpClosePrice,
      minExitSpread: order.minExitSpread,
    },
  });
}

export function hashSpreadOrder(
  order: SpreadOrder,
  verifyingContract: Address,
  chainId: number = 143
): `0x${string}` {
  const domain = getTandemDomain(verifyingContract, chainId);
  return hashTypedData({
    domain,
    types: SPREAD_ORDER_TYPES,
    primaryType: 'SpreadOrder',
    message: {
      owner: order.owner,
      account: order.account,
      nonce: order.nonce,
      expiry: order.expiry,
      kuruMarket: order.kuruMarket,
      quoteToken: order.quoteToken,
      perpId: order.perpId,
      quantity: order.quantity,
      perpLots: order.perpLots,
      maxSpotSpend: order.maxSpotSpend,
      minPerpPrice: order.minPerpPrice,
      collateral: order.collateral,
      minSpread: order.minSpread,
      maxFee: order.maxFee,
    },
  });
}

export function hashCloseOrder(
  order: CloseOrder,
  verifyingContract: Address,
  chainId: number = 143
): `0x${string}` {
  const domain = getTandemDomain(verifyingContract, chainId);
  return hashTypedData({
    domain,
    types: CLOSE_ORDER_TYPES,
    primaryType: 'CloseOrder',
    message: {
      owner: order.owner,
      account: order.account,
      nonce: order.nonce,
      expiry: order.expiry,
      kuruMarket: order.kuruMarket,
      quoteToken: order.quoteToken,
      perpId: order.perpId,
      quantity: order.quantity,
      perpLots: order.perpLots,
      minSpotProceeds: order.minSpotProceeds,
      maxPerpClosePrice: order.maxPerpClosePrice,
      minExitSpread: order.minExitSpread,
    },
  });
}

