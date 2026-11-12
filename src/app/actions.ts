'use server';

import { randomUUID } from 'node:crypto';
import { and, count, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import {
  auditEvents,
  bays,
  loginAttempts,
  organizations,
  sites,
  users,
  workOrders,
} from '@/db/schema';
import { canCreateWorkOrder, canUpdateWorkOrder } from '@/lib/authorization';
import { hashPassword, verifyPassword } from '@/lib/password';
import { createSession, destroySession, recordAudit, requireUser } from '@/lib/session';

const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(128) });
const setupSchema = z.object({
  organization: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  setupToken: z.string().min(32).max(256),
});
const orderSchema = z.object({
  siteId: z.uuid(),
  vehicleRegistration: z.string().trim().min(2).max(20),
  vehicleDescription: z.string().trim().min(2).max(100),
  issueSummary: z.string().trim().min(5).max(500),
  dueDate: z.union([z.literal(''), z.iso.date()]).optional(),
  assignedUserId: z.string().optional(),
  bayId: z.string().optional(),
  status: z.enum(['new', 'in_progress', 'waiting_parts', 'completed']),
  blockerNote: z.string().trim().max(240).optional(),
});

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function setupOrganization(formData: FormData) {
  const parsed = setupSchema.safeParse(formValues(formData));
  if (!parsed.success || !process.env.SETUP_TOKEN || process.env.SETUP_TOKEN.length < 32) {
    redirect('/setup?error=invalid');
  }
  const input = parsed.data;
  if (input.setupToken !== process.env.SETUP_TOKEN) redirect('/setup?error=invalid');

  const [existing] = await db.select({ total: count() }).from(users);
  if ((existing?.total ?? 0) !== 0) redirect('/login');

  const leaderId = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  let organizationId = '';

  try {
    db.transaction((tx) => {
      const [current] = tx.select({ total: count() }).from(users).all();
      if ((current?.total ?? 0) !== 0) throw new Error('SETUP_ALREADY_COMPLETED');
      const [existingOrganization] = tx.select().from(organizations).limit(1).all();
      organizationId = existingOrganization?.id ?? randomUUID();
      if (existingOrganization) {
        tx.update(organizations)
          .set({ name: input.organization })
          .where(eq(organizations.id, organizationId))
          .run();
      } else {
        tx.insert(organizations)
          .values({ id: organizationId, name: input.organization, createdAt: now })
          .run();
      }
      tx.insert(users)
        .values({
          id: leaderId,
          organizationId,
          siteId: null,
          name: input.name,
          email: input.email,
          passwordHash,
          role: 'leader',
          active: true,
          createdAt: now,
        })
        .run();
      tx.insert(auditEvents)
        .values({
          id: randomUUID(),
          organizationId,
          actorUserId: leaderId,
          siteId: null,
          entityType: 'organization',
          entityId: organizationId,
          action: 'created',
          createdAt: now,
        })
        .run();
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'SETUP_ALREADY_COMPLETED') redirect('/login');
    throw error;
  }

  await createSession(leaderId);
  revalidatePath('/');
  redirect('/?notice=welcome');
}

export async function signIn(formData: FormData) {
  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) redirect('/login?error=credentials');
  const email = parsed.data.email.toLowerCase();
  const now = new Date();
  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, email))
    .limit(1);
  if (attempt?.lockedUntil && attempt.lockedUntil > now.toISOString())
    redirect('/login?error=locked');

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = Boolean(
    user?.active && (await verifyPassword(parsed.data.password, user.passwordHash))
  );
  if (!valid || !user) {
    const sameWindow =
      attempt && now.getTime() - new Date(attempt.windowStartedAt).getTime() < 15 * 60 * 1000;
    const failures = sameWindow ? attempt.failures + 1 : 1;
    const windowStartedAt = sameWindow ? attempt.windowStartedAt : now.toISOString();
    await db
      .insert(loginAttempts)
      .values({
        email,
        failures,
        windowStartedAt,
        lockedUntil: failures >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null,
      })
      .onConflictDoUpdate({
        target: loginAttempts.email,
        set: {
          failures,
          windowStartedAt,
          lockedUntil:
            failures >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null,
        },
      });
    redirect(failures >= 5 ? '/login?error=locked' : '/login?error=credentials');
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
  await createSession(user.id);
  redirect('/');
}

export async function signOut() {
  await destroySession();
  redirect('/login');
}

export async function createSite(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'leader') redirect('/?error=forbidden');
  const name = z.string().trim().min(2).max(80).safeParse(formData.get('name'));
  const city = z.string().trim().min(2).max(80).safeParse(formData.get('city'));
  if (!name.success || !city.success) redirect('/?error=site');

  const id = randomUUID();
  const now = new Date().toISOString();
  await db.insert(sites).values({
    id,
    organizationId: user.organizationId,
    name: name.data,
    city: city.data,
    timezone: 'UTC',
    createdAt: now,
  });
  await recordAudit(user.organizationId, user.id, id, 'site', id, 'created');
  revalidatePath('/');
  redirect('/?notice=site-created');
}

export async function createBay(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'leader') redirect('/?error=forbidden');
  const siteId = z.uuid().safeParse(formData.get('siteId'));
  const name = z.string().trim().min(1).max(40).safeParse(formData.get('name'));
  const [site] = siteId.success
    ? await db
        .select()
        .from(sites)
        .where(and(eq(sites.id, siteId.data), eq(sites.organizationId, user.organizationId)))
        .limit(1)
    : [];
  if (!site || !name.success) redirect('/?error=bay');

  const id = randomUUID();
  await db.insert(bays).values({
    id,
    siteId: site.id,
    name: name.data,
    usable: true,
    createdAt: new Date().toISOString(),
  });
  await recordAudit(user.organizationId, user.id, site.id, 'bay', id, 'created');
  revalidatePath('/');
  redirect('/?notice=bay-created');
}

