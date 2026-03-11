'use client';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full rounded-md px-3 py-2 text-sm font-medium text-left transition-colors hover:bg-[#1e1e24]"
      style={{ color: 'var(--muted)' }}
    >
      Sign out
    </button>
  );
}
