import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sites = sqliteTable(
  'sites',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    city: text('city').notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('sites_organization_idx').on(table.organizationId)]
);

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: text('site_id').references(() => sites.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['leader', 'manager', 'staff'] }).notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    index('users_organization_idx').on(table.organizationId),
    index('users_site_idx').on(table.siteId),
  ]
);

export const bays = sqliteTable(
  'bays',
  {
    id: text('id').primaryKey(),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    usable: integer('usable', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('bays_site_idx').on(table.siteId)]
);

export const workOrders = sqliteTable(
  'work_orders',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    reference: text('reference').notNull(),
    vehicleRegistration: text('vehicle_registration').notNull(),
    vehicleDescription: text('vehicle_description').notNull(),
    issueSummary: text('issue_summary').notNull(),
    status: text('status', {
      enum: ['new', 'in_progress', 'waiting_parts', 'completed'],
    })
      .notNull()
      .default('new'),
    dueDate: text('due_date'),
    blockerNote: text('blocker_note'),
    assignedUserId: text('assigned_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    bayId: text('bay_id').references(() => bays.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('work_orders_reference_unique').on(table.reference),
    index('work_orders_site_status_idx').on(table.siteId, table.status),
    index('work_orders_due_date_idx').on(table.dueDate),
  ]
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)]
);

export const loginAttempts = sqliteTable('login_attempts', {
  email: text('email').primaryKey(),
  failures: integer('failures').notNull().default(0),
  windowStartedAt: text('window_started_at').notNull(),
  lockedUntil: text('locked_until'),
});

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    siteId: text('site_id').references(() => sites.id, { onDelete: 'set null' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_events_org_date_idx').on(table.organizationId, table.createdAt)]
);

export const sitesRelations = relations(sites, ({ many }) => ({
  bays: many(bays),
  workOrders: many(workOrders),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  site: one(sites, { fields: [users.siteId], references: [sites.id] }),
  sessions: many(sessions),
}));

export const workOrdersRelations = relations(workOrders, ({ one }) => ({
  site: one(sites, { fields: [workOrders.siteId], references: [sites.id] }),
  assignedUser: one(users, {
    fields: [workOrders.assignedUserId],
    references: [users.id],
  }),
  bay: one(bays, { fields: [workOrders.bayId], references: [bays.id] }),
}));

export type User = typeof users.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
