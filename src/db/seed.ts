import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { bays, organizations, sites, workOrders } from './schema';

const organizationId = '00000000-0000-4000-8000-000000000001';
const locations = [
  { id: '00000000-0000-4000-8000-000000000011', name: 'Harbour Yard', city: 'Bristol' },
  { id: '00000000-0000-4000-8000-000000000012', name: 'Northgate Service', city: 'Leeds' },
  { id: '00000000-0000-4000-8000-000000000013', name: 'Riverside Motors', city: 'Manchester' },
] as const;

const examples = [
  {
    siteIndex: 0,
    registration: 'BJ19 LKA',
    vehicle: 'Volkswagen Golf',
    issue: 'Investigate intermittent engine warning light',
    status: 'in_progress',
    dueOffset: 0,
    bayIndex: 1,
  },
  {
    siteIndex: 0,
    registration: 'YK72 NPM',
    vehicle: 'Ford Transit Custom',
    issue: 'Replace rear brake pads and inspect discs',
    status: 'waiting_parts',
    dueOffset: 1,
    bayIndex: 2,
  },
  {
    siteIndex: 0,
    registration: 'MH68 VOT',
    vehicle: 'Toyota Corolla',
    issue: 'Complete annual service and safety check',
    status: 'new',
    dueOffset: 2,
    bayIndex: null,
  },
  {
    siteIndex: 0,
    registration: 'FP21 RDE',
    vehicle: 'BMW 320d',
    issue: 'Diagnose vibration under acceleration',
    status: 'in_progress',
    dueOffset: -1,
    bayIndex: 3,
  },
  {
    siteIndex: 1,
    registration: 'LR70 CZN',
    vehicle: 'Vauxhall Vivaro',
    issue: 'Replace nearside mirror assembly',
    status: 'waiting_parts',
    dueOffset: 2,
    bayIndex: 1,
  },
  {
    siteIndex: 1,
    registration: 'OU23 HGF',
    vehicle: 'Nissan Qashqai',
    issue: 'Investigate loss of cabin heating',
    status: 'new',
    dueOffset: 1,
    bayIndex: null,
  },
  {
    siteIndex: 1,
    registration: 'KT18 JRV',
    vehicle: 'Honda Civic',
    issue: 'Repair rear parking sensor fault',
    status: 'in_progress',
    dueOffset: 0,
    bayIndex: 2,
  },
  {
    siteIndex: 2,
    registration: 'EA22 WQK',
    vehicle: 'Kia Sportage',
    issue: 'Replace front tyres and check alignment',
    status: 'new',
    dueOffset: 3,
    bayIndex: null,
  },
  {
    siteIndex: 2,
    registration: 'DV19 PLS',
    vehicle: 'Mercedes Sprinter',
    issue: 'Diagnose intermittent starting issue',
    status: 'waiting_parts',
    dueOffset: 1,
    bayIndex: 1,
  },
  {
    siteIndex: 2,
    registration: 'CN71 XTZ',
    vehicle: 'Hyundai Tucson',
    issue: 'Complete brake fluid change',
    status: 'completed',
    dueOffset: -2,
    bayIndex: 2,
  },
] as const;

function bayIdFor(siteIndex: number, bayIndex: number) {
  return `00000000-0000-4000-800${siteIndex + 1}-${String(bayIndex).padStart(12, '0')}`;
}

async function main() {
  const now = new Date().toISOString();
  await db
    .insert(organizations)
    .values({ id: organizationId, name: 'Northstar Garage Group', createdAt: now })
    .onConflictDoNothing();

  for (const [siteIndex, location] of locations.entries()) {
    await db
      .insert(sites)
      .values({
        ...location,
        organizationId,
        timezone: 'UTC',
        createdAt: now,
      })
      .onConflictDoNothing();

    for (let index = 1; index <= 6; index += 1) {
      await db
        .insert(bays)
        .values({
          id: bayIdFor(siteIndex, index),
          siteId: location.id,
          name: `Bay ${String(index).padStart(2, '0')}`,
          usable: index !== 6,
          createdAt: now,
        })
        .onConflictDoNothing();
    }
  }

  for (const [index, example] of examples.entries()) {
    const [existing] = await db
      .select()
      .from(workOrders)
      .where(eq(workOrders.vehicleRegistration, example.registration))
      .limit(1);
    if (existing) continue;

    const location = locations[example.siteIndex];
    if (!location) throw new Error('Seed data references an unknown site.');
    const id = randomUUID();
    const createdAt = new Date(Date.now() - (example.dueOffset + 3) * 86_400_000).toISOString();
    const dueDate = new Date(Date.now() + example.dueOffset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const bayId = example.bayIndex ? bayIdFor(example.siteIndex, example.bayIndex) : null;

    await db.insert(workOrders).values({
      id,
      organizationId,
      siteId: location.id,
      reference: `WO-${String(index + 1).padStart(4, '0')}`,
      vehicleRegistration: example.registration,
      vehicleDescription: example.vehicle,
      issueSummary: example.issue,
      status: example.status,
      dueDate,
      blockerNote: example.status === 'waiting_parts' ? 'Awaiting supplier delivery' : null,
      assignedUserId: null,
      bayId,
      createdAt,
      updatedAt: createdAt,
    });
  }

  console.log('Garage data seeded. Create the first leader account to get started.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
