import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  Download,
  FileText,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import {
  ReceiptPreview,
  ScaledReceipt,
  type ReceiptPaymentEntry,
} from "@/components/admin/ReceiptPreview";
import { dmYToIso, isoToDmY, numberToWords, todayDmY } from "@/lib/receipt";

export const Route = createFileRoute("/admin/receipts/$id")({
  component: ReceiptEditor,
});

type ReceiptStatus = "DRAFT" | "ISSUED" | "VOIDED";

const DEFAULT_DISCLAIMER =
  "This receipt acknowledges the sum received as shown in the payment details above, based on proof of payment forwarded to us. All payments remain subject to confirmation by our accounts department due to the nature of electronic transaction failures and interruptions.";

interface ReceiptFormState {
  // ── Tab 1: Receipt details ────────────────────────────────────────────
  dateIssued: string;
  clientId: string;
  paymentDescription: string;
  paymentEntries: ReceiptPaymentEntry[];
  status: "DRAFT" | "ISSUED";
  // ── Tab 2: Company & sign-off ─────────────────────────────────────────
  companyAddress: string;
  companyWebsite: string;
  companyEmail: string;
  companyPhone: string;
  signatory: string;
  /** Base64 data URL of the uploaded signature / stamp. */
  signatureImage: string;
  disclaimer: string;
}

const PAYMENT_METHODS = ["Bank Transfer", "Cash", "POS", "Cheque", "Mobile Money", "Other"];

function newPaymentEntry(): ReceiptPaymentEntry {
  return { paymentDate: todayDmY(), paymentMethod: "Bank Transfer", amount: 0 };
}

