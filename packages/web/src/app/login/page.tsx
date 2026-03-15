'use client';
import { signIn } from 'next-auth/react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold font-display">WatchTower</h1>
          <p className="mt-2 text-sm text-muted">Sign in to monitor your AI agents</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => signIn('github', { callbackUrl: '/agents' })}
            className="w-full rounded-md bg-elevated border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-[var(--border)] transition-all active:scale-[0.97]"
          >
            Continue with GitHub
          </button>
          <button
            onClick={() => signIn('google', { callbackUrl: '/agents' })}
            className="w-full rounded-md bg-elevated border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-[var(--border)] transition-all active:scale-[0.97]"
          >
            Continue with Google
          </button>
        </div>
      </motion.div>
    </main>
  );
}
