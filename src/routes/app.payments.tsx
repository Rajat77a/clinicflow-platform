import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { payments as seedPayments } from "@/lib/sample-data";
import { CheckCircle2, Clock3, IndianRupee, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/payments")({ component: PaymentsPage });

type Payment = (typeof seedPayments)[number];

function statusBadge(status: Payment["status"]) {
  if (status === "Verified") return <Badge variant="secondary">Verified</Badge>;
  return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Pending</Badge>;
}

function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>(seedPayments);
  const [query, setQuery] = useState("");

  const visiblePayments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return payments;
    return payments.filter((payment) =>
      [payment.id, payment.clinic, payment.method, payment.txn, payment.status]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [payments, query]);

  const verifiedTotal = payments
    .filter((payment) => payment.status === "Verified")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingTotal = payments
    .filter((payment) => payment.status === "Pending")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const verifyPayment = (paymentId: string) => {
    setPayments((current) =>
      current.map((payment) =>
        payment.id === paymentId ? { ...payment, status: "Verified" } : payment,
      ),
    );
    toast.success(`Payment ${paymentId} verified`);
  };

  return (
    <>
      <PageHeader
        title="Payments"
        description="Review subscription payment references and mark verified collections."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Verified collections"
          value={`Rs ${verifiedTotal.toLocaleString()}`}
          tone="success"
          icon={<IndianRupee className="h-4 w-4" />}
        />
        <StatCard
          label="Pending review"
          value={`Rs ${pendingTotal.toLocaleString()}`}
          tone="warning"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <StatCard
          label="Verified payments"
          value={payments.filter((payment) => payment.status === "Verified").length.toString()}
          tone="info"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clinic, transaction or status"
              className="h-10 rounded-xl bg-muted/30 pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiblePayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                  <TableCell className="font-semibold">{payment.clinic}</TableCell>
                  <TableCell className="text-muted-foreground">{payment.method}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{payment.txn}</TableCell>
                  <TableCell className="text-muted-foreground">{payment.date}</TableCell>
                  <TableCell className="text-right tabular-nums">Rs {payment.amount.toLocaleString()}</TableCell>
                  <TableCell>{statusBadge(payment.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={payment.status === "Verified" ? "outline" : "default"}
                      disabled={payment.status === "Verified"}
                      onClick={() => verifyPayment(payment.id)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Verify
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {visiblePayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No payments match this search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
