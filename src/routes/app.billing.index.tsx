import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatCard } from "@/components/layout/stat-card";
import { useWorkspaceData, type Bill } from "@/lib/workspace-data";
import { Receipt, CheckCircle2, Clock, AlertCircle, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/billing/")({ component: BillingPage });

function BillingPage() {
  const { bills, prescriptions, updateBill } = useWorkspaceData();
  const [viewing, setViewing] = useState<Bill | null>(null);
  const [payMethod, setPayMethod] = useState<string>("Card");

  const paid = bills.filter(b => b.status === "Paid").reduce((s, b) => s + b.amount, 0);
  const pending = bills.filter(b => b.status === "Pending").reduce((s, b) => s + b.amount, 0);
  const overdue = bills.filter(b => b.status === "Overdue").reduce((s, b) => s + b.amount, 0);

  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const setStatus = async (id: string, status: string, method?: string) => {
    const bill = bills.find(item => item.id === id);
    if (!bill) return;
    await updateBill({ ...bill, status, method: method ?? bill.method });
    toast.success(`Invoice ${id} marked ${status.toLowerCase()}`);
  };

  const markPaidFromDialog = async () => {
    if (!viewing) return;
    setIsRecordingPayment(true);
    try {
      await setStatus(viewing.id, "Paid", payMethod);
      setViewing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record the payment");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const linkedRx = viewing ? prescriptions.find(p => p.patient === viewing.patient) : undefined;

  return (
    <>
      <PageHeader title="Billing" description="Invoices, payments and reconciliations."
        actions={<Button asChild><Link to="/app/billing/new">Create bill</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected (June)" value={`₹${paid.toFixed(2)}`} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Pending" value={`₹${pending.toFixed(2)}`} tone="warning" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Overdue" value={`₹${overdue.toFixed(2)}`} tone="destructive" icon={<AlertCircle className="h-4 w-4" />} />
        <StatCard label="Invoices issued" value={bills.length} icon={<Receipt className="h-4 w-4" />} />
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Patient</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {bills.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.id}</TableCell>
                <TableCell className="font-semibold">{b.patient}</TableCell>
                <TableCell className="text-muted-foreground">{b.date}</TableCell>
                <TableCell className="text-right tabular-nums">₹{b.amount.toFixed(2)}</TableCell>
                <TableCell>{b.method}</TableCell>
                <TableCell>
                  <Badge variant={b.status === "Paid" ? "secondary" : b.status === "Overdue" ? "destructive" : "outline"}>{b.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setViewing(b); setPayMethod(b.method === "—" ? "Card" : b.method); }}>
                    <Eye className="mr-1 h-3.5 w-3.5" />View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoice {viewing?.id}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Patient</div><div className="font-semibold">{viewing.patient}</div></div>
                <div><div className="text-xs text-muted-foreground">Date</div><div>{viewing.date}</div></div>
                <div><div className="text-xs text-muted-foreground">Method</div><div>{viewing.method}</div></div>
                <div><div className="text-xs text-muted-foreground">Status</div>
                  <Badge variant={viewing.status === "Paid" ? "secondary" : viewing.status === "Overdue" ? "destructive" : "outline"}>{viewing.status}</Badge>
                </div>
              </div>
              {linkedRx && (
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Line items ({linkedRx.id} — {linkedRx.diagnosis})</div>
                  <div className="rounded-xl border divide-y">
                    {linkedRx.medicines.map((m, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.dosage} · {m.frequency} · {m.duration}</div>
                        </div>
                        <div className="tabular-nums text-sm">₹{(m.unitPrice ?? 0).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between rounded-xl bg-muted/40 px-3 py-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">₹{viewing.amount.toFixed(2)}</span>
              </div>
              {viewing.status !== "Paid" && (
                <div className="rounded-xl border p-3 space-y-2">
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
            {viewing && viewing.status !== "Paid" && (
              <Button onClick={markPaidFromDialog} disabled={isRecordingPayment}>
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
