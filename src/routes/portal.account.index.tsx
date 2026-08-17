import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePortalAuth } from "@/lib/auth/context";
import { api } from "@/lib/api/client";
import { useDirty } from "@/lib/use-dirty";
import { pageProps, stagger, staggerItem, slideUp } from "@/lib/motion";
import { PortalAccountSkeleton } from "@/components/portal/PortalSkeletons";

const BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:4000/api";

export const Route = createFileRoute("/portal/account/")({
  head: () => ({
    meta: [
      { title: "Account — Motiva Subscriber Portal" },
      {
        name: "description",
        content: "Confirm the contact details Motiva uses for reminders and updates.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PortalAccount,
});

function PortalAccount() {
  const { user, getToken } = usePortalAuth();
  const qc = useQueryClient();
  const clientId = user?.clientId;

  const { data: client, isLoading } = useQuery({
    queryKey: ["portal", "client", clientId],
    queryFn: () => api.portal.getProfile(),
    enabled: !!clientId,
  });

  // ── Contact details state ─────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailNotif, setEmailNotif] = useState(true);
  const [whatsappNotif, setWhatsappNotif] = useState(true);

  useEffect(() => {
    if (client) {
      setEmail(client.email ?? "");
      setPhone(client.phone ?? "");
      setEmailNotif(client.notificationPrefs?.email ?? true);
      setWhatsappNotif(client.notificationPrefs?.whatsapp ?? true);
    }
  }, [client]);

  const serverSnapshot = client
    ? {
        email: client.email ?? "",
        phone: client.phone ?? "",
        emailNotif: client.notificationPrefs?.email ?? true,
        whatsappNotif: client.notificationPrefs?.whatsapp ?? true,
      }
    : null;

  const dirtyState = { email, phone, emailNotif, whatsappNotif };
  const { isDirty: contactDirty, markClean: markContactClean } = useDirty(
    dirtyState,
    serverSnapshot,
  );

  const save = useMutation({
    mutationFn: () =>
      api.portal.updateProfile({
        email,
        phone,
        contactConfirmedAt: new Date().toISOString(),
        notificationPrefs: { email: emailNotif, whatsapp: whatsappNotif },
      }),
    onSuccess: () => {
      markContactClean();
      qc.invalidateQueries({ queryKey: ["portal", "client", clientId] });
      toast.success("Contact details updated");
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  // ── Password change state ─────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("New passwords do not match");
      if (newPassword.length < 8) throw new Error("New password must be at least 8 characters");

      const token = getToken();
      const res = await fetch(`${BASE}/auth/password`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Password change failed" }));
        throw new Error(err.message ?? "Password change failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PortalAccountSkeleton />;

  const needsConfirm = client && !client.contactConfirmedAt;

  return (
    <motion.div className="max-w-2xl space-y-6" {...pageProps}>
      <motion.div variants={slideUp}>
        <h1 className="font-display text-3xl text-foreground">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your contact details, notification preferences and password.
        </p>
      </motion.div>

      {needsConfirm && (
        <motion.div variants={slideUp}>
          <Card className="border-[#D7C49E]/60 bg-[#D7C49E]/10">
            <CardContent className="flex items-start gap-3 py-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[#8a6f2f]" />
              <div className="text-sm">
                <div className="font-medium text-foreground">Confirm your contact details</div>
                <div className="text-xs text-muted-foreground">
                  Review the email and phone below and press{" "}
                  <span className="font-medium">Save changes</span> so we can reach you.
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div className="space-y-6" variants={stagger}>
        {/* Contact details */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={client?.fullName ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone / WhatsApp</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 …"
                />
              </div>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !contactDirty}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
              {client?.contactConfirmedAt && (
                <p className="flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed on{" "}
                  {new Date(client.contactConfirmedAt).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Notification preferences */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle>Reminder preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Email reminders</div>
                  <div className="text-xs text-muted-foreground">
                    Installment due-date notices to your email.
                  </div>
                </div>
                <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">WhatsApp reminders</div>
                  <div className="text-xs text-muted-foreground">
                    Short message to your registered WhatsApp number.
                  </div>
                </div>
                <Switch checked={whatsappNotif} onCheckedChange={setWhatsappNotif} />
              </div>
              <p className="text-xs text-muted-foreground">
                Automated reminders activate in Phase 2 — preferences saved now apply automatically.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Password change */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showCurrent ? "Hide" : "Show"}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showNew ? "Hide" : "Show"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && newPassword.length < 8 && (
                  <p className="text-xs text-destructive">Must be at least 8 characters</p>
                )}
              </div>

              {/* Confirm new password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Hide" : "Show"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>

              <Button
                onClick={() => changePassword.mutate()}
                disabled={
                  changePassword.isPending ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword ||
                  newPassword.length < 8
                }
              >
                {changePassword.isPending ? "Changing…" : "Change password"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
