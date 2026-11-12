import 'server-only';
import { and, asc, count, eq, gte, gt, lt, lte, ne, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { bays, sites, users, workOrders, type User } from '@/db/schema';

export const statusLabels = {
  new: 'New',
  in_progress: 'In progress',
  waiting_parts: 'Waiting for parts',
  completed: 'Completed',
} as const;

export type StatusKey = keyof typeof statusLabels;
const PAGE_SIZE = 25;

export async function hasWorkspaceUsers() {
  const [result] = await db.select({ total: count() }).from(users);
  return (result?.total ?? 0) > 0;
}

export async function getDashboardData(
  user: User,
  filters: { siteId?: string; from?: string; to?: string; page?: number }
) {
  const availableSites = await db
    .select()
    .from(sites)
    .where(
      user.role === 'leader'
        ? eq(sites.organizationId, user.organizationId)
        : eq(sites.id, user.siteId ?? '')
    )
    .orderBy(asc(sites.name));

  const siteIds = availableSites.map((site) => site.id);
  const selectedSiteId = siteIds.includes(filters.siteId ?? '') ? filters.siteId : undefined;
  const visibleSiteIds = selectedSiteId ? [selectedSiteId] : siteIds;
  const siteCondition = visibleSiteIds.length
    ? or(...visibleSiteIds.map((id) => eq(workOrders.siteId, id)))
    : eq(workOrders.siteId, '');
  const dateConditions: SQL[] = [];
  if (filters.from) dateConditions.push(gte(workOrders.createdAt, `${filters.from}T00:00:00.000Z`));
  if (filters.to) dateConditions.push(lte(workOrders.createdAt, `${filters.to}T23:59:59.999Z`));
  const assignmentCondition =
    user.role === 'staff' ? eq(workOrders.assignedUserId, user.id) : undefined;
  const commonConditions = [
    eq(workOrders.organizationId, user.organizationId),
    siteCondition,
    ...dateConditions,
    ...(assignmentCondition ? [assignmentCondition] : []),
  ];

  const [totalRows, staffCount] = await Promise.all([
    db
      .select({ total: count() })
      .from(workOrders)
      .where(and(...commonConditions)),
    db
      .select({ total: count() })
      .from(users)
      .where(
        user.role === 'leader'
          ? and(
              eq(users.organizationId, user.organizationId),
              eq(users.active, true),
              ne(users.role, 'leader')
            )
          : and(
              eq(users.siteId, user.siteId ?? ''),
              eq(users.active, true),
              ne(users.role, 'leader')
            )
      ),
  ]);

  const total = totalRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(filters.page ?? 1, totalPages));
  const [orders] = await Promise.all([
    db
      .select({
        order: workOrders,
        siteName: sites.name,
        assignedName: users.name,
        bayName: bays.name,
      })
      .from(workOrders)
      .innerJoin(sites, eq(workOrders.siteId, sites.id))
      .leftJoin(users, eq(workOrders.assignedUserId, users.id))
      .leftJoin(bays, eq(workOrders.bayId, bays.id))
      .where(and(...commonConditions))
      .orderBy(asc(workOrders.dueDate), asc(workOrders.createdAt), asc(workOrders.id))
      .limit(PAGE_SIZE)
      .offset((currentPage - 1) * PAGE_SIZE),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const siteStats = await Promise.all(
    availableSites
      .filter((site) => !selectedSiteId || site.id === selectedSiteId)
      .map(async (site) => {
        const conditions = [
          eq(workOrders.organizationId, user.organizationId),
          eq(workOrders.siteId, site.id),
          ...dateConditions,
          ...(assignmentCondition ? [assignmentCondition] : []),
        ];
        const [openCount, overdueCount, waitingCount, bayCount, occupiedBays] = await Promise.all([
          db
            .select({ total: count() })
            .from(workOrders)
            .where(and(...conditions, ne(workOrders.status, 'completed'))),
          db
            .select({ total: count() })
            .from(workOrders)
            .where(
              and(...conditions, ne(workOrders.status, 'completed'), lt(workOrders.dueDate, today))
            ),
          db
            .select({ total: count() })
            .from(workOrders)
            .where(and(...conditions, eq(workOrders.status, 'waiting_parts'))),
          db
            .select({ total: count() })
            .from(bays)
            .where(and(eq(bays.siteId, site.id), eq(bays.usable, true))),
          db
            .select({ bayId: workOrders.bayId })
            .from(workOrders)
            .where(and(...conditions, ne(workOrders.status, 'completed'), gt(workOrders.bayId, '')))
            .groupBy(workOrders.bayId),
        ]);
        return {
          ...site,
          open: openCount[0]?.total ?? 0,
          overdue: overdueCount[0]?.total ?? 0,
          waitingParts: waitingCount[0]?.total ?? 0,
          usableBays: bayCount[0]?.total ?? 0,
          occupiedBays: occupiedBays.length,
        };
      })
  );

  const allVisibleOrders = orders.map((row) => ({
    ...row.order,
    siteName: row.siteName,
    assignedName: row.assignedName,
    bayName: row.bayName,
    isOverdue:
      row.order.status !== 'completed' && Boolean(row.order.dueDate && row.order.dueDate < today),
  }));

  const [totalOpen, totalOverdue, totalBlocked] = await Promise.all([
    db
      .select({ total: count() })
      .from(workOrders)
      .where(and(...commonConditions, ne(workOrders.status, 'completed'))),
    db
      .select({ total: count() })
      .from(workOrders)
      .where(
        and(...commonConditions, ne(workOrders.status, 'completed'), lt(workOrders.dueDate, today))
      ),
    db
      .select({ total: count() })
      .from(workOrders)
      .where(and(...commonConditions, eq(workOrders.status, 'waiting_parts'))),
  ]);

  return {
    sites: availableSites,
    siteStats,
    orders: allVisibleOrders,
    staffCount: staffCount[0]?.total ?? 0,
    totalOpen: totalOpen[0]?.total ?? 0,
    totalOverdue: totalOverdue[0]?.total ?? 0,
    totalBlocked: totalBlocked[0]?.total ?? 0,
    currentPage,
    pageSize: PAGE_SIZE,
    totalPages,
    totalRows: total,
  };
}

export async function getSitePeopleAndBays(siteId: string) {
  const [team, siteBays] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.siteId, siteId), eq(users.active, true)))
      .orderBy(asc(users.name)),
    db
      .select({ id: bays.id, name: bays.name })
      .from(bays)
      .where(and(eq(bays.siteId, siteId), eq(bays.usable, true)))
      .orderBy(asc(bays.name)),
  ]);
  return { team, bays: siteBays };
}
