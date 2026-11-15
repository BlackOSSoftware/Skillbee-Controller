import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { OrdersManagement } from '@/features/orders/components/orders-management';

export const metadata: Metadata = { title: 'Orders & Payments' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function OrdersPage() {
  return (
    <ModuleGate slug="orders">
      <OrdersManagement />
    </ModuleGate>
  );
}
