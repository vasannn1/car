import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canCreateWorkOrder, canUpdateWorkOrder } from './authorization';

const leader = { id: 'leader-1', organizationId: 'org-1', siteId: null, role: 'leader' } as const;
const manager = {
  id: 'manager-1',
  organizationId: 'org-1',
  siteId: 'site-1',
  role: 'manager',
} as const;
const staff = { id: 'staff-1', organizationId: 'org-1', siteId: 'site-1', role: 'staff' } as const;
const order = { organizationId: 'org-1', siteId: 'site-1', assignedUserId: 'staff-1' };

test('work-order creation is limited by role and assigned location', () => {
  assert.equal(canCreateWorkOrder(leader, 'site-2'), true);
  assert.equal(canCreateWorkOrder(manager, 'site-1'), true);
  assert.equal(canCreateWorkOrder(manager, 'site-2'), false);
  assert.equal(canCreateWorkOrder(staff, 'site-1'), false);
});

test('work-order updates enforce organization, location, and staff assignment', () => {
  assert.equal(canUpdateWorkOrder(leader, order), true);
  assert.equal(canUpdateWorkOrder(manager, order), true);
  assert.equal(canUpdateWorkOrder(staff, order), true);
  assert.equal(canUpdateWorkOrder({ ...manager, siteId: 'site-2' }, order), false);
  assert.equal(canUpdateWorkOrder({ ...staff, id: 'staff-2' }, order), false);
  assert.equal(canUpdateWorkOrder(staff, { ...order, assignedUserId: null }), false);
  assert.equal(canUpdateWorkOrder({ ...leader, organizationId: 'org-2' }, order), false);
});
