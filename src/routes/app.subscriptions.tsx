import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceData } from "@/lib/workspace-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/subscriptions")({ component: SubscriptionsPage });

function badgeFor(days: number) {
  if (days < 0) return <Badge variant="destructive">Expired {Math.abs(days)}d ago</Badge>;
  if (days <= 1) return <Badge variant="destructive">1 day left</Badge>;
  if (days <= 3) return <Badge variant="destructive">{days} days left</Badge>;
  if (days <= 7) return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">{days} days left</Badge>;
  if (days <= 15) return <Badge variant="outline">{days} days left</Badge>;
  return <Badge variant="secondary">{days} days left</Badge>;
}

type SubscriptionRow = { id: string; clinic: string; price: number; renews: string; daysLeft: number; status: string };

function SubTable({ rows, onExtend }: { rows: SubscriptionRow[]; onExtend: (id: string, days: number, proof?: string) => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clinic</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Renews</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Extend (days)</TableHead>
            <TableHead className="text-right">Reminder / payment proof</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-semibold">{s.clinic}</TableCell>
              <TableCell className="text-right tabular-nums">₹{s.price}</TableCell>
              <TableCell className="text-muted-foreground">{s.renews}</TableCell>
              <TableCell>{badgeFor(s.daysLeft)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    placeholder="30"
                    className="h-8 w-20 rounded-lg"
                    value={drafts[s.id] ?? ""}
                    onChange={(e) => setDrafts({ ...drafts, [s.id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    disabled={saving === s.id}
                    onClick={async () => {
                      const days = Number(drafts[s.id]);
                      if (!Number.isFinite(days) || days <= 0) return toast.error("Enter number of days");
                      setSaving(s.id);
                      try {
                        await onExtend(s.id, days, proofs[s.id]);
                        toast.success(`${s.clinic} extended by ${days} days`);
                        setDrafts((current) => ({ ...current, [s.id]: "" }));
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Unable to extend subscription");
                      } finally {
                        setSaving(null);
                      }
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Input
                    placeholder="Proof ref"
                    className="h-8 w-28 rounded-lg"
                    value={proofs[s.id] ?? ""}
                    onChange={(event) => setProofs({ ...proofs, [s.id]: event.target.value })}
                  />
                  <Button size="sm" variant="outline" onClick={() => toast.success(`Reminder sent to ${s.clinic}`)}>Send reminder</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SubscriptionsPage() {
  const { clinics, extendSubscription } = useWorkspaceData();
  const [loadedAt] = useState(() => new Date().getTime());
  const subs = clinics.map(c => ({
    id: c.id,
    clinic: c.name,
    price: c.price,
    renews: c.expires,
    daysLeft: Math.ceil((new Date(`${c.expires}T23:59:59`).getTime() - loadedAt) / (1000 * 60 * 60 * 24)),
    status: c.status,
  }));

  const active = subs.filter(s => s.status === "Active");
  const expiring = subs.filter(s => s.daysLeft >= 0 && s.daysLeft <= 15);
  const expired = subs.filter(s => s.status === "Expired");

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Single ClinicFlow plan. Enter renewal days manually — e.g. 30 for one month, 60 for two months."
      />
      <Tabs defaultValue="all">
        <TabsList className="rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="all" className="rounded-lg">All ({subs.length})</TabsTrigger>
          <TabsTrigger value="active" className="rounded-lg">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="expiring" className="rounded-lg">Expiring ({expiring.length})</TabsTrigger>
          <TabsTrigger value="expired" className="rounded-lg">Expired ({expired.length})</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">Renewal history</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4"><SubTable rows={subs} onExtend={extendSubscription} /></TabsContent>
        <TabsContent value="active" className="mt-4"><SubTable rows={active} onExtend={extendSubscription} /></TabsContent>
        <TabsContent value="expiring" className="mt-4"><SubTable rows={expiring} onExtend={extendSubscription} /></TabsContent>
        <TabsContent value="expired" className="mt-4"><SubTable rows={expired} onExtend={extendSubscription} /></TabsContent>
        <TabsContent value="history" className="mt-4"><SubTable rows={subs} onExtend={extendSubscription} /></TabsContent>
      </Tabs>
    </>
  );
}
