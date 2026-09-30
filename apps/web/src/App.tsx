import { useState } from 'react';
import {
  ShieldCheck,
  Layers,
  Zap,
  Clock,
  RefreshCw
} from 'lucide-react';

interface OrderItem {
  id: string;
  orderHash: string;
  quantity: string;
  minSpread: string;
  status: 'PENDING' | 'SIMULATING' | 'EXECUTED' | 'CANCELLED';
  simulatedSpread?: string;
  timestamp: string;
  txHash?: string;
}

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
  const [spotAsk, setSpotAsk] = useState(0.2735);
  const [perpBid, setPerpBid] = useState(0.8391);
  const currentNetSpread = (perpBid - spotAsk).toFixed(6);

  // Paired Position State
  const [hasPosition, setHasPosition] = useState(true);
  const [positionLots, setPositionLots] = useState('100');
  const [spotMonHeld, setSpotMonHeld] = useState('3.649');
  const [entryPerpPrice] = useState('$0.8391');
  const [entrySpotPrice] = useState('$0.2740');
  const [unrealizedPnl, setUnrealizedPnl] = useState('+$0.033');

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
      txHash: '0x8892bf4...109312895'
    }
  ]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const handleCreateOrder = async () => {
    setIsExecuting(true);
    setExecutionMessage('Verifying EIP-712 typed signature & simulating atomic paired legs...');

    setTimeout(() => {
      if (activeTab === 'NOW') {
        setExecutionMessage('Atomic transaction confirmed! Bought 3.649 MON on Kuru, opened 100-lot short on Perpl in block 109312895.');
        setHasPosition(true);
        setSpotMonHeld('3.649');
        setPositionLots('100');
      } else {
        const newOrder: OrderItem = {
          id: String(Date.now()),
          orderHash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
          quantity: `${monQuantity} MON`,
          minSpread: `${minSpread} AUSD`,
          status: 'PENDING',
          simulatedSpread: `+${currentNetSpread} AUSD`,
          timestamp: 'Just now'
        };
        setOrders([newOrder, ...orders]);
        setExecutionMessage(`Order signed! Background executor is actively simulating at block intervals.`);
      }
      setIsExecuting(false);
    }, 1800);
  };

  const handleClosePosition = () => {
    setIsExecuting(true);
    setExecutionMessage('Executing paired atomic exit: Selling 1.0 MON on Kuru + Closing 100-lot short on Perpl...');

    setTimeout(() => {
      setHasPosition(false);
      setSpotMonHeld('0.000');
      setPositionLots('0');
      setExecutionMessage('Paired position successfully closed atomically! Proceeds received: 27,348 USDC units.');
      setIsExecuting(false);
    }, 1600);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #00f0ff, #9d4edd)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)'
          }}>
            <Layers color="#000" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px' }}>TANDEM</h1>
              <span className="badge badge-atomic">Monad Hackathon</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Atomic Paired Spread Orders on Monad • Kuru CLOB + Perpl DEX
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }}></span>
            <span style={{ color: 'var(--text-muted)' }}>Network:</span>
            <span className="mono" style={{ fontWeight: 600 }}>Monad Mainnet (Pinned #109312895)</span>
          </div>

          <button
            className="btn-secondary mono"
            onClick={() => setWalletConnected(!walletConnected)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ShieldCheck size={16} color="var(--accent-cyan)" />
            {walletConnected ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {/* Market Overview Ticker */}
      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="badge badge-kuru">Spot Buy (Kuru)</span>
          </div>
          <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            ${spotAsk.toFixed(4)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>USDC</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Deepest Ask • Fill-Or-Kill</div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="badge badge-perpl">Perp Short (Perpl)</span>
          </div>
          <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#c77dff' }}>
            ${perpBid.toFixed(4)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AUSD</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mark Bid • Isolated Margin</div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="badge badge-success">Live Net Spread</span>
          </div>
          <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-green)' }}>
            +{currentNetSpread} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AUSD/MON</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Spread = Perp - Spot - Fees</div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="badge badge-atomic">Execution Guarantee</span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>
            100% Atomic Rollback
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Both legs fill or neither commits</div>
        </div>
      </div>

      {/* Execution feedback banner */}
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

      {/* Main Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: '24px' }}>
        {/* Left Column: Order Creation Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Tandem Order Terminal</h2>
            <div className="tab-group" style={{ width: '220px' }}>
              <button
                className={`tab-btn ${activeTab === 'NOW' ? 'active' : ''}`}
                onClick={() => setActiveTab('NOW')}
              >
                Execute Now
              </button>
              <button
                className={`tab-btn ${activeTab === 'LIMIT' ? 'active' : ''}`}
                onClick={() => setActiveTab('LIMIT')}
              >
                Limit Spread
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Quantity */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Paired Trade Quantity</span>
                <span className="mono" style={{ color: 'var(--accent-cyan)' }}>Max Available: 50.0 MON</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-box"
                  value={monQuantity}
                  onChange={(e) => setMonQuantity(e.target.value)}
                  placeholder="1.0"
                />
                <span className="mono" style={{ position: 'absolute', right: '14px', top: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  MON
                </span>
              </div>
            </div>

            {/* Max Spot Spend */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Spot Spend Cap (Kuru Leg)</span>
                <span className="mono" style={{ color: 'var(--text-muted)' }}>Balance: 1,000 USDC</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-box"
                  value={maxSpotSpend}
                  onChange={(e) => setMaxSpotSpend(e.target.value)}
                  placeholder="10.0"
                />
                <span className="mono" style={{ position: 'absolute', right: '14px', top: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  USDC
                </span>
              </div>
            </div>

            {/* Perpl Collateral & Lots */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Perpl Lots
                </label>
                <input
                  type="text"
                  className="input-box"
                  value={perpLots}
                  onChange={(e) => setPerpLots(e.target.value)}
                  placeholder="100"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  AUSD Collateral
                </label>
                <input
                  type="text"
                  className="input-box"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  placeholder="500"
                />
              </div>
            </div>

            {/* Target Min Spread */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Minimum Acceptable Spread</span>
                <span className="mono" style={{ color: 'var(--accent-green)' }}>Current: +{currentNetSpread}</span>
              </div>
              <input
                type="text"
                className="input-box"
                value={minSpread}
                onChange={(e) => setMinSpread(e.target.value)}
                placeholder="+0.550000"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Transaction will strictly revert if net execution spread falls below this threshold.
              </span>
            </div>

            {/* Expiry Selector (For Limit Spread Mode) */}
            {activeTab === 'LIMIT' && (
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Order Expiry Window
                </label>
                <div className="tab-group">
                  {['1', '6', '24', '72'].map((hr) => (
                    <button
                      key={hr}
                      className={`tab-btn ${expiryHours === hr ? 'active' : ''}`}
                      onClick={() => setExpiryHours(hr)}
                    >
                      {hr}h
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Spread Condition Breakdown Box */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Estimated Spot Purchase:</span>
                <span className="mono">~3.649 MON</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Perp Short Position:</span>
                <span className="mono">100 Lots ($83.91)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Estimated Net Yield:</span>
                <span className="mono" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>+0.5656 AUSD/MON</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Service Execution Fee:</span>
                <span className="mono" style={{ color: 'var(--text-muted)' }}>0.00 USDC (Waived for Hackathon)</span>
              </div>
            </div>

            {/* Action CTA Button */}
            <button
              className="btn-primary"
              onClick={handleCreateOrder}
              disabled={isExecuting}
              style={{ width: '100%', padding: '14px' }}
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="animate-spin" size={18} /> Processing...
                </>
              ) : activeTab === 'NOW' ? (
                <>
                  <Zap size={18} /> Execute Atomic Spread Now
                </>
              ) : (
                <>
                  <Clock size={18} /> Authorize EIP-712 Spread Order
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Positions, Executor Monitor & Rollback Prover */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active Paired Position Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Active Paired Position</h3>
                <span className={`badge ${hasPosition ? 'badge-success' : 'badge-kuru'}`}>
                  {hasPosition ? '1 Active Pair' : 'No Open Positions'}
                </span>
              </div>

              {hasPosition && (
                <button className="btn-danger" onClick={handleClosePosition} disabled={isExecuting}>
                  Close Paired Position (Atomic Exit)
                </button>
              )}
            </div>

            {hasPosition ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '18px' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Spot Leg Held</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      +{spotMonHeld} MON
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>In Trader Wallet</div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Perpl Short Leg</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: '#c77dff' }}>
                      -{positionLots} Lots
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Perp ID #1 (Isolated)</div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Locked Margin</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                      416.06 AUSD
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-green)' }}>Health: 100% (Safe)</div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Unrealized Basis PnL</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)' }}>
                      {unrealizedPnl}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Delta neutral</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>Entry: Kuru Spot @ {entrySpotPrice} • Perpl Short @ {entryPerpPrice}</span>
                  <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>
                    Top-up Margin
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                No active paired positions. Use the order terminal on the left to execute an atomic spread entry.
              </div>
            )}
          </div>

          {/* Pending Orders Monitored by Background Executor */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Monitored Orders Queue</h3>
              </div>
              <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Executor Service: Active (3s loop)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '14px', fontWeight: 700 }}>{order.quantity}</span>
                      <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Target: {order.minSpread}
                      </span>
                      <span className={`badge ${order.status === 'EXECUTED' ? 'badge-success' : 'badge-kuru'}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                      Hash: {order.orderHash.slice(0, 22)}... • {order.timestamp}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)' }}>
                        {order.simulatedSpread}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last Simulation</div>
                    </div>

                    {order.status === 'PENDING' && (
                      <button
                        className="btn-danger"
                        style={{ padding: '6px 10px', fontSize: '11px' }}
                        onClick={() => {
                          setOrders(orders.map((o) => o.id === order.id ? { ...o, status: 'CANCELLED' } : o));
                          setExecutionMessage(`Nonce on-chain cancellation broadcasted for order ${order.id}.`);
                        }}
                      >
                        Cancel Nonce
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rollback Safety Prover & Architecture */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(157, 78, 221, 0.05)', borderColor: 'rgba(157, 78, 221, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <ShieldCheck color="#c77dff" size={20} />
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                Why Tandem Eliminates "Legged-In" Trading Risk
              </h4>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
              In traditional arbitrage or basis trading bots, trades are sent as separate API calls. If the spot buy fills on Kuru but the perp leg fails on Perpl (due to slippage, oracle price drift, or insufficient margin), the trader is left naked long.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <div style={{ background: 'rgba(255, 51, 102, 0.08)', border: '1px solid rgba(255, 51, 102, 0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ color: 'var(--accent-red)', fontWeight: 700, marginBottom: '2px' }}>Traditional Asynchronous Bots</div>
                <div style={{ color: 'var(--text-muted)' }}>Leg 1 commits. Leg 2 fails. Trader suffers unhedged market crash.</div>
              </div>
              <div style={{ background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ color: 'var(--accent-green)', fontWeight: 700, marginBottom: '2px' }}>Tandem Atomic Router</div>
                <div style={{ color: 'var(--text-muted)' }}>If either leg fails or spread condition fails, the EVM rolls back entire tx.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
