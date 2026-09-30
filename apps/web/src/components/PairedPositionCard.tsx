import React from 'react';
import { PositionState } from '../types.js';

interface PairedPositionCardProps {
  position: PositionState;
  isExecuting: boolean;
  onClosePosition: () => void;
}

export const PairedPositionCard: React.FC<PairedPositionCardProps> = ({
  position,
  isExecuting,
  onClosePosition,
}) => {
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Active Paired Position</h3>
          <span className={`badge ${position.hasPosition ? 'badge-success' : 'badge-kuru'}`}>
            {position.hasPosition ? '1 Active Pair' : 'No Open Positions'}
          </span>
        </div>

        {position.hasPosition && (
          <button className="btn-danger" onClick={onClosePosition} disabled={isExecuting}>
            Close Paired Position (Atomic Exit)
          </button>
        )}
      </div>

      {position.hasPosition ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '18px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Spot Leg Held</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                +{position.spotMonHeld} MON
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>In Trader Wallet</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Perpl Short Leg</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: '#c77dff' }}>
                -{position.positionLots} Lots
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Perp ID #1 (Isolated)</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Locked Margin</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                {position.lockedMargin}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--accent-green)' }}>Health: 100% (Safe)</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Unrealized Basis PnL</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)' }}>
                {position.unrealizedPnl}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Delta neutral</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>Entry: Kuru Spot @ {position.entrySpotPrice} • Perpl Short @ {position.entryPerpPrice}</span>
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
  );
};