function initialForm(): ReceiptFormState {
  return {
    dateIssued: todayDmY(),
    clientId: "",
    paymentDescription: "",
    paymentEntries: [newPaymentEntry()],
    status: "DRAFT",
    companyAddress: "",
    companyWebsite: "",
    companyEmail: "",
    companyPhone: "",
    signatory: "Finance Manager",
    signatureImage: "",
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function ReceiptEditor() {
  const { id } = useParams({ from: "/admin/receipts/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Clients for the dropdown (create mode).
  const { data: clientsData } = useQuery({
    queryKey: ["clients", "all"],
    queryFn: () => api.clients.list({ limit: 500 }),
  });
  const clients = clientsData?.data ?? [];

  // Existing receipt + client (edit mode).
  const { data: existing, isLoading } = useQuery({
    queryKey: ["receipt-with-client", id],
    queryFn: () => api.receipts.getWithClient(id),
    enabled: !isNew,
  });

  const [form, setForm] = useState<ReceiptFormState>(initialForm);

  // Server-managed fields surfaced in edit mode.
  const [loadedReceiptNumber, setLoadedReceiptNumber] = useState("");
  const [loadedStatus, setLoadedStatus] = useState<ReceiptStatus>("DRAFT");
  const [loadedQr, setLoadedQr] = useState("");
  const [loadedClient, setLoadedClient] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
  }>({});

  useEffect(() => {
    if (!existing) return;
    const r = existing.receipt ?? {};
    setForm({
      dateIssued: r.dateIssued || todayDmY(),
      clientId: r.clientId ?? "",
      paymentDescription: r.paymentDescription ?? "",
      paymentEntries:
        Array.isArray(r.paymentEntries) && r.paymentEntries.length
          ? r.paymentEntries.map((e: ReceiptPaymentEntry) => ({
              paymentDate: e.paymentDate ?? "",
              paymentMethod: e.paymentMethod ?? "Bank Transfer",
              bankName: e.bankName,
              accountNumber: e.accountNumber,
              amount: Number(e.amount) || 0,
            }))
          : [newPaymentEntry()],
      status: r.status === "ISSUED" ? "ISSUED" : "DRAFT",
      companyAddress: r.companyAddress ?? "",
      companyWebsite: r.companyWebsite ?? "",
      companyEmail: r.companyEmail ?? "",
      companyPhone: r.companyPhone ?? "",
      signatory: r.signatory ?? "Finance Manager",
      signatureImage: r.signatureImage ?? "",
      disclaimer: r.disclaimer ?? DEFAULT_DISCLAIMER,
    });
    setLoadedReceiptNumber(r.receiptNumber ?? "");
    setLoadedStatus((r.status as ReceiptStatus) ?? "DRAFT");
    setLoadedQr(r.qrCodeData ?? "");
    const c = existing.client ?? {};
    setLoadedClient({ fullName: c.fullName, email: c.email, phone: c.phone });
  }, [existing]);

  const total = useMemo(
    () => form.paymentEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [form.paymentEntries],
  );

  const previewClient = isNew ? clients.find((c) => c._id === form.clientId) : loadedClient;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const set = <K extends keyof ReceiptFormState>(key: K, value: ReceiptFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateEntry = (index: number, patch: Partial<ReceiptPaymentEntry>) =>
    setForm((f) => ({
      ...f,
      paymentEntries: f.paymentEntries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));

  const addEntry = () =>
    setForm((f) => ({ ...f, paymentEntries: [...f.paymentEntries, newPaymentEntry()] }));

  const removeEntry = (index: number) =>
    setForm((f) => ({
      ...f,
      paymentEntries: f.paymentEntries.filter((_, i) => i !== index),
    }));

  // ── Signature upload ──────────────────────────────────────────────────────

  const sigInputRef = useRef<HTMLInputElement>(null);

  const handleSignatureFile = (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Use a PNG, JPG or WebP file for the signature.");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("Signature file must be smaller than 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") set("signatureImage", reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ── Save / issue ──────────────────────────────────────────────────────────

  const save = useMutation({
    mutationFn: async (submitStatus: "DRAFT" | "ISSUED") => {
      const payload = {
        dateIssued: form.dateIssued,
        paymentDescription: form.paymentDescription,
        amountReceived: total,
        paymentEntries: form.paymentEntries,
        status: submitStatus,
        // company / sign-off
        companyAddress: form.companyAddress || undefined,
        companyWebsite: form.companyWebsite || undefined,
        companyEmail: form.companyEmail || undefined,
        companyPhone: form.companyPhone || undefined,
        signatory: form.signatory || undefined,
        signatureImage: form.signatureImage || undefined,
        disclaimer: form.disclaimer || undefined,
      };
      if (isNew) return api.receipts.create({ ...payload, clientId: form.clientId });
      return api.receipts.update(id, payload);
    },
    onSuccess: (res: { id?: string; _id?: string }) => {
      toast.success(isNew ? "Receipt created" : "Receipt updated");
      qc.invalidateQueries({ queryKey: ["receipts"] });
      if (isNew) {
        const newId = res?.id || res?._id;
        navigate({ to: "/admin/receipts/$id", params: { id: newId ?? id } });
      } else {
        qc.invalidateQueries({ queryKey: ["receipt-with-client", id] });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to save receipt"),
  });

  const handleSubmit = (submitStatus: "DRAFT" | "ISSUED") => {
    if (isNew && !form.clientId) {
      toast.error("Select a client");
      return;
    }
    if (!form.paymentDescription.trim()) {
      toast.error("Enter a payment description");
      return;
    }
    if (form.paymentEntries.length === 0) {
      toast.error("Add at least one payment");
      return;
    }
    if (form.paymentEntries.some((e) => !e.paymentDate || !(Number(e.amount) > 0))) {
      toast.error("Every payment needs a date and an amount greater than zero");
      return;
    }
    if (total <= 0) {
      toast.error("Total amount must be greater than zero");
      return;
    }
    save.mutate(submitStatus);
  };

  const canIssue = isNew || loadedStatus === "DRAFT";
  const canDownload = !isNew && loadedStatus === "ISSUED" && !!loadedQr;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isNew
            ? "Create receipt"
            : loadedReceiptNumber
              ? `Receipt ${loadedReceiptNumber}`
              : "Edit receipt"
        }
        description="Fill in the receipt details, customise company sign-off, then preview and issue."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/admin/receipts" })}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {canDownload && (
              <Button variant="outline" onClick={() => api.receipts.downloadPDF(id)}>
                <Download className="mr-1 h-4 w-4" /> PDF
              </Button>
            )}
          </div>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.95fr)]">
        {/* ═══════════════════════════════════════════════════════════════════
            FORM COLUMN
        ════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-5">
          {isLoading && !isNew && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
              Loading receipt…
            </div>
          )}

          <Tabs defaultValue="details">
            {/* ── Tab navigation ── */}
            <TabsList className="mb-5 w-full justify-start gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <TabsTrigger
                value="details"
                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <FileText className="h-4 w-4" />
                Receipt details
              </TabsTrigger>
              <TabsTrigger
                value="company"
                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Building2 className="h-4 w-4" />
                Company &amp; sign-off
              </TabsTrigger>
            </TabsList>

            {/* ══════════════════════════════════════════════════════════════
                TAB 1 — Receipt details
            ═══════════════════════════════════════════════════════════════ */}
            <TabsContent value="details" className="space-y-5 mt-0">
              {/* Receipt information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Receipt information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dateIssued">Date issued</Label>
                      <Input
                        id="dateIssued"
                        type="date"
                        value={dmYToIso(form.dateIssued)}
                        onChange={(e) => set("dateIssued", isoToDmY(e.target.value))}
                      />
                    </div>
                    {!isNew && (
                      <div className="space-y-2">
                        <Label>Receipt number</Label>
                        <Input value={loadedReceiptNumber} readOnly className="font-mono" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client">Client</Label>
                    {isNew ? (
                      <Select value={form.clientId} onValueChange={(v) => set("clientId", v)}>
                        <SelectTrigger id="client">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.fullName} ({c.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-md border border-input bg-muted/30 px-3 py-2.5">
                        <div className="text-sm font-medium">{loadedClient.fullName || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {loadedClient.email}
                          {loadedClient.phone ? ` · ${loadedClient.phone}` : ""}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isNew && (
                    <div className="flex items-center gap-2">
                      <Label>Status</Label>
                      <ReceiptStatusBadge status={loadedStatus} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment description */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment description</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor="description">What the payment covers</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    placeholder="e.g. Payment for 1 plot at Motiva Gardens, Abuja"
                    value={form.paymentDescription}
                    onChange={(e) => set("paymentDescription", e.target.value)}
                  />
                </CardContent>
              </Card>

              {/* Payment breakdown */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Payment breakdown</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addEntry}>
                    <Plus className="mr-1 h-4 w-4" /> Add payment
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {form.paymentEntries.map((entry, index) => (
                    <div key={index} className="rounded-lg border border-border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium">Payment {index + 1}</span>
                        {form.paymentEntries.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeEntry(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Payment date</Label>
                          <Input
                            type="date"
                            value={dmYToIso(entry.paymentDate)}
                            onChange={(e) =>
                              updateEntry(index, { paymentDate: isoToDmY(e.target.value) })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Method</Label>
                          <Select
                            value={entry.paymentMethod}
                            onValueChange={(v) => updateEntry(index, { paymentMethod: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHODS.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {entry.paymentMethod === "Bank Transfer" && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-xs">Bank name</Label>
                              <Input
                                placeholder="e.g. Access Bank"
                                value={entry.bankName ?? ""}
                                onChange={(e) => updateEntry(index, { bankName: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Account number</Label>
                              <Input
                                placeholder="Account number"
                                value={entry.accountNumber ?? ""}
                                onChange={(e) =>
                                  updateEntry(index, { accountNumber: e.target.value })
                                }
                              />
                            </div>
                          </>
                        )}

                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-xs">Amount (₦)</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            value={entry.amount || ""}
                            onChange={(e) =>
                              updateEntry(index, { amount: parseFloat(e.target.value) || 0 })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3">
                    <span className="text-sm font-medium">Total amount</span>
                    <span className="text-lg font-bold">₦ {total.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ══════════════════════════════════════════════════════════════
                TAB 2 — Company & sign-off
            ═══════════════════════════════════════════════════════════════ */}
            <TabsContent value="company" className="space-y-5 mt-0">
              {/* Company contact details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Company contact details</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Optional details shown at the bottom of each receipt.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Company address</Label>
                    <Input
                      id="companyAddress"
                      placeholder="Business address"
                      value={form.companyAddress}
                      onChange={(e) => set("companyAddress", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="companyWebsite">Website</Label>
                      <Input
                        id="companyWebsite"
                        placeholder="www.example.com"
                        value={form.companyWebsite}
                        onChange={(e) => set("companyWebsite", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Company email</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        placeholder="info@example.com"
                        value={form.companyEmail}
                        onChange={(e) => set("companyEmail", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Company phone</Label>
                      <Input
                        id="companyPhone"
                        placeholder="Phone number"
                        value={form.companyPhone}
                        onChange={(e) => set("companyPhone", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signatory">Authorised signatory</Label>
                      <Input
                        id="signatory"
                        placeholder="Finance Manager"
                        value={form.signatory}
                        onChange={(e) => set("signatory", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Signature & terms */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Signature &amp; terms</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Optionally attach an approved signature/stamp and update your payment
                    disclaimer.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Upload area */}
                  {form.signatureImage ? (
                    <div className="relative inline-block">
                      <img
                        src={form.signatureImage}
                        alt="Signature preview"
                        className="max-h-24 rounded-md border border-border object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => set("signatureImage", "")}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                        aria-label="Remove signature"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sigInputRef.current?.click()}
                      className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:bg-muted/50"
                    >
                      <UploadCloud className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Upload signature or stamp</span>
                      <span className="text-xs text-muted-foreground">
                        PNG, JPG or WebP • Up to 1 MB
                      </span>
                    </button>
                  )}
                  <input
                    ref={sigInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleSignatureFile(e.target.files?.[0])}
                  />

                  {/* Disclaimer */}
                  <div className="space-y-2">
                    <Label htmlFor="disclaimer">Disclaimer</Label>
                    <Textarea
                      id="disclaimer"
                      rows={5}
                      value={form.disclaimer}
                      onChange={(e) => set("disclaimer", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* ── Save / issue actions (always visible below tabs) ── */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => handleSubmit("DRAFT")}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : isNew ? "Save as draft" : "Save changes"}
            </Button>
            {canIssue && (
              <Button onClick={() => handleSubmit("ISSUED")} disabled={save.isPending}>
                <BadgeCheck className="mr-1 h-4 w-4" />
                {save.isPending ? "Issuing…" : "Issue receipt"}
              </Button>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            LIVE PREVIEW COLUMN (sticky)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Live preview</div>
              <div className="text-xs text-muted-foreground">How your receipt will look</div>
            </div>
            <Badge
              variant="outline"
              className="gap-1.5 border-green-200 bg-green-50 text-green-700"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              LIVE
            </Badge>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <ScaledReceipt>
              <ReceiptPreview
                receiptNumber={loadedReceiptNumber}
                dateIssued={form.dateIssued}
                clientName={previewClient?.fullName}
                clientPhone={previewClient?.phone}
                clientEmail={previewClient?.email}
                paymentDescription={form.paymentDescription}
                amountReceived={total}
                paymentEntries={form.paymentEntries}
                status={isNew ? form.status : loadedStatus}
                qrCodeData={isNew ? undefined : loadedQr}
                companyAddress={form.companyAddress}
                companyWebsite={form.companyWebsite}
                companyEmail={form.companyEmail}
                companyPhone={form.companyPhone}
                signatory={form.signatory}
                signatureImage={form.signatureImage}
                disclaimer={form.disclaimer}
              />
            </ScaledReceipt>
          </div>

          <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium text-foreground">Unique QR verification</div>
              <div className="mt-0.5">
                The printable receipt contains a scannable QR code once issued.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2.5 rounded-md border border-border p-3">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Total amount
                </div>
                <div className="truncate text-sm font-semibold">₦ {total.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-md border border-border p-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Issue date
                </div>
                <div className="truncate text-sm font-semibold">{form.dateIssued}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <Printer className="h-3.5 w-3.5" /> Print or save as PDF after issuing.
          </div>

          <Separator />

          <div className="rounded-md bg-muted/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Amount in words
            </div>
            <div className="mt-1 text-xs italic">{numberToWords(total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const map: Record<ReceiptStatus, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-amber-50 text-amber-700 border-amber-200" },
    ISSUED: { label: "Issued", className: "bg-green-50 text-green-700 border-green-200" },
    VOIDED: { label: "Voided", className: "bg-red-50 text-red-700 border-red-200" },
  };
  const s = map[status];
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}
