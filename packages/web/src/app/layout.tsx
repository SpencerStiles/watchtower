import type { Metadata } from 'next';
import { Syne, DM_Mono } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import './globals.css';

const syne = Syne({ subsets: ['latin'], variable: '--font-syne' });
const dmMono = DM_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'WatchTower — AI Agent Monitoring',
  description: 'Know what your AI agents are saying, doing, and costing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
