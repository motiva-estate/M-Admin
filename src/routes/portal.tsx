import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { LogOut, LayoutDashboard, FileText, Megaphone, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePortalAuth } from "@/lib/auth/context";
import { api } from "@/lib/api/client";
import { daysUntil } from "@/lib/portal/schedule";
import { pageProps } from "@/lib/motion";
import { PortalShellSkeleton } from "@/components/portal/PortalSkeletons";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  const { user, ready, logout } = usePortalAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isLogin = pathname === "/portal/login";

  useEffect(() => {
    if (!ready || isLogin) return;
    if (!user) {
      navigate({ to: "/portal/login", search: { redirect: pathname }, replace: true });
      return;
    }
    if (user.role !== "SUBSCRIBER") {
      // Staff accounts belong in /admin, not the subscriber portal.
      navigate({ to: "/admin", replace: true });
    }
  }, [ready, user, navigate, pathname, isLogin]);

  if (isLogin) return <Outlet />;

  if (!ready || !user || user.role !== "SUBSCRIBER") {
    return <PortalShellSkeleton />;
  }

  const nav = [
    { to: "/portal", label: "Overview", icon: LayoutDashboard },
    { to: "/portal/documents", label: "Documents", icon: FileText },
    { to: "/portal/updates", label: "Updates", icon: Megaphone },
    { to: "/portal/account", label: "Account", icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PortalShell user={user} logout={logout} pathname={pathname} nav={nav}>
        <Outlet />
      </PortalShell>
    </div>
  );
}

function PortalShell({
  user,
  logout,
  pathname,
  nav,
  children,
}: {
  user: { fullName: string; email: string; clientId?: string };
  logout: () => void;
  pathname: string;
  nav: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  children: React.ReactNode;
}) {
  const clientId = user.clientId;
  const { data: subs } = useQuery({
    queryKey: ["portal", "subscriptions", clientId],
    queryFn: () => api.portal.listSubscriptions(),
    enabled: !!clientId,
  });
  const { data: updates } = useQuery({
    queryKey: ["portal", "updates", clientId],
    queryFn: () => api.projectUpdates.listForClient(clientId!),
    enabled: !!clientId,
  });

  const activeCount =
    subs?.filter((s) => (s.amountPaid ?? 0) < (s.totalPrice ?? s.amount ?? 0)).length ?? 0;
  const nextDue = subs
    ?.filter((s) => s.nextDueDate)
    .map((s) => ({ id: s.id, days: daysUntil(s.nextDueDate) ?? 9999 }))
    .sort((a, b) => a.days - b.days)[0];
  const updateCount = updates?.length ?? 0;

  return (
    <>
      <header className="relative border-b border-border bg-gradient-to-br from-[#343149] via-[#3f3b58] to-[#2b2839] text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <Link to="/portal" className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md font-display text-lg">
                <img src="/apple-touch-icon.png" alt="Motiva Estate logo" className="rounded-md" />
              </div>
              <div className="leading-tight">
                <div className="font-display text-xl">Motiva</div>
                <div className="text-xs opacity-75">Subscriber portal</div>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-none">{user.fullName}</div>
                <div className="text-xs opacity-75">{user.email}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="border-white/25 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              >
                <LogOut className="mr-1 h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
            <StatChip
              label="Active subscriptions"
              value={String(subs?.length ?? 0)}
              sub={activeCount ? `${activeCount} paying` : "All settled"}
            />
            <StatChip
              label="Next payment"
              value={nextDue && nextDue.days >= 0 ? `${nextDue.days}d` : nextDue ? "Overdue" : "—"}
              sub={nextDue ? "until due" : "nothing scheduled"}
            />
            <StatChip
              label="Project updates"
              value={String(updateCount)}
              sub={updateCount ? "posted for you" : "none yet"}
            />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {nav.map((n) => {
            const active = n.to === "/portal" ? pathname === "/portal" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-[#D7C49E] text-primary-foreground"
                    : "border-transparent text-primary-foreground/70 hover:text-primary-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* <AnimatePresence mode="wait"> */}
          <motion.div key={pathname} {...pageProps}>
            {children}
          </motion.div>
        {/* </AnimatePresence> */}
      </main>
    </>
  );
}

function StatChip({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
      <div className="text-[10px] uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-0.5 font-display text-lg leading-tight">{value}</div>
      <div className="text-[11px] opacity-70">{sub}</div>
    </div>
  );
}
