import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Receipt as ReceiptIcon, Download, Eye, FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/portal/receipts/")({
  component: PortalReceipts,
});

function PortalReceipts() {
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["portal-receipts"],
    queryFn: () => api.portal.listReceipts(),
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-muted-foreground">Loading receipts...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ReceiptIcon className="h-5 w-5" />
                My Receipts
              </CardTitle>
              <CardDescription className="mt-2">
                View and download your payment receipts
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium">No receipts yet</h3>
              <p className="text-sm text-muted-foreground">
                Your payment receipts will appear here once issued
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt Number</TableHead>
                    <TableHead>Date Issued</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt: any) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono font-medium">
                        {receipt.receiptNumber}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {receipt.dateIssued}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {receipt.paymentDescription}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦ {receipt.amountReceived.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/verify/${receipt.receiptNumber.replace(/\//g, "-")}`,
                                "_blank"
                              )
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => api.receipts.downloadPDF(receipt.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
