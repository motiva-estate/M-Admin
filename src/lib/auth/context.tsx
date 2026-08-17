/**
 * Dual auth contexts — admin staff and subscriber portal are completely
 * isolated. Each context has its own in-memory access token, its own
 * refresh endpoint, and its own login redirect. Opening both in separate
 * browser tabs causes zero interference.
 *
 *   Admin staff   → cookie: motiva_rt        path: /api/auth
 *                   refresh: POST /api/auth/refresh
 *                   logout:  POST /api/auth/logout
 *                   redirect on 401: /admin/login
 *
 *   Subscribers   → cookie: motiva_portal_rt  path: /api/auth/portal
 *                   refresh: POST /api/auth/portal/refresh
 *                   logout:  POST /api/auth/portal/logout
 *                   redirect on 401: /portal/login
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Role, User } from "../api/types";
import { setAdminToken, setPortalToken } from "../api/client";

const BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:4000/api";

// ── Capabilities (unchanged) ────────────────────────────────────────────────

export type Action =
  | "content.create"
  | "content.edit"
  | "content.publish"
  | "content.archive"
  | "seo.manage"
  | "contact.manage"
  | "homepage.manage"
  | "clients.manage"
  | "subscriptions.manage"
  | "enquiries.assign"
  | "users.manage"
  | "audit.view"
  | "settings.manage";

const CAPABILITIES: Record<Role, Action[]> = {
  SUPER_ADMIN: [
    "content.create",
    "content.edit",
    "content.publish",
    "content.archive",
    "seo.manage",
    "contact.manage",
    "homepage.manage",
    "clients.manage",
    "subscriptions.manage",
    "enquiries.assign",
    "users.manage",
    "audit.view",
    "settings.manage",
  ],
  ADMINISTRATOR: [
    "content.create",
    "content.edit",
    "content.publish",
    "content.archive",
    "seo.manage",
    "contact.manage",
    "homepage.manage",
    "clients.manage",
    "subscriptions.manage",
    "enquiries.assign",
    "audit.view",
  ],
  CONTENT_EDITOR: ["content.create", "content.edit", "clients.manage", "enquiries.assign"],
  VIEWER: [],
  SUBSCRIBER: [],
};

// ── Shared auth state shape ──────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  can: (action: Action) => boolean;
  /** The in-memory access token for this context (read by api/client.ts). */
  getToken: () => string | null;
  /** Replace the in-memory token (called by api/client.ts after a silent refresh). */
  setToken: (t: string | null) => void;
  /** URL to call for a silent token refresh (used by api/client.ts on 401). */
  refreshUrl: string;
  /** URL to redirect to when a silent refresh fails. */
  loginPath: string;
}

// ── Factory ──────────────────────────────────────────────────────────────────

interface ContextConfig {
  loginUrl: string;
  refreshUrl: string;
  logoutUrl: string;
  loginPath: string;
  localStorageKey: string;
  syncToken: (t: string | null) => void;
}

