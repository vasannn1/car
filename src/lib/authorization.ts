import type { User, WorkOrder } from '@/db/schema';

type Actor = Pick<User, 'id' | 'organizationId' | 'siteId' | 'role'>;
type WorkOrderScope = Pick<WorkOrder, 'organizationId' | 'siteId' | 'assignedUserId'>;

export function canCreateWorkOrder(actor: Actor, siteId: string) {
  return actor.role !== 'staff' && (actor.role === 'leader' || actor.siteId === siteId);
}

export function canUpdateWorkOrder(actor: Actor, order: WorkOrderScope) {
  if (actor.organizationId !== order.organizationId) return false;
  if (actor.role === 'leader') return true;
  if (actor.siteId !== order.siteId) return false;
  return actor.role !== 'staff' || order.assignedUserId === actor.id;
}
