import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { Plus, Receipt as ReceiptIcon, Download, Eye, Trash2, XCircle, Search } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { Paginator } from "@/components/admin/Paginator";
import { ReceiptStatusBadge } from "@/components/admin/StatusBadges";
import { api } from "@/lib/api/client";
import { ReceiptFormDialog } from "@/components/admin/ReceiptFormDialog";
import { ReceiptViewDialog } from "@/components/admin/ReceiptViewDialog";
import { VoidReceiptDialog } from "@/components/admin/VoidReceiptDialog";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/admin/receipts/")({
  component: ReceiptsList,
});

function ReceiptsList() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewReceiptId, setViewReceiptId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<{ id: string; number: string } | null>(null);
  const [receiptToVoid, setReceiptToVoid] = useState<{ id: string; number: string } | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: result, refetch } = useQuery({
    queryKey: ["receipts", page, search, statusFilter],
    queryFn: () =>
      api.receipts.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: clientsResult } = useQuery({
    queryKey: ["clients", "all"],
    queryFn: () => api.clients.list({ limit: 500 }),
  });

  const receipts = result?.data ?? [];
  const total = result?.total ?? 0;
  const clients = clientsResult?.data ?? [];

  const getClientName = (id: string) =>
    clients.find((c) => c._id === id)?.fullName ?? "Unknown Client";

  const handleDeleteClick = (id: string, receiptNumber: string) => {
    setReceiptToDelete({ id, number: receiptNumber });
    setDeleteDialogOpen(true);
  };

  const handleVoidClick = (id: string, receiptNumber: string) => {
    setReceiptToVoid({ id, number: receiptNumber });
    setVoidDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!receiptToDelete) return;

    try {
      await api.receipts.remove(receiptToDelete.id);
      toast.success("Receipt deleted", {
        description: `Receipt ${receiptToDelete.number} has been deleted.`,
      });
      refetch();
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to delete receipt",
      });
    } finally {
      setDeleteDialogOpen(false);
      setReceiptToDelete(null);
    }
  };

  const handleVoid = async (reason: string) => {
    if (!receiptToVoid) return;

    setIsVoiding(true);
    try {
      await api.receipts.void(receiptToVoid.id, reason);
      toast.success("Receipt voided", {
        description: `Receipt ${receiptToVoid.number} has been voided.`,
      });
      refetch();
      setVoidDialogOpen(false);
      setReceiptToVoid(null);
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to void receipt",
      });
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Create and manage payment receipts for clients. Receipts can be downloaded as PDF documents."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create Receipt
          </Button>
        }
      />

      <ReceiptFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          setCreateOpen(false);
          refetch();
        }}
      />

      {viewReceiptId && (
        <ReceiptViewDialog
          receiptId={viewReceiptId}
          open={!!viewReceiptId}
          onOpenChange={(open) => !open && setViewReceiptId(null)}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete receipt{" "}
              <span className="font-mono font-semibold">{receiptToDelete?.number}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VoidReceiptDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        onConfirm={handleVoid}
        receiptNumber={receiptToVoid?.number || ""}
        isLoading={isVoiding}
      />

      <div className="mb-4 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by receipt number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ISSUED">Issued</SelectItem>
            <SelectItem value="VOIDED">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {receipts.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon className="h-5 w-5" />}
          title="No receipts found"
          description="Create your first receipt to acknowledge payments received from clients."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt Number</TableHead>
                <TableHead>Date Issued</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => (
                <TableRow key={receipt._id || receipt.id}>
                  <TableCell className="font-mono font-medium">
                    {receipt.receiptNumber}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {receipt.dateIssued}
                  </TableCell>
                  <TableCell>{getClientName(receipt.clientId)}</TableCell>
                  <TableCell className="font-medium">
                    ₦ {receipt.amountReceived.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <ReceiptStatusBadge status={receipt.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewReceiptId(receipt._id || receipt.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => api.receipts.downloadPDF(receipt._id || receipt.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {receipt.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDeleteClick(receipt._id || receipt.id, receipt.receiptNumber)
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {receipt.status === "ISSUED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleVoidClick(receipt._id || receipt.id, receipt.receiptNumber)
                          }
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-3">
            <Paginator
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
