import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

type PaymentEntry = {
  paymentDate: string;
  paymentMethod: string;
  bankName?: string;
  accountNumber?: string;
  amount: number;
};

export function ReceiptFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [dateIssued, setDateIssued] = useState(
    new Date().toLocaleDateString("en-GB").replace(/\//g, "-")
  );
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([
    {
      paymentDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
      paymentMethod: "Bank Transfer",
      amount: 0,
    },
  ]);

  const { data: clientsResult } = useQuery({
    queryKey: ["clients", "all"],
    queryFn: () => api.clients.list({ limit: 500 }),
    enabled: open,
  });

  const clients = clientsResult?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: any) => api.receipts.create(data),
    onSuccess: () => {
      toast.success("Receipt created", {
        description: "The receipt has been created successfully.",
      });
      onSuccess?.();
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Error", {
        description: error.message || "Failed to create receipt",
      });
    },
  });

  const resetForm = () => {
    setClientId("");
    setDateIssued(new Date().toLocaleDateString("en-GB").replace(/\//g, "-"));
    setPaymentDescription("");
    setPaymentEntries([
      {
        paymentDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
        paymentMethod: "Bank Transfer",
        amount: 0,
      },
    ]);
  };

  const addPaymentEntry = () => {
    setPaymentEntries([
      ...paymentEntries,
      {
        paymentDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
        paymentMethod: "Bank Transfer",
        amount: 0,
      },
    ]);
  };

  const removePaymentEntry = (index: number) => {
    setPaymentEntries(paymentEntries.filter((_, i) => i !== index));
  };

  const updatePaymentEntry = (index: number, field: keyof PaymentEntry, value: any) => {
    const updated = [...paymentEntries];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentEntries(updated);
  };

  const totalAmount = paymentEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

  const handleSubmit = (status: "DRAFT" | "ISSUED") => {
    if (!clientId) {
      toast.error("Validation Error", {
        description: "Please select a client",
      });
      return;
    }

    if (!paymentDescription) {
      toast.error("Validation Error", {
        description: "Please enter a payment description",
      });
      return;
    }

    if (totalAmount === 0) {
      toast.error("Validation Error", {
        description: "Total amount must be greater than zero",
      });
      return;
    }

    createMutation.mutate({
      clientId,
      dateIssued,
      paymentDescription,
      amountReceived: totalAmount,
      paymentEntries,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create Receipt</DialogTitle>
          <DialogDescription>
            Enter the payment details to generate a receipt for the client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Issued */}
          <div>
            <Label htmlFor="dateIssued">Date Issued</Label>
            <Input
              id="dateIssued"
              value={dateIssued}
              onChange={(e) => setDateIssued(e.target.value)}
              placeholder="DD-MM-YYYY"
            />
          </div>

          {/* Client Selection */}
          <div>
            <Label htmlFor="client">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client._id} value={client._id}>
                    {client.fullName} ({client.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Description */}
          <div>
            <Label htmlFor="description">Payment Description</Label>
            <Textarea
              id="description"
              value={paymentDescription}
              onChange={(e) => setPaymentDescription(e.target.value)}
              placeholder="Describe what the payment is for (e.g., Plot 45, Phase 2, Lanzarote Estate)"
              rows={3}
            />
          </div>

          {/* Payment Entries */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Payment Entries</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPaymentEntry}>
                <Plus className="mr-1 h-3 w-3" /> Add Payment
              </Button>
            </div>

            <div className="space-y-3">
              {paymentEntries.map((entry, index) => (
                <div key={index} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Payment {index + 1}</span>
                    {paymentEntries.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePaymentEntry(index)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Payment Date</Label>
                      <Input
                        value={entry.paymentDate}
                        onChange={(e) =>
                          updatePaymentEntry(index, "paymentDate", e.target.value)
                        }
                        placeholder="DD-MM-YYYY"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Payment Method</Label>
                      <Select
                        value={entry.paymentMethod}
                        onValueChange={(value) =>
                          updatePaymentEntry(index, "paymentMethod", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="POS">POS</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {entry.paymentMethod === "Bank Transfer" && (
                      <>
                        <div>
                          <Label className="text-xs">Bank Name</Label>
                          <Input
                            value={entry.bankName || ""}
                            onChange={(e) =>
                              updatePaymentEntry(index, "bankName", e.target.value)
                            }
                            placeholder="e.g., GTBank"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Account Number (optional)</Label>
                          <Input
                            value={entry.accountNumber || ""}
                            onChange={(e) =>
                              updatePaymentEntry(index, "accountNumber", e.target.value)
                            }
                            placeholder="e.g., 0123456789"
                          />
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-2">
                      <Label className="text-xs">Amount (₦)</Label>
                      <Input
                        type="number"
                        value={entry.amount || ""}
                        onChange={(e) =>
                          updatePaymentEntry(index, "amount", parseFloat(e.target.value) || 0)
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-md bg-muted p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Amount:</span>
                <span className="text-lg font-bold">₦ {totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit("DRAFT")}
            disabled={createMutation.isPending}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit("ISSUED")}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Issue Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
