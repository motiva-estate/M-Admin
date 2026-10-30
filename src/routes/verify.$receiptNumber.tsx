import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Building } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/verify/$receiptNumber")({
  component: VerifyReceipt,
});

function VerifyReceipt() {
  const { receiptNumber } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-receipt", receiptNumber],
    queryFn: () => api.receipts.verify(receiptNumber),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-muted-foreground">Verifying receipt...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-slate-100 p-4">
        <Card className="w-full max-w-2xl border-red-200">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-red-100 p-4">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-red-900">Receipt Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              The receipt number <span className="font-mono font-medium">{receiptNumber}</span> could
              not be verified.
            </p>
            <p className="text-sm text-muted-foreground">
              Please check the receipt number and try again, or contact Motiva Estate for
              assistance.
            </p>
            <div className="pt-4">
              <a
                href="https://motivaestate.com"
                className="text-sm text-primary hover:underline"
              >
                Visit Motiva Estate
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { receipt, client } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-slate-50 to-blue-50 p-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Receipt Verified</h1>
          <p className="text-muted-foreground">
            This receipt has been authenticated and is valid
          </p>
        </div>

        {/* Receipt Card */}
        <Card className="border-2">
          <CardHeader className="border-b bg-slate-50">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  <span className="text-lg font-bold">Motiva Estate</span>
                </div>
                <CardTitle className="text-2xl">Payment Receipt</CardTitle>
              </div>
              <Badge variant="default" className="text-sm">
                VERIFIED
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {/* Receipt Details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Receipt Number</div>
                <div className="mt-1 font-mono text-lg font-bold">{receipt.receiptNumber}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Date Issued</div>
                <div className="mt-1 text-lg font-medium">{receipt.dateIssued}</div>
              </div>
            </div>

            <Separator />

            {/* Client Info */}
            <div>
              <div className="mb-3 text-sm font-medium text-muted-foreground">Issued To</div>
              <div className="rounded-md bg-slate-50 p-4">
                <div className="mb-1 text-lg font-bold">{client.fullName}</div>
                {client.phone && <div className="text-sm">{client.phone}</div>}
                <div className="text-sm">{client.email}</div>
              </div>
            </div>

            <Separator />

            {/* Payment Details */}
            <div>
              <div className="mb-3 text-sm font-medium text-muted-foreground">
                Payment Information
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Description</div>
                  <div className="font-medium">{receipt.paymentDescription}</div>
                </div>

                <div className="rounded-lg bg-gradient-to-r from-green-50 to-blue-50 p-4">
                  <div className="text-sm text-muted-foreground">Total Amount Paid</div>
                  <div className="text-3xl font-bold text-green-700">
                    ₦ {receipt.totalPaid.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm italic text-muted-foreground">
                    {receipt.amountInWords}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Breakdown */}
            <div>
              <div className="mb-3 text-sm font-medium text-muted-foreground">
                Payment Breakdown
              </div>
              <div className="space-y-2">
                {receipt.paymentEntries.map((entry: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border bg-slate-50 p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        Payment {index + 1} - {entry.paymentDate}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.paymentMethod}
                        {entry.bankName && ` via ${entry.bankName}`}
                      </div>
                    </div>
                    <div className="font-bold">₦ {entry.amount.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Footer */}
            <div className="rounded-md bg-slate-100 p-4 text-center text-xs text-muted-foreground">
              <p className="mb-2 font-medium">
                This is an authentic receipt issued by Motiva Estate
              </p>
              <p>
                For inquiries, contact us at info@motivaestate.com or +234 800 123 4567
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Links */}
        <div className="mt-8 text-center">
          <a
            href="https://motivaestate.com"
            className="text-sm text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit Motiva Estate →
          </a>
        </div>
      </div>
    </div>
  );
}
