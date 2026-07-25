import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { payments, clinics, SUBSCRIPTION_PRICE } from "@/lib/sample-data";
import { CheckCircle2, Eye, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/payments")({ component: PaymentsPage });

function PaymentsPage() {
  const [clinic, setClinic] = useState<string>(clinics[0]?.id ?? "");
  const [method, setMethod] = useState("bank");
  const [txn, setTxn] = useState("");
  const [amount, setAmount] = useState(String(SUBSCRIPTION_PRICE));
  const [open, setOpen] = useState(false);

  const submit = () => {
    if (!clinic) return toast.error("Select a clinic");
    if (!txn.trim()) return toast.error("Transaction ID required");
    if (!amount.trim()) return toast.error("Amount required");
    const c = clinics.find(x => x.id === clinic);
    toast.success(`Submitted ₹${amount} for ${c?.name} · logged under ${c?.id}`);
    setOpen(false); setTxn(""); setAmount(String(SUBSCRIPTION_PRICE));
  };

  return (
    <>
      <PageHeader
        title="Payments"
        description="Submitted clinic payments awaiting verification. Every transaction is stored under an individual clinic."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>Submit Payment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Submit a payment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Clinic <span className="text-destructive">*</span></Label>
                  <Select value={clinic} onValueChange={setClinic}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select clinic" /></SelectTrigger>
                    <SelectContent>
                      {clinics.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Transaction will be filed under this clinic's ledger.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpay">Google Pay</SelectItem>
                      <SelectItem value="phonepe">PhonePe</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Transaction ID</Label><Input className="rounded-xl" placeholder="TXN…" value={txn} onChange={e => setTxn(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Amount (₹)</Label><Input className="rounded-xl" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Payment screenshot</Label>
                  <div className="grid place-items-center rounded-xl border-2 border-dashed bg-muted/30 px-4 py-8 text-center">
                    <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
                    <div className="text-sm">Click to upload</div>
                    <div className="text-xs text-muted-foreground">PNG or JPG · up to 5 MB</div>
                  </div>
                </div>
                <Button className="w-full" onClick={submit}>Submit</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell className="font-semibold">{p.clinic}</TableCell>
                <TableCell>{p.method}</TableCell>
                <TableCell className="text-right tabular-nums">₹{p.amount}</TableCell>
                <TableCell className="font-mono text-xs">{p.txn}</TableCell>
                <TableCell className="text-muted-foreground">{p.date}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "Verified" ? "secondary" : "outline"}>
                    {p.status === "Verified" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}{p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label={`View ${p.id}`} title={`View ${p.id}`} onClick={() => toast.info("Payment details are unavailable in demo mode")}><Eye className="h-4 w-4" /></Button>
                    {p.status === "Pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => toast.success("Verified")}>Verify</Button>
                        <Button size="icon" variant="ghost" aria-label={`Reject ${p.id}`} title={`Reject ${p.id}`} onClick={() => toast.info("Payment rejection is unavailable in demo mode")}><X className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
