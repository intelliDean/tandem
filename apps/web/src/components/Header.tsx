import React from 'react';
import { Layers, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  walletConnected: boolean;
  account: string;
  onToggleWallet: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  walletConnected,
  account,
  onToggleWallet,
}) => {
  return (
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
            <span className="badge badge-atomic">Monad Testnet</span>
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
          <span className="mono" style={{ fontWeight: 600 }}>Monad Testnet (#10143)</span>
        </div>

        <button
          className="btn-secondary mono"
          onClick={onToggleWallet}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ShieldCheck size={16} color="var(--accent-cyan)" />
          {walletConnected ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
        </button>
      </div>
    </header>
  );
};
