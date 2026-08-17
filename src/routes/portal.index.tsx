import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, CalendarClock, CheckCircle2, Circle, FileText, Megaphone } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { usePortalAuth } from "@/lib/auth/context";
import { api } from "@/lib/api/client";
import type { Subscription } from "@/lib/api/types";
import { currency } from "@/lib/portal/visibility";
import { buildSchedule, daysUntil } from "@/lib/portal/schedule";
import {
  resolveProjectRef,
  phaseList,
  phaseIndex,
  type ProjectRefInfo,
} from "@/lib/portal/project-ref";
import { PortalOverviewSkeleton } from "@/components/portal/PortalSkeletons";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Overview — Motiva Subscriber Portal" },
      {
        name: "description",
        content: "Your Motiva subscriptions, balances and recent project updates in one place.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PortalHome,
});

function PortalHome() {
  const { user } = usePortalAuth();
  const clientId = user?.clientId;

  const { data: subs, isLoading } = useQuery({
    queryKey: ["portal", "subscriptions", clientId],
    queryFn: () => api.portal.listSubscriptions(),
    enabled: !!clientId,
  });

  const nextDue = subs
    ?.filter((s) => s.nextDueDate && (s.amountPaid ?? 0) < (s.totalPrice ?? s.amount ?? 0))
    .map((s) => ({ sub: s, days: daysUntil(s.nextDueDate) ?? 9999 }))
    .sort((a, b) => a.days - b.days)[0];

  if (isLoading) return <PortalOverviewSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-foreground">
          Welcome back, {user?.fullName.split(" ")[0]}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each subscription is shown separately — balances and progress are never merged across
          purchases.
        </p>
      </div>

      {nextDue && (
        <Card className="border-[#D7C49E]/60 bg-[#D7C49E]/10">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 text-[#8a6f2f]" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  Next installment{" "}
                  {nextDue.days >= 0
                    ? `due in ${nextDue.days} day${nextDue.days === 1 ? "" : "s"}`
                    : `${Math.abs(nextDue.days)} day${Math.abs(nextDue.days) === 1 ? "" : "s"} overdue`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {nextDue.sub.plan} · {format(new Date(nextDue.sub.nextDueDate!), "PPP")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled title="Live payments come in Phase 2">
                Generate payment reference
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/portal/subscriptions/$id"
                  params={{ id: nextDue.sub._id ?? nextDue.sub.id ?? "" }}
                >
                  Details
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(!subs || subs.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No subscriptions yet. Once your first payment is confirmed, your subscription will
            appear here.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {subs?.map((sub) => (
          <SubscriptionCard key={sub.id} sub={sub} />
        ))}
      </div>
    </div>
  );
}

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const total = sub.totalPrice ?? sub.amount ?? 0;
  const paid = sub.amountPaid ?? 0;
  const balance = Math.max(total - paid, 0);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const fullyPaid = total > 0 && paid >= total;
  const schedule = buildSchedule(sub);
  const nextRow = schedule.find((r) => r.status === "next");

  const { data: info } = useQuery({
    queryKey: ["portal", "projectRef", sub.projectRef, sub.projectRefType],
    queryFn: () => resolveProjectRef(sub.projectRef, sub.projectRefType),
    enabled: !!sub.projectRef,
  });
  const { data: updates } = useQuery({
    queryKey: ["portal", "updatesForProject", sub.projectRef],
    queryFn: () => api.projectUpdates.listForProject(sub.projectRef!),
    enabled: !!sub.projectRef,
  });

  return (
    <Card className="overflow-hidden">
      <div className="relative h-40 w-full bg-muted">
        {info?.coverImageUrl && (
          <img src={info.coverImageUrl} alt={info.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
          <div>
            <div className="text-[10px] uppercase tracking-wide opacity-80">
              {sub.projectRefType === "land" ? "Land parcel" : "Residence"} ·{" "}
              {sub.paymentPlan ?? "Custom plan"}
            </div>
            <div className="font-display text-lg leading-tight">{info?.name ?? sub.plan}</div>
            {info?.location && <div className="text-xs opacity-85">{info.location}</div>}
          </div>
          <Badge className="bg-white/90 text-foreground hover:bg-white">
            {fullyPaid ? "Fully paid" : (info?.phaseLabel ?? sub.status)}
          </Badge>
        </div>
      </div>
      <CardContent className="space-y-5 py-5">
        {/* Phase strip */}
        <PhaseStrip current={info?.projectStatus ?? "ongoing"} />

        {/* Payment summary */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="font-medium">{currency(total, sub.currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Paid</div>
            <div className="font-medium">{currency(paid, sub.currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="font-medium">{currency(balance, sub.currency)}</div>
          </div>
        </div>
        <div>
          <Progress value={pct} />
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{pct}% paid</span>
            {nextRow && !fullyPaid && (
              <span>
                Next: {currency(nextRow.amount, sub.currency)} ·{" "}
                {format(new Date(nextRow.dueDate), "PP")}
              </span>
            )}
          </div>
        </div>

        {/* Installment preview (first 4 rows) */}
        <div className="rounded-md border border-border">
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Payment plan
          </div>
          <ul className="divide-y divide-border">
            {schedule.slice(0, 4).map((r) => (
              <li
                key={r.index}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  {r.status === "paid" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : r.status === "next" ? (
                    <CalendarClock className="h-4 w-4 text-[#8a6f2f]" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      r.status === "paid" ? "text-muted-foreground line-through" : "text-foreground"
                    }
                  >
                    Installment {r.index}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(r.dueDate), "PP")} · {currency(r.amount, sub.currency)}
                </span>
              </li>
            ))}
          </ul>
          {schedule.length > 4 && (
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              +{schedule.length - 4} more installment{schedule.length - 4 === 1 ? "" : "s"}
            </div>
          )}
        </div>

        {/* Inline updates preview */}
        {updates && updates.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Recent updates
              </div>
              <Link
                to="/portal/updates"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                See all
              </Link>
            </div>
            <ul className="space-y-2">
              {updates.slice(0, 2).map((u) => (
                <li key={u.id} className="flex gap-2 text-sm">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1">
                    <p className="line-clamp-2 text-foreground">{u.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(u.postedAt), "PP")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button asChild size="sm">
            <Link to="/portal/subscriptions/$id" params={{ id: sub._id ?? sub.id ?? "" }}>
              View subscription <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/portal/documents">
              <FileText className="mr-1 h-4 w-4" /> Documents
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseStrip({ current }: { current: ProjectRefInfo["projectStatus"] }) {
  const phases = phaseList();
  const idx = phaseIndex(current);
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Project status
      </div>
      <div className="flex items-center gap-1.5">
        {phases.map((p, i) => {
          const active = i <= idx;
          return (
            <div key={p} className="flex flex-1 flex-col items-start gap-1">
              <div
                className={`h-1.5 w-full rounded-full ${active ? "bg-[#D7C49E]" : "bg-muted"}`}
              />
              <div
                className={`text-[10px] uppercase tracking-wide ${i === idx ? "text-foreground font-medium" : "text-muted-foreground"}`}
              >
                {p === "pre-sale" ? "Pre-sale" : p === "ongoing" ? "Ongoing" : "Delivered"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
