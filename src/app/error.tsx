'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Operations view failed to render.', error.digest);
  }, [error.digest]);

  return (
    <main className="error-page">
      <span className="eyebrow">OPERATIONS VIEW</span>
      <h1>We couldn’t load this view.</h1>
      <p>
        Your saved workshop information is safe. Try again, or sign out and back in if the problem
        continues.
      </p>
      <button className="button button-primary" type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
