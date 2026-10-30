import { useQuery } from "@tanstack/react-query";
import { Download, Printer, AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ReceiptStatusBadge } from "@/components/admin/StatusBadges";
import { api } from "@/lib/api/client";

export function ReceiptViewDialog({
  receiptId,
  open,
  onOpenChange,
}: {
  receiptId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["receipt-with-client", receiptId],
    queryFn: () => api.receipts.getWithClient(receiptId),
    enabled: open && !!receiptId,
  });

  if (isLoading || !data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px]">
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading receipt...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { receipt, client } = data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">RECEIPT</DialogTitle>
              <DialogDescription>Payment Acknowledgement</DialogDescription>
            </div>
            <ReceiptStatusBadge status={receipt.status} />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Void Warning Banner */}
          {receipt.status === "VOIDED" && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div className="flex-1 space-y-2">
                  <div className="font-medium text-destructive">
                    This receipt has been voided
                  </div>
                  {receipt.voidReason && (
                    <div className="text-sm">
                      <span className="font-medium">Reason:</span> {receipt.voidReason}
                    </div>
                  )}
                  {receipt.voidedAt && (
                    <div className="text-xs text-muted-foreground">
                      Voided on {new Date(receipt.voidedAt).toLocaleString()}
                      {receipt.voidedByUserName && ` by ${receipt.voidedByUserName}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Receipt Header Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">DATE ISSUED</div>
              <div className="mt-1 font-medium">{receipt.dateIssued}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">RECEIPT NUMBER</div>
              <div className="mt-1 font-mono font-medium">{receipt.receiptNumber}</div>
            </div>
          </div>

          <Separator />

          {/* Client Info */}
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">ISSUED TO</div>
            <div className="space-y-1">
              <div className="font-medium">{client.fullName}</div>
              {client.phone && <div className="text-sm">{client.phone}</div>}
              <div className="text-sm">{client.email}</div>
            </div>
          </div>

          <Separator />

          {/* Payment Description */}
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">
              PAYMENT DESCRIPTION
            </div>
            <div className="text-sm">{receipt.paymentDescription}</div>
          </div>

          {/* Amount Received */}
          <div className="rounded-md bg-muted p-4">
            <div className="mb-1 text-sm font-medium text-muted-foreground">AMOUNT RECEIVED</div>
            <div className="text-2xl font-bold">
              ₦ {receipt.amountReceived.toLocaleString()}
            </div>
          </div>

          <Separator />

          {/* Payment Entries Table */}
          <div>
            <div className="mb-3 text-sm font-medium text-muted-foreground">
              PAYMENT DETAILS
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left font-medium">NO.</th>
                    <th className="pb-2 text-left font-medium">PAYMENT DATE</th>
                    <th className="pb-2 text-left font-medium">PAYMENT METHOD</th>
                    <th className="pb-2 text-right font-medium">AMOUNT (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.paymentEntries.map((entry: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2">{index + 1}</td>
                      <td className="py-2">{entry.paymentDate}</td>
                      <td className="py-2">
                        {entry.paymentMethod}
                        {entry.bankName && ` (${entry.bankName}${entry.accountNumber ? ` - ${entry.accountNumber}` : ""})`}
                      </td>
                      <td className="py-2 text-right">{entry.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td colSpan={3} className="py-2">
                      TOTAL PAID
                    </td>
                    <td className="py-2 text-right">
                      ₦ {receipt.totalPaid.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* Amount in Words */}
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">AMOUNT IN WORDS</div>
            <div className="text-sm italic">{receipt.amountInWords}</div>
          </div>

          {/* QR Code */}
          {receipt.qrCodeData && (
            <div className="flex justify-center">
              <img
                src={receipt.qrCodeData}
                alt="QR Code"
                className="h-32 w-32 rounded border"
              />
              <div className="ml-4 flex flex-col justify-center text-xs text-muted-foreground">
                <div>Scan to verify</div>
                <div>this receipt online</div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="rounded-md bg-muted p-4 text-center text-xs">
            <div className="mb-2 font-medium">THANK YOU!</div>
            <div className="text-muted-foreground">PLEASURE DOING BUSINESS WITH YOU</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          <Button onClick={() => api.receipts.downloadPDF(receiptId)}>
            <Download className="mr-1 h-4 w-4" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
