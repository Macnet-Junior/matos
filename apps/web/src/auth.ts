import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeMatosPassword } from "@/lib/auth-credentials";
import { resolveRole } from "@/lib/rbac";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !authorizeMatosPassword(password)) {
          return null;
        }
        const name =
          email === "macnet@matos.local" ? "Macnet Junior" : email.split("@")[0];
        const role = await resolveRole(email);
        return {
          id: email,
          email,
          name,
          role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role ?? "Viewer";
      } else if (typeof token.email === "string" && !token.role) {
        token.role = await resolveRole(token.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = (token.role as string) ?? "Viewer";
      }
      return session;
    },
  },
});
