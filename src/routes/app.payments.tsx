import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceData } from "@/lib/workspace-data";
import { CheckCircle2, Clock3, IndianRupee, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/payments")({ component: PaymentsPage });

function PaymentsPage() {
  const { bills, clinics } = useWorkspaceData();
  const [query, setQuery] = useState("");

  const paidBills = bills.filter(b => b.status === "Paid");
  const pendingBills = bills.filter(b => b.status !== "Paid");

  const visibleBills = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return paidBills;
    return paidBills.filter(b =>
      [b.id, b.patient, b.method, b.status]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [paidBills, query]);

  const verifiedTotal = paidBills.reduce((sum, b) => sum + b.amount, 0);
  const pendingTotal = pendingBills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Review billing payments and collections."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Collected"
          value={`₹${verifiedTotal.toLocaleString("en-IN")}`}
          tone="success"
          icon={<IndianRupee className="h-4 w-4" />}
        />
        <StatCard
          label="Pending"
          value={`₹${pendingTotal.toLocaleString("en-IN")}`}
          tone="warning"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <StatCard
          label="Paid invoices"
          value={paidBills.length.toString()}
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
              placeholder="Search invoice, patient or status"
              className="h-10 rounded-xl bg-muted/30 pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleBills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-mono text-xs">{bill.id}</TableCell>
                  <TableCell className="font-semibold">{bill.patient}</TableCell>
                  <TableCell className="text-muted-foreground">{bill.date}</TableCell>
                  <TableCell className="text-muted-foreground">{bill.method || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">₹{bill.amount.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Badge variant={bill.status === "Paid" ? "secondary" : bill.status === "Overdue" ? "destructive" : "outline"}>
                      {bill.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {visibleBills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No paid invoices found.
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
