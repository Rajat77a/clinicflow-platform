import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import { PaginationFooter } from "@/components/data/pagination-footer";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRecordPage } from "@/lib/use-record-page";
import { useWorkspaceData } from "@/lib/workspace-data";

export const Route = createFileRoute("/app/audit-logs")({ component: AuditLogs });

function AuditLogs() {
  const { listAuditLogs } = useWorkspaceData();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const {
    rows,
    total,
    limit,
    offset,
    setOffset,
    isLoading,
    error,
  } = useRecordPage(listAuditLogs, { query: deferredQuery });

  return (
    <>
      <PageHeader title="Audit logs" description="Every action taken in the platform, signed and timestamped." />
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by action..."
              className="h-10 rounded-xl bg-muted/30 pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Loading audit events...</TableCell></TableRow>
            )}
            {!isLoading && error && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-destructive">{error}</TableCell></TableRow>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No audit events found.</TableCell></TableRow>
            )}
            {rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-semibold">{entry.user}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell className="text-muted-foreground">{entry.date}</TableCell>
                <TableCell className="font-mono text-xs">{entry.time}</TableCell>
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
    </>
  );
}
