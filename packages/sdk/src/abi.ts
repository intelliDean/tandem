export const TANDEM_SPREAD_ROUTER_ABI = [
  {
    type: 'function',
    name: 'executeSpreadOrder',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        components: [
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
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        components: [
          { name: 'orderHash', type: 'bytes32' },
          { name: 'spotMonReceived', type: 'uint256' },
          { name: 'spotQuoteSpent', type: 'uint256' },
          { name: 'perpOrderId', type: 'uint256' },
          { name: 'actualSpread', type: 'int256' },
          { name: 'actualFee', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'closeSpreadOrder',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        components: [
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
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [
      { name: 'quoteReceived', type: 'uint256' },
      { name: 'perpCloseOrderId', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'cancelNonce',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'nonce', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isNonceCancelled',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'nonce', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isOrderExecuted',
    stateMutability: 'view',
    inputs: [{ name: 'orderHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const KURU_ORDERBOOK_ABI = [
  {
    type: 'function',
    name: 'bestBidAsk',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'bestBid', type: 'uint256' },
      { name: 'bestAsk', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getMarketParams',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'pricePrecision', type: 'uint32' },
          { name: 'sizePrecision', type: 'uint96' },
          { name: 'baseAsset', type: 'address' },
          { name: 'baseDecimals', type: 'uint8' },
          { name: 'quoteAsset', type: 'address' },
          { name: 'quoteDecimals', type: 'uint8' },
          { name: 'tickSize', type: 'uint32' },
          { name: 'minSize', type: 'uint96' },
          { name: 'maxSize', type: 'uint96' },
        ],
      },
    ],
  },
] as const;

export const PERPL_EXCHANGE_ABI = [
  {
    type: 'function',
    name: 'getAccountByAddr',
    stateMutability: 'view',
    inputs: [{ name: 'accountAddr', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'accountId', type: 'uint256' },
          { name: 'balanceCNS', type: 'uint256' },
          { name: 'lockedBalanceCNS', type: 'uint256' },
          { name: 'frozen', type: 'uint8' },
          { name: 'accountAddr', type: 'address' },
          {
            name: 'positions',
            type: 'tuple',
            components: [
              { name: 'bank1', type: 'uint256' },
              { name: 'bank2', type: 'uint256' },
              { name: 'bank3', type: 'uint256' },
              { name: 'bank4', type: 'uint256' },
            ],
          },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getPosition',
    stateMutability: 'view',
    inputs: [
      { name: 'perpId', type: 'uint256' },
      { name: 'accountId', type: 'uint256' },
    ],
    outputs: [
      {
        name: 'position',
        type: 'tuple',
        components: [
          { name: 'accountId', type: 'uint256' },
          { name: 'nextNodeId', type: 'uint256' },
          { name: 'prevNodeId', type: 'uint256' },
          { name: 'positionType', type: 'uint8' },
          { name: 'depositCNS', type: 'uint256' },
          { name: 'pricePNS', type: 'uint256' },
          { name: 'lotLNS', type: 'uint256' },
          { name: 'entryBlock', type: 'uint256' },
          { name: 'pnlCNS', type: 'int256' },
          { name: 'deltaPnlCNS', type: 'int256' },
          { name: 'premiumPnlCNS', type: 'int256' },
        ],
      },
      { name: 'markPricePNS', type: 'uint256' },
      { name: 'isOpen', type: 'bool' },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
