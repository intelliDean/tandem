import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const RollbackProver: React.FC = () => {
  return (
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
  );
};
