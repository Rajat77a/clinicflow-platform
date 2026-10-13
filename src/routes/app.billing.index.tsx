import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PaginationFooter } from "@/components/data/pagination-footer";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/access-control";
import { useRecordPage } from "@/lib/use-record-page";
import { useWorkspaceData, type Bill } from "@/lib/workspace-data";

export const Route = createFileRoute("/app/billing/")({ component: BillingPage });

function BillingPage() {
  const { user } = useAuth();
  const { listBills, updateBill, updateBillNotes } = useWorkspaceData();
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
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const canEditNotes = user?.role === "clinic_admin" || user?.role === "receptionist" || user?.role === "super_admin";
  const canWriteBilling = user ? hasPermission(user.role, "billing.write") : false;

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
        actions={canWriteBilling ? <Button asChild><Link to="/app/billing/new">Create bill</Link></Button> : null}
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

      <Dialog
        open={Boolean(viewing)}
        onOpenChange={(open) => {
          if (!open) {
            setViewing(null);
            setIsEditingNotes(false);
            setNotesDraft("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invoice {viewing?.id}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Patient</div><div className="font-semibold">{viewing.patient}</div></div>
                <div><div className="text-xs text-muted-foreground">Date</div><div>{viewing.date}</div></div>
                <div><div className="text-xs text-muted-foreground">Method</div><div>{viewing.method}</div></div>
                <div><div className="text-xs text-muted-foreground">Status</div><Badge variant={viewing.status === "Paid" ? "secondary" : "outline"}>{viewing.status}</Badge></div>
              </div>

              {viewing.items && viewing.items.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Line items</div>
                  <div className="rounded-xl border divide-y max-h-56 overflow-y-auto">
                    {viewing.items.map((item, index) => (
                      <div key={`${item.category}-${item.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.category} · {item.qty} × ₹{item.unit.toFixed(2)}</div>
                        </div>
                        <div className="shrink-0 tabular-nums text-sm">₹{(item.qty * item.unit).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between rounded-xl bg-muted/40 px-3 py-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">INR {viewing.amount.toFixed(2)}</span>
              </div>

              {/* Notes section with post-creation editing for Clinical Admin & Receptionist */}
              <div className="rounded-xl border p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Notes / Remarks</div>
                  {canEditNotes && !isEditingNotes && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary"
                      onClick={() => {
                        setNotesDraft(viewing.notes ?? "");
                        setIsEditingNotes(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      {viewing.notes ? "Edit note" : "Add note"}
                    </Button>
                  )}
                </div>
                {isEditingNotes ? (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      placeholder="Add additional bill notes, remarks or payment adjustments..."
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      className="text-xs min-h-[70px] resize-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        disabled={isSavingNotes}
                        onClick={() => {
                          setIsEditingNotes(false);
                          setNotesDraft("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs px-3"
                        disabled={isSavingNotes}
                        onClick={async () => {
                          setIsSavingNotes(true);
                          try {
                            await updateBillNotes(viewing.id, notesDraft);
                            setViewing(prev => prev ? { ...prev, notes: notesDraft.trim() || undefined } : null);
                            setIsEditingNotes(false);
                            toast.success("Bill notes updated successfully");
                          } catch (err: any) {
                            toast.error(err?.message || "Failed to update notes");
                          } finally {
                            setIsSavingNotes(false);
                          }
                        }}
                      >
                        {isSavingNotes ? "Saving..." : "Save note"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap italic">
                    {viewing.notes ? viewing.notes : "No notes added to this invoice yet."}
                  </p>
                )}
              </div>

              {canWriteBilling && viewing.status !== "Paid" && (
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
            {canWriteBilling && viewing?.status !== "Paid" && (
              <Button onClick={markPaid} disabled={isRecordingPayment}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {isRecordingPayment ? "Recording..." : "Mark as paid"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setViewing(null);
                setIsEditingNotes(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
