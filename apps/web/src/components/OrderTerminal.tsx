import React from 'react';
import { Zap, Clock, RefreshCw } from 'lucide-react';

interface OrderTerminalProps {
  activeTab: 'NOW' | 'LIMIT';
  setActiveTab: (tab: 'NOW' | 'LIMIT') => void;
  monQuantity: string;
  setMonQuantity: (val: string) => void;
  maxSpotSpend: string;
  setMaxSpotSpend: (val: string) => void;
  perpLots: string;
  setPerpLots: (val: string) => void;
  collateral: string;
  setCollateral: (val: string) => void;
  minSpread: string;
  setMinSpread: (val: string) => void;
  expiryHours: string;
  setExpiryHours: (val: string) => void;
  currentNetSpread: string;
  isExecuting: boolean;
  onSubmit: () => void;
}

export const OrderTerminal: React.FC<OrderTerminalProps> = ({
  activeTab,
  setActiveTab,
  monQuantity,
  setMonQuantity,
  maxSpotSpend,
  setMaxSpotSpend,
  perpLots,
  setPerpLots,
  collateral,
  setCollateral,
  minSpread,
  setMinSpread,
  expiryHours,
  setExpiryHours,
  currentNetSpread,
  isExecuting,
  onSubmit,
}) => {
  return (
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
          onClick={onSubmit}
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
  );
};
