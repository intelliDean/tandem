import { Address, defineChain } from 'viem';

export const MONAD_CHAIN_ID = 143;
export const MONAD_TESTNET_CHAIN_ID = 10143;

export const monadChain = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
});

export const monadTestnetChain = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
});

export const CONTRACT_ADDRESSES = {
  TANDEM_SPREAD_ROUTER: '0xC7885f87e2027F90D8cd4372CE5071b3aFE19E91' as Address,
  KURU_MON_USDC: '0x065C9d28E428A0db40191a54d33d5b7c71a9C394' as Address,
  KURU_MON_AUSD: '0x131A2e70A5b31a517A74b8c567149bc294470Da9' as Address,
  PERPL_EXCHANGE: '0x34B6552d57a35a1D042CcAe1951BD1C370112a6F' as Address,
  USDC: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' as Address,
  AUSD: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a' as Address,
} as const;

export const KURU_PRECISION = {
  PRICE_PRECISION: 100_000_000n, // 1e8
  SIZE_PRECISION: 10_000_000_000n, // 1e10
  BASE_DECIMALS: 18,
  QUOTE_DECIMALS: 6,
} as const;

export const PERPL_PRECISION = {
  PRICE_SCALE: 10_000n, // 1e4
  COLLATERAL_DECIMALS: 6,
} as const;
