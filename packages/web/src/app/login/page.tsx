'use client';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-[#2d2d35] bg-[#111114] p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-syne)]">WatchTower</h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">Sign in to monitor your AI agents</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => signIn('github', { callbackUrl: '/agents' })}
            className="w-full rounded-md bg-[#1e1e24] px-4 py-2.5 text-sm font-medium text-[#fafafa] hover:bg-[#2d2d35] transition-colors border border-[#2d2d35]"
          >
            Continue with GitHub
          </button>
          <button
            onClick={() => signIn('google', { callbackUrl: '/agents' })}
            className="w-full rounded-md bg-[#1e1e24] px-4 py-2.5 text-sm font-medium text-[#fafafa] hover:bg-[#2d2d35] transition-colors border border-[#2d2d35]"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </main>
  );
}
