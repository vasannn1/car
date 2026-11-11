import { changeOwnPassword } from '@/app/security-actions';
import { SubmitButton } from './submit-button';

export function PasswordSettings() {
  return (
    <div className="management-grid password-settings">
      <form className="management-card" action={changeOwnPassword}>
        <div className="management-card-heading">
          <span className="management-icon">⌑</span>
          <div>
            <h3>Password &amp; security</h3>
            <p>Change your sign-in password and refresh your active session.</p>
          </div>
        </div>
        <label>
          Current password
          <input type="password" name="currentPassword" required autoComplete="current-password" />
        </label>
        <div className="form-row">
          <label>
            New password
            <input
              type="password"
              name="newPassword"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        </div>
        <SubmitButton className="button button-secondary" pendingLabel="Updating password…">
          Update password
        </SubmitButton>
      </form>
    </div>
  );
}
