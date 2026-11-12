'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}

export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
