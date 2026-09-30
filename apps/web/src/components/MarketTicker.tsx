import React from 'react';
import { MarketState } from '../types.js';

interface MarketTickerProps {
  market: MarketState;
}

export const MarketTicker: React.FC<MarketTickerProps> = ({ market }) => {
  return (
    <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span className="badge badge-kuru">Spot Buy (Kuru)</span>
        </div>
        <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
          ${market.spotAsk.toFixed(4)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>USDC</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Deepest Ask • Fill-Or-Kill</div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span className="badge badge-perpl">Perp Short (Perpl)</span>
        </div>
        <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#c77dff' }}>
          ${market.perpBid.toFixed(4)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AUSD</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mark Bid • Isolated Margin</div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span className="badge badge-success">Live Net Spread</span>
        </div>
        <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-green)' }}>
          +{market.netSpread} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AUSD/MON</span>
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
  );
};