function makeAuthContext(config: ContextConfig) {
  const Ctx = createContext<AuthState | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [ready, setReady] = useState(false);
    // Each provider instance has its OWN token in a ref — no module-level sharing.
    const tokenRef = useRef<string | null>(null);

    const getToken = useCallback(() => tokenRef.current, []);
    const setToken = useCallback((t: string | null) => {
      tokenRef.current = t;
      config.syncToken(t);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // On mount — restore session via this context's dedicated refresh cookie.
    useEffect(() => {
      (async () => {
        try {
          const res = await fetch(`${BASE}${config.refreshUrl}`, {
            method: "POST",
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            tokenRef.current = data.accessToken;
            config.syncToken(data.accessToken);
            const me = await fetch(`${BASE}/auth/me`, {
              headers: { Authorization: `Bearer ${data.accessToken}` },
              credentials: "include",
            });
            if (me.ok) {
              const u = normalise(await me.json());
              setUser(u);
              localStorage.setItem(config.localStorageKey, u.email);
            }
          }
        } catch {
          /* no session — that's fine */
        } finally {
          setReady(true);
        }
      })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = useCallback(async (email: string, password: string): Promise<User> => {
      const res = await fetch(`${BASE}${config.loginUrl}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Sign in failed" }));
        throw new Error(err.message ?? "Sign in failed");
      }
      const data = await res.json();
      tokenRef.current = data.accessToken;
      config.syncToken(data.accessToken);
      const u = normalise(data.user);
      setUser(u);
      localStorage.setItem(config.localStorageKey, u.email);
      return u;
    }, []);

    const logout = useCallback(async () => {
      try {
        await fetch(`${BASE}${config.logoutUrl}`, {
          method: "POST",
          credentials: "include",
          headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        });
      } catch {
        /* ignore */
      }
      tokenRef.current = null;
      config.syncToken(null);
      setUser(null);
      localStorage.removeItem(config.localStorageKey);
    }, []);

    const hasRole = useCallback((role: Role) => user?.role === role, [user]);
    const hasAnyRole = useCallback(
      (roles: Role[]) => (user ? roles.includes(user.role) : false),
      [user],
    );
    const can = useCallback(
      (action: Action) => (user ? (CAPABILITIES[user.role] ?? []).includes(action) : false),
      [user],
    );

    return (
      <Ctx.Provider
        value={{
          user,
          ready,
          login,
          logout,
          hasRole,
          hasAnyRole,
          can,
          getToken,
          setToken,
          refreshUrl: config.refreshUrl,
          loginPath: config.loginPath,
        }}
      >
        {children}
      </Ctx.Provider>
    );
  }

  function useAuthContext() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error(`useAuth must be used inside the matching AuthProvider`);
    return ctx;
  }

  return { Provider, useAuthContext, Ctx };
}

// ── Instantiate both contexts ────────────────────────────────────────────────

const adminAuth = makeAuthContext({
  loginUrl: "/auth/login",
  refreshUrl: "/auth/refresh",
  logoutUrl: "/auth/logout",
  loginPath: "/admin/login",
  localStorageKey: "motiva.admin.email",
  syncToken: setAdminToken,
});

const portalAuth = makeAuthContext({
  loginUrl: "/auth/portal/login",
  refreshUrl: "/auth/portal/refresh",
  logoutUrl: "/auth/portal/logout",
  loginPath: "/portal/login",
  localStorageKey: "motiva.portal.email",
  syncToken: setPortalToken,
});

// ── Public API ───────────────────────────────────────────────────────────────

/** Wrap the admin subtree with this. */
export const AdminAuthProvider = adminAuth.Provider;

/** Wrap the portal subtree with this. */
export const PortalAuthProvider = portalAuth.Provider;

/** Use inside admin routes only. */
export function useAdminAuth(): AuthState {
  const ctx = useContext(adminAuth.Ctx);
  if (!ctx) throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  return ctx;
}

/** Use inside portal routes only. */
export function usePortalAuth(): AuthState {
  const ctx = useContext(portalAuth.Ctx);
  if (!ctx) throw new Error("usePortalAuth must be used inside <PortalAuthProvider>");
  return ctx;
}

/**
 * useAuth() — generic hook for components shared between admin and portal
 * (e.g. CollectionAdmin, status badges). It reads from whichever provider is
 * NEAREST in the React tree.
 *
 * Because both providers are mounted in __root.tsx this hook always resolves
 * to the admin context when called outside a portal-specific subtree, so
 * portal shells should use usePortalAuth() and admin shells useAdminAuth().
 */
export function useAuth(): AuthState {
  const admin = useContext(adminAuth.Ctx);
  const portal = useContext(portalAuth.Ctx);
  const ctx = admin ?? portal;
  if (!ctx)
    throw new Error("useAuth must be used inside <AdminAuthProvider> or <PortalAuthProvider>");
  return ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalise(u: any): User {
  return { ...u, id: u.id ?? u._id };
}

/**
 * Sanity writes.functions.ts reads the actor email from localStorage.
 * It checks the admin key first, then portal key.
 */
export function getActorEmail(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("motiva.admin.email") ?? localStorage.getItem("motiva.portal.email") ?? ""
  );
}

// Legacy compat — api/client.ts imported setAccessToken from this module indirectly.
// Now each context owns its token, but we export a no-op to avoid import errors.
export function setAccessToken(_t: string | null) {
  /* managed per-context now */
}
export function getAccessToken(): string | null {
  return null;
} // not used externally