export async function createStaffMember(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'leader') redirect('/?error=forbidden');
  const input = z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z.email().transform((value) => value.toLowerCase()),
      password: z.string().min(12).max(128),
      role: z.enum(['manager', 'staff']),
      siteId: z.uuid(),
    })
    .safeParse(formValues(formData));
  if (!input.success) redirect('/?error=staff');
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, input.data.siteId), eq(sites.organizationId, user.organizationId)))
    .limit(1);
  if (!site) redirect('/?error=staff');

  const id = randomUUID();
  try {
    await db.insert(users).values({
      id,
      organizationId: user.organizationId,
      siteId: site.id,
      name: input.data.name,
      email: input.data.email,
      passwordHash: await hashPassword(input.data.password),
      role: input.data.role,
      active: true,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE'))
      redirect('/?error=email-exists');
    throw error;
  }
  await recordAudit(user.organizationId, user.id, site.id, 'user', id, 'created');
  revalidatePath('/');
  redirect('/?notice=staff-created');
}

export async function createWorkOrder(formData: FormData) {
  const user = await requireUser();
  const input = orderSchema.safeParse(formValues(formData));
  if (!input.success) redirect('/?error=work-order');
  if (!canCreateWorkOrder(user, input.data.siteId)) redirect('/?error=forbidden');
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, input.data.siteId), eq(sites.organizationId, user.organizationId)))
    .limit(1);
  if (!site) redirect('/?error=work-order');

  const assignedUserId = input.data.assignedUserId || null;
  const bayId = input.data.bayId || null;
  if (assignedUserId) {
    const [assignedUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, assignedUserId), eq(users.siteId, site.id), eq(users.active, true)))
      .limit(1);
    if (!assignedUser) redirect('/?error=assignment');
  }
  if (bayId) {
    const [bay] = await db
      .select()
      .from(bays)
      .where(and(eq(bays.id, bayId), eq(bays.siteId, site.id), eq(bays.usable, true)))
      .limit(1);
    if (!bay) redirect('/?error=assignment');
    const [occupied] = await db
      .select({ total: count() })
      .from(workOrders)
      .where(and(eq(workOrders.bayId, bayId), ne(workOrders.status, 'completed')));
    if ((occupied?.total ?? 0) > 0) redirect('/?error=bay-occupied');
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const reference = `WO-${id.slice(0, 8).toUpperCase()}`;
  await db.insert(workOrders).values({
    id,
    organizationId: user.organizationId,
    siteId: site.id,
    reference,
    vehicleRegistration: input.data.vehicleRegistration.toUpperCase(),
    vehicleDescription: input.data.vehicleDescription,
    issueSummary: input.data.issueSummary,
    status: input.data.status,
    dueDate: input.data.dueDate || null,
    blockerNote:
      input.data.status === 'waiting_parts' ? input.data.blockerNote || 'Parts required' : null,
    assignedUserId,
    bayId,
    createdAt: now,
    updatedAt: now,
  });
  await recordAudit(user.organizationId, user.id, site.id, 'work_order', id, 'created');
  revalidatePath('/');
  redirect('/?notice=work-order-created');
}

export async function updateWorkOrder(formData: FormData) {
  const user = await requireUser();
  const input = orderSchema.extend({ id: z.uuid() }).safeParse(formValues(formData));
  if (!input.success) redirect('/?error=work-order');
  const [existing] = await db
    .select()
    .from(workOrders)
    .where(
      and(eq(workOrders.id, input.data.id), eq(workOrders.organizationId, user.organizationId))
    )
    .limit(1);
  if (!existing) redirect('/?error=not-found');
  if (!canUpdateWorkOrder(user, existing)) redirect('/?error=forbidden');
  if (input.data.siteId !== existing.siteId) redirect('/?error=forbidden');

  const assignedUserId = input.data.assignedUserId || null;
  const bayId = input.data.bayId || null;
  if (assignedUserId) {
    const [assignedUser] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.id, assignedUserId), eq(users.siteId, existing.siteId), eq(users.active, true))
      )
      .limit(1);
    if (!assignedUser || (user.role === 'staff' && assignedUser.id !== user.id))
      redirect('/?error=assignment');
  }
  if (bayId) {
    const [bay] = await db
      .select()
      .from(bays)
      .where(and(eq(bays.id, bayId), eq(bays.siteId, existing.siteId), eq(bays.usable, true)))
      .limit(1);
    if (!bay) redirect('/?error=assignment');
    const [occupied] = await db
      .select({ total: count() })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.bayId, bayId),
          ne(workOrders.status, 'completed'),
          ne(workOrders.id, existing.id)
        )
      );
    if ((occupied?.total ?? 0) > 0) redirect('/?error=bay-occupied');
  }

  await db
    .update(workOrders)
    .set({
      vehicleRegistration: input.data.vehicleRegistration.toUpperCase(),
      vehicleDescription: input.data.vehicleDescription,
      issueSummary: input.data.issueSummary,
      status: input.data.status,
      dueDate: input.data.dueDate || null,
      blockerNote:
        input.data.status === 'waiting_parts' ? input.data.blockerNote || 'Parts required' : null,
      assignedUserId,
      bayId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(workOrders.id, existing.id));
  await recordAudit(
    user.organizationId,
    user.id,
    existing.siteId,
    'work_order',
    existing.id,
    `updated:${existing.status}->${input.data.status}`
  );
  revalidatePath('/');
  redirect('/?notice=work-order-updated');
}
