# Pitlane Workshop Operations

Pitlane gives a multi-location garage team one view of open work orders, bay capacity, overdue jobs, and parts blockers. The application includes role-scoped accounts for operations leaders, site managers, and workshop staff.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm ci
cp .env.example .env
```

Set `SETUP_TOKEN` in `.env` to a private, unpredictable value of at least 32 characters. Keep `.env` private and do not commit it. The default `DATABASE_URL` stores the SQLite database in `dev.db`.

Create the database and sample operations records:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Start the application with `npm run dev`, then open it in your browser. The first-time setup page asks for the private setup key and creates the first operations leader. Sample records are examples; replace them with real garage data before relying on the dashboard.

## Use the application

- Leaders can see every location, create locations and bays, add site managers and staff, and create work orders.
- Site managers can see and update work at their assigned location, including job status, due dates, staff, and bays.
- Workshop staff can see and update their assigned work only.
- Team members can change their own password from the Password & security panel.
- Work is considered overdue when its due date is earlier than the current UTC date and it is not completed. Opened-date filters use UTC timestamps.
- Bay occupancy counts distinct bays assigned to non-completed work orders. Keep bay and work-order assignments current for accurate capacity figures.

## Checks

```bash
npm run format:check
npm run lint
npm run type-check
npm test
npm run build
```

Generate and review versioned database migrations for schema changes. Apply them with `npm run db:migrate`; do not use `db:push` against a production database.

## Learn More

Next.js documentation: https://nextjs.org/docs.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
