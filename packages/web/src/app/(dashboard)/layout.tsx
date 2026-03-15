import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { SignOutButton } from './sign-out-button';
import { NavLink } from '@/components/nav-link';
import { MobileSidebar } from './mobile-sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const isDeveloper = session.user.role === 'DEVELOPER';

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-surface">
        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-border">
          <Link
            href={isDeveloper ? '/agents' : '/overview'}
            className="text-lg font-bold font-display text-text"
          >
            WatchTower
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {isDeveloper ? (
            <>
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Developer
              </p>
              <NavLink href="/agents">Agents</NavLink>
            </>
          ) : (
            <>
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Business
              </p>
              <NavLink href="/overview">Overview</NavLink>
            </>
          )}
        </nav>

        {/* User info + sign out */}
        <div className="border-t border-border p-3 space-y-2">
          <div className="px-3 py-1">
            <p className="text-sm font-medium truncate text-text">
              {session.user.name ?? session.user.email}
            </p>
            <p className="text-xs truncate text-muted">
              {session.user.role === 'DEVELOPER' ? 'Developer' : 'Business Owner'}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile Header */}
      <MobileSidebar isDeveloper={isDeveloper} userName={session.user.name ?? session.user.email ?? ''} />

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
