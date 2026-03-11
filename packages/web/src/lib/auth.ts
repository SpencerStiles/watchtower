import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GithubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './db';
import { env } from './env';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({ clientId: env.GITHUB_ID, clientSecret: env.GITHUB_SECRET }),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      const existing = await prisma.user.findUnique({ where: { id: user.id } });
      if (!existing?.organizationId && existing?.role === 'DEVELOPER') {
        const org = await prisma.organization.create({
          data: { name: `${user.name || user.email}'s Org` },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { organizationId: org.id },
        });
      }
      return true;
    },
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, organizationId: true },
      });
      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.role = dbUser.role;
        session.user.organizationId = dbUser.organizationId;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
};
