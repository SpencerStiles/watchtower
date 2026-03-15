'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { NavLink } from '@/components/nav-link';
import { SignOutButton } from './sign-out-button';

interface MobileSidebarProps {
  isDeveloper: boolean;
  userName: string;
}

export function MobileSidebar({ isDeveloper, userName }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <Link href={isDeveloper ? '/agents' : '/overview'} className="text-lg font-bold font-display text-text">
          WatchTower
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-muted hover:bg-elevated hover:text-text transition-colors active:scale-95"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out nav */}
      <div
        className={`fixed top-14 left-0 bottom-0 z-50 w-56 bg-surface border-r border-border transform transition-transform duration-200 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex-1 space-y-1 p-3" onClick={() => setOpen(false)}>
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
        <div className="border-t border-border p-3 space-y-2">
          <div className="px-3 py-1">
            <p className="text-sm font-medium truncate text-text">{userName}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
