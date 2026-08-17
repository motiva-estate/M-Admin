import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/lib/auth/context";
import { Eye, EyeOff } from "lucide-react";
import { scalePop } from "@/lib/motion";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/admin/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, ready, login, logout } = useAdminAuth();
  const search = useSearch({ from: "/admin/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) {
      if (user.role === "SUBSCRIBER") return; // never redirect subscribers into admin
      navigate({ to: search.redirect ?? "/admin", replace: true });
    }
  }, [ready, user, navigate, search.redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const u = await login(email, password);
      if (u.role === "SUBSCRIBER") {
        await logout();
        toast.error(
          "Subscriber accounts cannot access the admin panel. Please use the subscriber portal.",
        );
        return;
      }
      toast.success("Signed in");
      navigate({ to: search.redirect ?? "/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <motion.div
        className="w-full max-w-md"
        variants={scalePop}
        initial="initial"
        animate="animate"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md bg-primary text-primary-foreground font-display text-xl">
            <img src="/apple-touch-icon.png" alt="Motiva Estate logo" className="rounded-md" />
          </div>
          <h1 className="font-display text-3xl text-foreground">Motiva Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your team credentials.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Seeded accounts</p>
                <ul className="mt-1 space-y-0.5">
                  <li>superadmin@motivaestate.com — Super Admin</li>
                  <li>admin@motivaestate.com — Super Admin</li>
                  <li>editor@motivaestate.com — Content Editor</li>
                  <li>viewer@motivaestate.com — Viewer</li>
                </ul>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
