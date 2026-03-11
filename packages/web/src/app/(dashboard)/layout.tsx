import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { SignOutButton } from './sign-out-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const isDeveloper = session.user.role === 'DEVELOPER';

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className="flex w-56 flex-col border-r"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Logo */}
        <div
          className="flex h-14 items-center px-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <Link
            href={isDeveloper ? '/agents' : '/overview'}
            className="text-lg font-bold font-[family-name:var(--font-syne)]"
            style={{ color: 'var(--text)' }}
          >
            WatchTower
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {isDeveloper ? (
            <>
              <p
                className="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                Developer
              </p>
              <Link
                href="/agents"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-[#1e1e24]"
                style={{ color: 'var(--text)' }}
              >
                <span style={{ color: 'var(--accent)' }}>▸</span>
                Agents
              </Link>
            </>
          ) : (
            <>
              <p
                className="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                Business
              </p>
              <Link
                href="/overview"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-[#1e1e24]"
                style={{ color: 'var(--text)' }}
              >
                <span style={{ color: 'var(--accent)' }}>▸</span>
                Overview
              </Link>
            </>
          )}
        </nav>

        {/* User info + sign out */}
        <div
          className="border-t p-3 space-y-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="px-3 py-1">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
              {session.user.name ?? session.user.email}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
              {session.user.role === 'DEVELOPER' ? 'Developer' : 'Business Owner'}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
