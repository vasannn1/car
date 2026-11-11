import Link from 'next/link';
import { redirect } from 'next/navigation';
import { setupOrganization } from '@/app/actions';
import { SubmitButton } from '@/components/submit-button';
import { hasWorkspaceUsers } from '@/lib/garage';

type SetupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Setup({ searchParams }: SetupPageProps) {
  if (await hasWorkspaceUsers()) redirect('/login');
  const params = await searchParams;
  const invalid = params.error === 'invalid';

  return (
    <main className="auth-page setup-page">
      <div className="auth-aside">
        <Link className="brand-lockup brand-lockup-light" href="/">
          <span className="brand-mark">P</span>
          <span>
            <strong>PITLANE</strong>
            <small>WORKSHOP OPERATIONS</small>
          </span>
        </Link>
        <div className="auth-aside-copy">
          <span className="eyebrow">A BETTER VIEW OF THE WORK</span>
          <h1>Set up your garage network.</h1>
          <p>
            Create the first leader account. You’ll be able to add locations, workshop bays and team
            members next.
          </p>
        </div>
        <div className="auth-aside-footer">
          <span className="live-indicator" /> One shared view. Every location.
        </div>
      </div>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="eyebrow">FIRST-TIME SETUP</div>
          <h2>Create your workspace</h2>
          <p className="auth-intro">Set up your company and the first operations leader.</p>
          {invalid && (
            <div className="feedback feedback-error" role="alert">
              Setup could not be completed. Check the setup key and details, or sign in if setup has
              already finished.
            </div>
          )}
          {!process.env.SETUP_TOKEN && (
            <div className="feedback feedback-error" role="alert">
              Setup is locked until a private setup key is configured in the server environment.
            </div>
          )}
          <form className="auth-form" action={setupOrganization}>
            <label>
              Garage company
              <input
                name="organization"
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. Northstar Garage Group"
              />
            </label>
            <label>
              Your name
              <input name="name" required minLength={2} maxLength={80} autoComplete="name" />
            </label>
            <label>
              Work email
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <label>
              Create password
              <input
                type="password"
                name="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
              <small className="field-hint">Use at least 12 characters.</small>
            </label>
            <label>
              Private setup key
              <input type="password" name="setupToken" required autoComplete="off" />
            </label>
            <SubmitButton
              className="button button-primary auth-submit"
              pendingLabel="Creating workspace…"
              disabled={!process.env.SETUP_TOKEN}
            >
              Create workspace <span aria-hidden="true">→</span>
            </SubmitButton>
          </form>
          <p className="auth-help">
            The setup key is configured by your system administrator and is never stored in the app.
          </p>
        </div>
      </section>
    </main>
  );
}
