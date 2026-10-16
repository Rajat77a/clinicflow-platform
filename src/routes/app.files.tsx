import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, FolderOpen } from "lucide-react";
import { PaginationFooter } from "@/components/data/pagination-footer";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRecordPage } from "@/lib/use-record-page";
import { useWorkspaceData, type WorkspaceDocument } from "@/lib/workspace-data";

export const Route = createFileRoute("/app/files")({ component: FilesPage });

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function groupByPatient(documents: WorkspaceDocument[]) {
  const groups = new Map<string, WorkspaceDocument[]>();
  for (const document of documents) {
    const patient = document.patientId ? document.patient : "Unassigned documents";
    groups.set(patient, [...(groups.get(patient) ?? []), document]);
  }
  return Array.from(groups.entries());
}

function FilesPage() {
  const { listDocuments } = useWorkspaceData();
  const {
    rows: documents,
    total,
    limit,
    offset,
    setOffset,
    isLoading,
    error,
  } = useRecordPage(listDocuments);
  const groups = groupByPatient(documents);

  return (
    <>
      <PageHeader
        title="Files"
        description="Uploaded patient documents grouped by patient."
      />

      <div className="space-y-4">
        {isLoading && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
            Loading patient documents...
          </div>
        )}
        {!isLoading && error && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-destructive shadow-soft">
            {error}
          </div>
        )}
        {!isLoading && !error && groups.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-soft">
            <FolderOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No uploaded patient documents found.</p>
          </div>
        )}

        {groups.map(([patient, patientDocuments]) => {
          const patientId = patientDocuments.find((document) => document.patientId)?.patientId;
          return (
            <section key={patient} className="rounded-2xl border bg-card shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <h2 className="font-display text-base font-semibold">{patient}</h2>
                  <p className="text-xs text-muted-foreground">
                    {patientDocuments.length} uploaded document{patientDocuments.length === 1 ? "" : "s"}
                  </p>
                </div>
                {patientId && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/patients/$id" params={{ id: patientId }}>
                      Open patient
                    </Link>
                  </Button>
                )}
              </div>
              <div className="divide-y">
                {patientDocuments.map((document) => (
                  <div key={document.id} className="flex items-start gap-3 px-5 py-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{document.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{document.category}</Badge>
                        <span>{formatBytes(document.sizeBytes)}</span>
                        <span>{document.date}</span>
                        <span>Uploaded by {document.uploadedBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <PaginationFooter
        offset={offset}
        limit={limit}
        total={total}
        onOffsetChange={setOffset}
        disabled={isLoading}
      />
    </>
  );
}
