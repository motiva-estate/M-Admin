import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import { ReceiptStatusBadge } from "@/components/admin/StatusBadges";
import {
  ReceiptPreview,
  ScaledReceipt,
  type ReceiptPaymentEntry,
} from "@/components/admin/ReceiptPreview";
import { api } from "@/lib/api/client";

/**
 * Scoped print stylesheet. Only present in the document while this dialog is
 * mounted, so it never interferes with printing elsewhere in the app.
 *
 * The approach: hide every direct child of <body> except the portaled print
 * root, then reveal the print root at full size. This makes `window.print()`
 * output only the branded receipt — no admin sidebar, dialogs, or overlays.
 */
const PRINT_STYLES = `
#receipt-print-root { display: none; }
@media print {
  html, body { background: #ffffff !important; }
  body > *:not(#receipt-print-root) { display: none !important; }
  #receipt-print-root { display: block !important; position: static; }
  #receipt-print-root .receipt-print-sheet {
    width: 100% !important;
    max-width: 800px !important;
    box-shadow: none !important;
    border: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  /* The ReceiptPreview root carries a fixed inline width: 800px — relax it so
     the document reflows to the printable width instead of clipping. */
  #receipt-print-root .receipt-print-sheet > div {
    width: 100% !important;
    max-width: 800px !important;
  }
}
@page { size: auto; margin: 12mm; }
`;

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

  // Normalise the server payload into the shape ReceiptPreview expects.
  const previewProps = useMemo(() => {
    if (!data) return null;
    const { receipt, client } = data;

    const paymentEntries: ReceiptPaymentEntry[] = (receipt.paymentEntries ?? []).map(
      (e: ReceiptPaymentEntry) => ({
        paymentDate: e.paymentDate ?? "",
        paymentMethod: e.paymentMethod ?? "",
        bankName: e.bankName,
        accountNumber: e.accountNumber,
        amount: Number(e.amount) || 0,
      }),
    );

    const sumEntries = paymentEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const amountReceived = Number(receipt.totalPaid ?? receipt.amountReceived) || sumEntries;

    return {
      receiptNumber: receipt.receiptNumber,
      dateIssued: receipt.dateIssued,
      clientName: client?.fullName,
      clientPhone: client?.phone,
      clientEmail: client?.email,
      paymentDescription: receipt.paymentDescription,
      amountReceived,
      paymentEntries,
      status: (receipt.status ?? "DRAFT") as "DRAFT" | "ISSUED" | "VOIDED",
      qrCodeData: receipt.qrCodeData,
      companyAddress: receipt.companyAddress,
      companyWebsite: receipt.companyWebsite,
      companyEmail: receipt.companyEmail,
      companyPhone: receipt.companyPhone,
      signatory: receipt.signatory,
      signatureImage: receipt.signatureImage,
      disclaimer: receipt.disclaimer,
      // void metadata surfaced in the compact admin notice
      voidReason: receipt.voidReason as string | undefined,
      voidedAt: receipt.voidedAt as string | undefined,
      voidedByUserName: receipt.voidedByUserName as string | undefined,
    };
  }, [data]);

  if (isLoading || !previewProps) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[760px]">
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading receipt...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { status, voidReason, voidedAt, voidedByUserName, ...receiptProps } = previewProps;

  const handlePrint = () => {
    // The print root + styles are already mounted, so a plain print triggers
    // the @media print rules that isolate the branded receipt.
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-xl">
                  Receipt {previewProps.receiptNumber ? `#${previewProps.receiptNumber}` : ""}
                </DialogTitle>
                <DialogDescription>Payment acknowledgement</DialogDescription>
              </div>
              <ReceiptStatusBadge status={status} />
            </div>
          </DialogHeader>

          {/* Compact voided notice (the branded preview carries the VOID watermark) */}
          {status === "VOIDED" && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="flex-1 space-y-0.5 text-sm">
                  <div className="font-medium text-destructive">This receipt has been voided</div>
                  {voidReason && (
                    <div>
                      <span className="font-medium">Reason:</span> {voidReason}
                    </div>
                  )}
                  {voidedAt && (
                    <div className="text-xs text-muted-foreground">
                      Voided on {new Date(voidedAt).toLocaleString()}
                      {voidedByUserName ? ` by ${voidedByUserName}` : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Branded preview — matches the editor live preview exactly */}
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <ScaledReceipt>
              <ReceiptPreview {...receiptProps} status={status} />
            </ScaledReceipt>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
            <Button onClick={() => api.receipts.downloadPDF(receiptId)}>
              <Download className="mr-1 h-4 w-4" /> Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden print area — a full-size, unscaled copy of the branded receipt
          portaled to <body> so the @media print rules can isolate it cleanly. */}
      <PrintArea>
        <ReceiptPreview {...receiptProps} status={status} />
      </PrintArea>
    </>
  );
}

/**
 * Portals a hidden, full-size copy of the receipt to <body> and injects the
 * scoped print stylesheet. Everything is cleaned up when the dialog unmounts.
 */
function PrintArea({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (typeof document === "undefined" || !mounted) return null;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div id="receipt-print-root" aria-hidden>
        <div className="receipt-print-sheet">{children}</div>
      </div>
    </>,
    document.body,
  );
}
