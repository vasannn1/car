import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signIn } from '@/app/actions';
import { SubmitButton } from '@/components/submit-button';
import { getCurrentUser } from '@/lib/session';

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Login({ searchParams }: LoginPageProps) {
  if (await getCurrentUser()) redirect('/');
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : '';

  return (
    <main className="auth-page">
      <div className="auth-aside">
        <Link className="brand-lockup brand-lockup-light" href="/">
          <span className="brand-mark">P</span>
          <span>
            <strong>PITLANE</strong>
            <small>WORKSHOP OPERATIONS</small>
          </span>
        </Link>
        <div className="auth-aside-copy">
          <span className="eyebrow">EVERY SITE. ONE CLEAR VIEW.</span>
          <h1>Keep the whole workshop moving.</h1>
          <p>
            Know where work is waiting, where capacity is open and what needs your attention next.
          </p>
        </div>
        <div className="auth-aside-footer">
          <span className="live-indicator" /> Connected operations, built for the workshop floor.
        </div>
      </div>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="eyebrow">WELCOME BACK</div>
          <h2>Sign in to Pitlane</h2>
          <p className="auth-intro">Use your work account to open your operations view.</p>
          {error && (
            <div className="feedback feedback-error" role="alert">
              {error === 'locked'
                ? 'Too many attempts. Try again in 15 minutes.'
                : 'Email or password is incorrect.'}
            </div>
          )}
          <form className="auth-form" action={signIn}>
            <label>
              Work email
              <input type="email" name="email" required autoComplete="username" autoFocus />
            </label>
            <label>
              Password
              <input type="password" name="password" required autoComplete="current-password" />
            </label>
            <SubmitButton className="button button-primary auth-submit" pendingLabel="Signing in…">
              Sign in <span aria-hidden="true">→</span>
            </SubmitButton>
          </form>
          <p className="auth-help">
            First time here? Your operations leader can create your account.
          </p>
        </div>
      </section>
    </main>
  );
}
