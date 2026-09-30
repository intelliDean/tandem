import React from 'react';
import { Clock } from 'lucide-react';
import { OrderItem } from '../types.js';

interface MonitoredOrdersQueueProps {
  orders: OrderItem[];
  onCancelOrder: (id: string) => void;
}

export const MonitoredOrdersQueue: React.FC<MonitoredOrdersQueueProps> = ({
  orders,
  onCancelOrder,
}) => {
  return (
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
                  onClick={() => onCancelOrder(order.id)}
                >
                  Cancel Nonce
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
