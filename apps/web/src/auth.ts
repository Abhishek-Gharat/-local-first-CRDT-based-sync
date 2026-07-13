import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { verifyPassword } from "./lib/auth/password";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

interface AuthLookupRow {
  [key: string]: unknown;
  id: string;
  password_hash: string;
  name: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (rawCredentials) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Runs before any session/user context exists, so this can't go
        // through withUserContext — auth_lookup_user is a SECURITY DEFINER
        // function (see migrations/0002_auth_lookup.sql) that exists
        // specifically to answer this one pre-authorization question
        // without opening a general RLS bypass.
        const rows = await db.execute<AuthLookupRow>(
          sql`select * from auth_lookup_user(${email})`,
        );
        const row = rows[0];
        if (!row) return null;

        const valid = await verifyPassword(password, row.password_hash);
        if (!valid) return null;

        return { id: row.id, email, name: row.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
