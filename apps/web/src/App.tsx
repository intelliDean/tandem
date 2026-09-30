import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { Header } from './components/Header.js';
import { MarketTicker } from './components/MarketTicker.js';
import { OrderTerminal } from './components/OrderTerminal.js';
import { PairedPositionCard } from './components/PairedPositionCard.js';
import { MonitoredOrdersQueue } from './components/MonitoredOrdersQueue.js';
import { RollbackProver } from './components/RollbackProver.js';
import { OrderItem, MarketState, PositionState } from './types.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'NOW' | 'LIMIT'>('NOW');
  const [walletConnected, setWalletConnected] = useState(true);
  const [account] = useState('0x10E951fA67B511D044803c7757DA445Ddf646f6d');

  // Order Inputs
  const [monQuantity, setMonQuantity] = useState('1.0');
  const [maxSpotSpend, setMaxSpotSpend] = useState('10.0');
  const [perpLots, setPerpLots] = useState('100');
  const [collateral, setCollateral] = useState('500');
  const [minSpread, setMinSpread] = useState('+0.550000');
  const [expiryHours, setExpiryHours] = useState('1');

  // Live Market State
  const [market] = useState<MarketState>({
    spotAsk: 0.2735,
    perpBid: 0.8391,
    netSpread: (0.8391 - 0.2735).toFixed(6),
  });

  // Paired Position State
  const [position, setPosition] = useState<PositionState>({
    hasPosition: true,
    spotMonHeld: '3.649',
    positionLots: '100',
    lockedMargin: '416.06 AUSD',
    entryPerpPrice: '$0.8391',
    entrySpotPrice: '$0.2740',
    unrealizedPnl: '+$0.033',
  });

  // Pending Orders Queue
  const [orders, setOrders] = useState<OrderItem[]>([
    {
      id: '1',
      orderHash: '0x0382cfee8c2638b263d5230fb05c106129e270e7f3e507d26d3408f87dfa9274',
      quantity: '1.0 MON',
      minSpread: '+0.500000 AUSD',
      status: 'EXECUTED',
      simulatedSpread: '+0.565600 AUSD',
      timestamp: '2 mins ago',
      txHash: '0x8892bf4...109312895',
    },
  ]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const handleCreateOrder = () => {
    setIsExecuting(true);
    setExecutionMessage('Verifying EIP-712 typed signature & simulating atomic paired legs...');

    setTimeout(() => {
      if (activeTab === 'NOW') {
        setExecutionMessage('Atomic transaction confirmed! Bought 3.649 MON on Kuru, opened 100-lot short on Perpl in block 109312895.');
        setPosition((prev) => ({
          ...prev,
          hasPosition: true,
          spotMonHeld: '3.649',
          positionLots: '100',
        }));
      } else {
        const newOrder: OrderItem = {
          id: String(Date.now()),
          orderHash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
          quantity: `${monQuantity} MON`,
          minSpread: `${minSpread} AUSD`,
          status: 'PENDING',
          simulatedSpread: `+${market.netSpread} AUSD`,
          timestamp: 'Just now',
        };
        setOrders((prev) => [newOrder, ...prev]);
        setExecutionMessage('Order signed! Background executor is actively simulating at block intervals.');
      }
      setIsExecuting(false);
    }, 1800);
  };

  const handleClosePosition = () => {
    setIsExecuting(true);
    setExecutionMessage('Executing paired atomic exit: Selling 1.0 MON on Kuru + Closing 100-lot short on Perpl...');

    setTimeout(() => {
      setPosition((prev) => ({
        ...prev,
        hasPosition: false,
        spotMonHeld: '0.000',
        positionLots: '0',
      }));
      setExecutionMessage('Paired position successfully closed atomically! Proceeds received: 27,348 USDC units.');
      setIsExecuting(false);
    }, 1600);
  };

  const handleCancelOrder = (id: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'CANCELLED' } : o)));
    setExecutionMessage(`Nonce on-chain cancellation broadcasted for order ${id}.`);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px' }}>
      <Header
        walletConnected={walletConnected}
        account={account}
        onToggleWallet={() => setWalletConnected(!walletConnected)}
      />

      <MarketTicker market={market} />

      {executionMessage && (
        <div className="glass-panel" style={{
          padding: '14px 20px',
          marginBottom: '20px',
          background: 'rgba(0, 240, 255, 0.08)',
          borderColor: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: '14px', color: '#fff' }}>{executionMessage}</span>
          </div>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setExecutionMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: '24px' }}>
        <OrderTerminal
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          monQuantity={monQuantity}
          setMonQuantity={setMonQuantity}
          maxSpotSpend={maxSpotSpend}
          setMaxSpotSpend={setMaxSpotSpend}
          perpLots={perpLots}
          setPerpLots={setPerpLots}
          collateral={collateral}
          setCollateral={setCollateral}
          minSpread={minSpread}
          setMinSpread={setMinSpread}
          expiryHours={expiryHours}
          setExpiryHours={setExpiryHours}
          currentNetSpread={market.netSpread}
          isExecuting={isExecuting}
          onSubmit={handleCreateOrder}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PairedPositionCard
            position={position}
            isExecuting={isExecuting}
            onClosePosition={handleClosePosition}
          />

          <MonitoredOrdersQueue
            orders={orders}
            onCancelOrder={handleCancelOrder}
          />

          <RollbackProver />
        </div>
      </div>
    </div>
  );
}
