import { Hash } from 'viem';
import { PendingSpreadOrderRecord } from './types.js';

class OrderStore {
  private orders: Map<Hash, PendingSpreadOrderRecord> = new Map();

  addOrder(record: PendingSpreadOrderRecord): void {
    this.orders.set(record.orderHash, record);
  }

  getOrder(orderHash: Hash): PendingSpreadOrderRecord | undefined {
    return this.orders.get(orderHash);
  }

  getPendingOrders(): PendingSpreadOrderRecord[] {
    const now = Math.floor(Date.now() / 1000);
    return Array.from(this.orders.values()).filter((rec) => {
      if (rec.status === 'PENDING') {
        if (BigInt(now) > rec.order.expiry) {
          rec.status = 'EXPIRED';
          return false;
        }
        return true;
      }
      return false;
    });
  }

  getAllOrders(): PendingSpreadOrderRecord[] {
    return Array.from(this.orders.values());
  }

  updateStatus(
    orderHash: Hash,
    status: PendingSpreadOrderRecord['status'],
    details?: Partial<PendingSpreadOrderRecord>
  ): void {
    const existing = this.orders.get(orderHash);
    if (existing) {
      this.orders.set(orderHash, {
        ...existing,
        status,
        ...details,
      });
    }
  }
}

export const orderStore = new OrderStore();
