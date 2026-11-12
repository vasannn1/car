'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/lib/password';
import { createSession, requireUser } from '@/lib/session';

export async function changeOwnPassword(formData: FormData) {
  const user = await requireUser();
  const input = z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(12).max(128),
      confirmPassword: z.string().min(12).max(128),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!input.success || input.data.newPassword !== input.data.confirmPassword) {
    redirect('/?error=password');
  }
  if (!(await verifyPassword(input.data.currentPassword, user.passwordHash))) {
    redirect('/?error=password');
  }

  const passwordHash = await hashPassword(input.data.newPassword);
  db.transaction((tx) => {
    tx.update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();
    tx.delete(sessions).where(eq(sessions.userId, user.id)).run();
  });
  await createSession(user.id);
  revalidatePath('/');
  redirect('/?notice=password-updated');
}
