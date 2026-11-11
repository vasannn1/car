import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  createBay,
  createSite,
  createStaffMember,
  createWorkOrder,
  signOut,
  updateWorkOrder,
} from './actions';
import {
  getDashboardData,
  getSitePeopleAndBays,
  hasWorkspaceUsers,
  statusLabels,
} from '@/lib/garage';
import { getCurrentUser } from '@/lib/session';
import { PasswordSettings } from '@/components/password-settings';

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusClass = {
  new: 'status-new',
  in_progress: 'status-progress',
  waiting_parts: 'status-blocked',
  completed: 'status-complete',
} as const;

function shortDate(date: string | null) {
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function noticeText(code?: string) {
  const messages: Record<string, string> = {
    welcome: 'Your operations workspace is ready.',
    'site-created': 'Location added.',
    'bay-created': 'Workshop bay added.',
    'staff-created': 'Team member added.',
    'work-order-created': 'Work order created.',
    'work-order-updated': 'Work order updated.',
    'password-updated': 'Your password has been changed and your other sessions were signed out.',
  };
  return code ? messages[code] : undefined;
}

function errorText(code?: string) {
  const messages: Record<string, string> = {
    forbidden: 'You do not have permission to make that change.',
    site: 'Enter a valid location name and city.',
    bay: 'Choose a valid location and enter a bay name.',
    staff: 'Check the team member details and selected location.',
    'email-exists': 'That email address is already in use.',
    'work-order': 'Check the required vehicle and repair details.',
    assignment: 'Choose a team member and bay from the selected location.',
    'bay-occupied': 'That bay already has an open work order assigned.',
    'not-found': 'That work order could not be found.',
    password: 'The current password or new-password confirmation is incorrect.',
  };
  return code ? (messages[code] ?? 'The request could not be completed.') : undefined;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default async function Home({ searchParams }: DashboardPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect((await hasWorkspaceUsers()) ? '/login' : '/setup');

  const params = await searchParams;
  const siteFilter = typeof params.site === 'string' ? params.site : undefined;
  const from = isIsoDate(params.from) ? params.from : undefined;
  const to = isIsoDate(params.to) ? params.to : undefined;
  const requestedPage =
    typeof params.page === 'string' && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  const dashboard = await getDashboardData(user, {
    siteId: siteFilter,
    from,
    to,
    page: requestedPage,
  });
  const defaultSiteId =
    siteFilter && dashboard.sites.some((site) => site.id === siteFilter)
      ? siteFilter
      : (user.siteId ?? dashboard.sites[0]?.id);
  const siteResources = Object.fromEntries(
    await Promise.all(
      dashboard.sites.map(async (site) => [site.id, await getSitePeopleAndBays(site.id)] as const)
    )
  );
  const notice = noticeText(typeof params.notice === 'string' ? params.notice : undefined);
  const error = errorText(typeof params.error === 'string' ? params.error : undefined);
  const canManageJobs = user.role !== 'staff';
  const leader = user.role === 'leader';

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/" aria-label="Pitlane operations home">
          <span className="brand-mark">P</span>
          <span>
            <strong>PITLANE</strong>
            <small>WORKSHOP OPERATIONS</small>
          </span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <Link className="nav-item nav-item-active" href="/" aria-current="page">
          <span className="nav-glyph" aria-hidden="true">
            ▦
          </span>
          Operations overview
        </Link>
        <div className="sidebar-rule" />
        <div className="site-list-label">
          YOUR LOCATIONS <span>{dashboard.sites.length}</span>
        </div>
        <div className="site-list">
          {dashboard.sites.map((site) => (
            <div className="site-link" key={site.id}>
              <span className="site-dot" />
              <span>{site.name}</span>
              <span className="site-open-count">
                {dashboard.siteStats.find((stat) => stat.id === site.id)?.open ?? '—'}
              </span>
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="user-chip-copy">
              <strong>{user.name}</strong>
              <small>
                {leader
                  ? 'Operations leader'
                  : user.role === 'manager'
                    ? 'Site manager'
                    : 'Workshop staff'}
              </small>
            </span>
          </div>
          <form action={signOut}>
            <button className="sign-out" type="submit">
              Sign out <span aria-hidden="true">↗</span>
            </button>
          </form>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>Operations</strong>
          </div>
          <div className="topbar-meta">
            <span className="live-indicator" /> Live operations <span className="topbar-divider" />
            <span>
              {new Intl.DateTimeFormat('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              }).format(new Date())}
            </span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">MULTI-SITE WORKSHOP CONTROL</div>
              <h1>
                Operations overview<span className="heading-period">.</span>
              </h1>
              <p className="page-subtitle">
                A clear view of every job, bay and blocker across your network.
              </p>
            </div>
            <div className="heading-site-count">
              <span className="mini-bars">
                <i />
                <i />
                <i />
              </span>
              <strong>{dashboard.sites.length}</strong>
              <span>active locations</span>
            </div>
          </div>

          {notice && (
            <div className="feedback feedback-success" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="feedback feedback-error" role="alert">
              {error}
            </div>
          )}

          <form className="filter-bar" method="get">
            <label className="filter-field site-filter">
              <span>LOCATION</span>
              <select
                name="site"
                defaultValue={siteFilter ?? 'all'}
                aria-label="Filter by location"
              >
                <option value="all">All locations</option>
                {dashboard.sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>OPENED FROM</span>
              <input type="date" name="from" defaultValue={from} />
            </label>
            <label className="filter-field">
              <span>OPENED TO</span>
              <input type="date" name="to" defaultValue={to} />
            </label>
            <button className="button button-filter" type="submit">
              Apply filters <span aria-hidden="true">→</span>
            </button>
            {(siteFilter || from || to) && (
              <Link className="clear-filter" href="/">
                Clear
              </Link>
            )}
            <span className="filter-updated">DATABASE VIEW</span>
          </form>

          <div className="metric-grid">
            <article className="metric-card metric-card-primary">
              <div className="metric-label">
                OPEN WORK ORDERS <span className="metric-symbol">↗</span>
              </div>
              <div className="metric-value">{dashboard.totalOpen.toString().padStart(2, '0')}</div>
              <div className="metric-foot">Across selected locations</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">
                PAST DUE <span className="metric-symbol metric-symbol-alert">!</span>
              </div>
              <div className="metric-value metric-value-alert">
                {dashboard.totalOverdue.toString().padStart(2, '0')}
              </div>
              <div className="metric-foot">Need attention today</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">
                WAITING ON PARTS <span className="metric-symbol metric-symbol-amber">◷</span>
              </div>
              <div className="metric-value">
                {dashboard.totalBlocked.toString().padStart(2, '0')}
              </div>
              <div className="metric-foot">Currently holding up work</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">
                USABLE BAYS <span className="metric-symbol metric-symbol-green">▤</span>
              </div>
              <div className="metric-value">
                {dashboard.siteStats
                  .reduce((sum, site) => sum + site.usableBays, 0)
                  .toString()
                  .padStart(2, '0')}
              </div>
              <div className="metric-foot">
                {dashboard.siteStats.reduce((sum, site) => sum + site.occupiedBays, 0)} occupied ·{' '}
                {dashboard.siteStats.reduce(
                  (sum, site) => sum + site.usableBays - site.occupiedBays,
                  0
                )}{' '}
                spare
              </div>
            </article>
          </div>

          <div className="section-heading">
            <div>
              <div className="eyebrow">NETWORK SNAPSHOT</div>
              <h2>Location performance</h2>
            </div>
            <span className="section-note">
              LIVE WORKLOAD <i className="live-indicator" />
            </span>
          </div>
          <div className="location-table-wrap">
            <table className="location-table">
              <thead>
                <tr>
                  <th>LOCATION</th>
                  <th>OPEN JOBS</th>
                  <th>CAPACITY</th>
                  <th>PAST DUE</th>
                  <th>PARTS HOLD</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.siteStats.map((site) => {
                  const spare = Math.max(0, site.usableBays - site.occupiedBays);
                  const utilization = site.usableBays
                    ? Math.min(100, Math.round((site.occupiedBays / site.usableBays) * 100))
                    : 0;
                  const utilizationLevel = Math.round(utilization / 10) * 10;
                  return (
                    <tr key={site.id}>
                      <td>
                        <div className="location-name">
                          <span className="location-icon">{site.name.slice(0, 1)}</span>
                          <span>
                            <strong>{site.name}</strong>
                            <small>{site.city}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong className="table-number">
                          {site.open.toString().padStart(2, '0')}
                        </strong>
                      </td>
                      <td>
                        <div className="capacity-cell">
                          <strong>
                            {site.occupiedBays}
                            <span> / {site.usableBays}</span>
                          </strong>
                          <div className="capacity-track">
                            <i className={`capacity-fill capacity-fill-${utilizationLevel}`} />
                          </div>
                          <small>
                            {spare} bay{spare === 1 ? '' : 's'} spare
                          </small>
                        </div>
                      </td>
                      <td>
                        <span className={site.overdue ? 'table-alert' : 'table-muted'}>
                          {site.overdue.toString().padStart(2, '0')}
                        </span>
                      </td>
                      <td>
                        <span className={site.waitingParts ? 'table-blocked' : 'table-muted'}>
                          {site.waitingParts.toString().padStart(2, '0')}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            site.overdue || site.waitingParts
                              ? 'site-status site-status-attention'
                              : 'site-status'
                          }
                        >
                          <i />
                          {site.overdue || site.waitingParts ? 'Needs attention' : 'On track'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {dashboard.siteStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No locations match this view. Clear the filters or add a location.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="section-heading jobs-heading">
            <div>
              <div className="eyebrow">WORK IN PROGRESS</div>
              <h2>Priority work queue</h2>
            </div>
            <span className="queue-count">
              {dashboard.totalRows} WORK ORDERS <span>·</span> PAGE {dashboard.currentPage} /{' '}
              {dashboard.totalPages}
            </span>
          </div>
          <div className="work-list">
            {dashboard.orders.map((order) => {
              const resources = siteResources[order.siteId] ?? { team: [], bays: [] };
              return (
                <details className="work-item" key={order.id}>
                  <summary className="work-summary">
                    <span className={`work-status-mark ${statusClass[order.status]}`} />
                    <span className="work-reference">{order.reference}</span>
                    <span className="work-vehicle">
                      <strong>{order.vehicleRegistration}</strong>
                      <small>{order.vehicleDescription}</small>
                    </span>
                    <span className="work-issue">{order.issueSummary}</span>
                    <span className="work-location">{order.siteName}</span>
                    <span className={`status-pill ${statusClass[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                    <span className={order.isOverdue ? 'work-due work-due-late' : 'work-due'}>
                      {order.isOverdue ? 'OVERDUE · ' : ''}
                      {shortDate(order.dueDate)}
                    </span>
                    <span className="expand-caret" aria-hidden="true">
                      ⌄
                    </span>
                  </summary>
                  <div className="work-detail">
                    <div className="work-detail-copy">
                      <span>ASSIGNED TO</span>
                      <strong>{order.assignedName ?? 'Unassigned'}</strong>
                      <span>WORKSHOP BAY</span>
                      <strong>{order.bayName ?? 'No bay assigned'}</strong>
                      {order.blockerNote && (
                        <p className="blocker-note">Parts hold: {order.blockerNote}</p>
                      )}
                    </div>
                    {(leader || user.role === 'manager' || order.assignedUserId === user.id) &&
                      order.status !== 'completed' && (
                        <form className="inline-edit-form" action={updateWorkOrder}>
                          <input type="hidden" name="id" value={order.id} />
                          <input type="hidden" name="siteId" value={order.siteId} />
                          <input
                            type="hidden"
                            name="vehicleRegistration"
                            value={order.vehicleRegistration}
                          />
                          <input
                            type="hidden"
                            name="vehicleDescription"
                            value={order.vehicleDescription}
                          />
                          <input type="hidden" name="issueSummary" value={order.issueSummary} />
                          {user.role === 'staff' && (
                            <>
                              <input type="hidden" name="assignedUserId" value={user.id} />
                              <input type="hidden" name="bayId" value={order.bayId ?? ''} />
                            </>
                          )}
                          <label>
                            Status
                            <select name="status" defaultValue={order.status}>
                              {Object.entries(statusLabels).map(([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Due date
                            <input type="date" name="dueDate" defaultValue={order.dueDate ?? ''} />
                          </label>
                          {user.role !== 'staff' && (
                            <>
                              <label>
                                Assign staff
                                <select
                                  name="assignedUserId"
                                  defaultValue={order.assignedUserId ?? ''}
                                >
                                  <option value="">Unassigned</option>
                                  {resources.team.map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Workshop bay
                                <select name="bayId" defaultValue={order.bayId ?? ''}>
                                  <option value="">No bay</option>
                                  {resources.bays.map((bay) => (
                                    <option key={bay.id} value={bay.id}>
                                      {bay.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </>
                          )}
                          <label className="blocker-input">
                            Parts needed
                            <input
                              type="text"
                              name="blockerNote"
                              defaultValue={order.blockerNote ?? ''}
                              placeholder="Part or delivery note"
                              maxLength={240}
                            />
                          </label>
                          <button className="button button-small" type="submit">
                            Save update
                          </button>
                        </form>
                      )}
                  </div>
                </details>
              );
            })}
            {dashboard.orders.length === 0 && (
              <div className="empty-state">
                <span className="empty-state-icon">✓</span>
                <strong>All clear in this view</strong>
                <p>No work orders match the selected locations and dates.</p>
              </div>
            )}
          </div>
          {dashboard.totalPages > 1 && (
            <nav className="pagination" aria-label="Work order pages">
              {dashboard.currentPage > 1 && (
                <Link href={pageHref(dashboard.currentPage - 1, siteFilter, from, to)}>
                  ← Previous
                </Link>
              )}
              <span>
                Page {dashboard.currentPage} of {dashboard.totalPages}
              </span>
              {dashboard.currentPage < dashboard.totalPages && (
                <Link href={pageHref(dashboard.currentPage + 1, siteFilter, from, to)}>Next →</Link>
              )}
            </nav>
          )}

          <section className="management-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">WORKSHOP SETUP</div>
                <h2>Keep the network current</h2>
              </div>
              <span className="section-note">{dashboard.staffCount} TEAM MEMBERS</span>
            </div>
            {canManageJobs ? (
              <div className="management-grid">
                <form className="management-card" action={createWorkOrder}>
                  <div className="management-card-heading">
                    <span className="management-icon">＋</span>
                    <div>
                      <h3>Open a work order</h3>
                      <p>Capture a new vehicle and repair need.</p>
                    </div>
                  </div>
                  {leader && (
                    <label>
                      Location
                      <select name="siteId" required defaultValue={defaultSiteId}>
                        {dashboard.sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {!leader && user.siteId && (
                    <input type="hidden" name="siteId" value={user.siteId} />
                  )}
                  <div className="form-row">
                    <label>
                      Registration
                      <input
                        name="vehicleRegistration"
                        required
                        minLength={2}
                        maxLength={20}
                        placeholder="AB12 CDE"
                      />
                    </label>
                    <label>
                      Vehicle
                      <input
                        name="vehicleDescription"
                        required
                        minLength={2}
                        maxLength={100}
                        placeholder="Make and model"
                      />
                    </label>
                  </div>
                  <label>
                    Issue summary
                    <textarea
                      name="issueSummary"
                      required
                      minLength={5}
                      maxLength={500}
                      placeholder="What needs diagnosing or repair?"
                      rows={2}
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Due date
                      <input type="date" name="dueDate" />
                    </label>
                    <label>
                      Initial status
                      <select name="status" defaultValue="new">
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button className="button button-primary" type="submit">
                    Create work order <span aria-hidden="true">→</span>
                  </button>
                </form>
                {leader && (
                  <>
                    <form className="management-card" action={createSite}>
                      <div className="management-card-heading">
                        <span className="management-icon">⌖</span>
                        <div>
                          <h3>Add a location</h3>
                          <p>Extend your network with another site.</p>
                        </div>
                      </div>
                      <label>
                        Location name
                        <input
                          name="name"
                          required
                          minLength={2}
                          maxLength={80}
                          placeholder="e.g. Westfield Workshop"
                        />
                      </label>
                      <label>
                        City
                        <input
                          name="city"
                          required
                          minLength={2}
                          maxLength={80}
                          placeholder="e.g. Sheffield"
                        />
                      </label>
                      <button className="button button-secondary" type="submit">
                        Add location
                      </button>
                    </form>
                    <form className="management-card" action={createBay}>
                      <div className="management-card-heading">
                        <span className="management-icon">▤</span>
                        <div>
                          <h3>Add workshop bays</h3>
                          <p>Set the usable bays at a location.</p>
                        </div>
                      </div>
                      <label>
                        Location
                        <select name="siteId" required defaultValue={defaultSiteId}>
                          {dashboard.sites.map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Bay name
                        <input name="name" required maxLength={40} placeholder="e.g. Bay 07" />
                      </label>
                      <button className="button button-secondary" type="submit">
                        Add bay
                      </button>
                    </form>
                    <form className="management-card" action={createStaffMember}>
                      <div className="management-card-heading">
                        <span className="management-icon">＋</span>
                        <div>
                          <h3>Add a team member</h3>
                          <p>Give a manager or technician site access.</p>
                        </div>
                      </div>
                      <label>
                        Full name
                        <input name="name" required minLength={2} maxLength={80} />
                      </label>
                      <label>
                        Work email
                        <input type="email" name="email" required />
                      </label>
                      <label>
                        Temporary password
                        <input
                          type="password"
                          name="password"
                          required
                          minLength={12}
                          autoComplete="new-password"
                        />
                        <small className="field-hint">
                          At least 12 characters. Share securely with the team member.
                        </small>
                      </label>
                      <div className="form-row">
                        <label>
                          Role
                          <select name="role">
                            <option value="staff">Workshop staff</option>
                            <option value="manager">Site manager</option>
                          </select>
                        </label>
                        <label>
                          Location
                          <select name="siteId" required defaultValue={defaultSiteId}>
                            {dashboard.sites.map((site) => (
                              <option key={site.id} value={site.id}>
                                {site.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button className="button button-secondary" type="submit">
                        Add team member
                      </button>
                    </form>
                  </>
                )}
              </div>
            ) : (
              <div className="manager-note">
                <strong>Site setup is managed by your operations leader.</strong>
                <span>
                  Keep job status, due dates and bay assignments up to date so the network view
                  stays useful.
                </span>
              </div>
            )}
            <PasswordSettings />
          </section>
          <footer className="page-footer">
            <span>PITLANE OPERATIONS</span>
            <span>
              Showing {dashboard.orders.length} of {dashboard.totalRows} work orders · Times use UTC
              for this workspace
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function pageHref(page: number, site?: string, from?: string, to?: string) {
  const query = new URLSearchParams({ page: String(page) });
  if (site && site !== 'all') query.set('site', site);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return `/?${query.toString()}`;
}
