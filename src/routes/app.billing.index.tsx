import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Eye } from "lucide-react";
import { toast } from "sonner";
import { PaginationFooter } from "@/components/data/pagination-footer";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRecordPage } from "@/lib/use-record-page";
import { useWorkspaceData, type Bill } from "@/lib/workspace-data";

export const Route = createFileRoute("/app/billing/")({ component: BillingPage });

function BillingPage() {
  const { listBills, updateBill } = useWorkspaceData();
  const {
    rows: bills,
    total,
    limit,
    offset,
    setOffset,
    isLoading,
    error,
  } = useRecordPage(listBills);
  const [viewing, setViewing] = useState<Bill | null>(null);
  const [payMethod, setPayMethod] = useState("Card");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const markPaid = async () => {
    if (!viewing) return;
    setIsRecordingPayment(true);
    try {
      await updateBill({ ...viewing, status: "Paid", method: payMethod });
      toast.success(`Invoice ${viewing.id} marked paid`);
      setViewing(null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to record the payment");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Billing"
        description="Invoices, payments and reconciliations."
        actions={<Button asChild><Link to="/app/billing/new">Create bill</Link></Button>}
      />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading invoices...</TableCell></TableRow>
            )}
            {!isLoading && error && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-destructive">{error}</TableCell></TableRow>
            )}
            {!isLoading && !error && bills.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No invoices found.</TableCell></TableRow>
            )}
            {bills.map((bill) => (
              <TableRow key={bill.id}>
                <TableCell className="font-mono text-xs">{bill.id}</TableCell>
                <TableCell className="font-semibold">{bill.patient}</TableCell>
                <TableCell className="text-muted-foreground">{bill.date}</TableCell>
                <TableCell className="text-right tabular-nums">
                  INR {bill.amount.toFixed(2)}
                </TableCell>
                <TableCell>{bill.method}</TableCell>
                <TableCell>
                  <Badge variant={bill.status === "Paid" ? "secondary" : bill.status === "Overdue" ? "destructive" : "outline"}>
                    {bill.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setViewing(bill);
                      setPayMethod(bill.method === "-" ? "Card" : bill.method);
                    }}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationFooter
          offset={offset}
          limit={limit}
          total={total}
          onOffsetChange={setOffset}
          disabled={isLoading}
        />
      </div>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoice {viewing?.id}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Patient</div><div className="font-semibold">{viewing.patient}</div></div>
                <div><div className="text-xs text-muted-foreground">Date</div><div>{viewing.date}</div></div>
                <div><div className="text-xs text-muted-foreground">Method</div><div>{viewing.method}</div></div>
                <div><div className="text-xs text-muted-foreground">Status</div><Badge variant={viewing.status === "Paid" ? "secondary" : "outline"}>{viewing.status}</Badge></div>
              </div>
              <div className="flex justify-between rounded-xl bg-muted/40 px-3 py-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">INR {viewing.amount.toFixed(2)}</span>
              </div>
              {viewing.status !== "Paid" && (
                <div className="space-y-2 rounded-xl border p-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Record payment</div>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {viewing?.status !== "Paid" && (
              <Button onClick={markPaid} disabled={isRecordingPayment}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {isRecordingPayment ? "Recording..." : "Mark as paid"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
