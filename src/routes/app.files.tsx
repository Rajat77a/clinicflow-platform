import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, ImageIcon, FlaskConical, FileBarChart, Upload, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/files")({ component: FilesPage });

const FILES = [
  { name: "Blood panel — Liam Andersson.pdf", patient: "Liam Andersson", size: "412 KB", date: "2026-06-12", type: "Lab Report", icon: FlaskConical },
  { name: "MRI scan — Sophia Romano.jpg", patient: "Sophia Romano", size: "2.1 MB", date: "2026-06-08", type: "Image", icon: ImageIcon },
  { name: "Discharge summary — Noah Petersen.pdf", patient: "Noah Petersen", size: "180 KB", date: "2026-06-04", type: "Medical Document", icon: FileText },
  { name: "Annual report 2025.pdf", patient: "—", size: "1.6 MB", date: "2026-01-10", type: "Uploaded Report", icon: FileBarChart },
  { name: "ECG strip — Emma Bauer.png", patient: "Emma Bauer", size: "920 KB", date: "2026-06-15", type: "Image", icon: ImageIcon },
  { name: "X-Ray chest — Mateo Hernández.jpg", patient: "Mateo Hernández", size: "3.4 MB", date: "2026-06-14", type: "Image", icon: ImageIcon },
];

function Grid({ filter }: { filter?: string }) {
  const items = filter ? FILES.filter(f => f.type === filter) : FILES;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((f) => {
        const Icon = f.icon;
        return (
          <div key={f.name} className="group rounded-2xl border bg-card p-4 shadow-soft transition-all hover:shadow-card">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{f.name}</div>
                <div className="text-xs text-muted-foreground">{f.patient} · {f.size}</div>
                <div className="mt-1 text-xs text-muted-foreground">{f.date}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                aria-label={`Download ${f.name}`}
                title={`Download ${f.name}`}
                onClick={() => toast.info("File download is unavailable in demo mode")}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FilesPage() {
  return (
    <>
      <PageHeader title="Files" description="Uploaded reports, lab results, scans and documents."
        actions={<Button><Upload className="mr-1.5 h-4 w-4" /> Upload file</Button>} />
      <Tabs defaultValue="all">
        <TabsList className="rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg">Reports</TabsTrigger>
          <TabsTrigger value="medical" className="rounded-lg">Medical</TabsTrigger>
          <TabsTrigger value="lab" className="rounded-lg">Lab</TabsTrigger>
          <TabsTrigger value="images" className="rounded-lg">Images</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4"><Grid /></TabsContent>
        <TabsContent value="reports" className="mt-4"><Grid filter="Uploaded Report" /></TabsContent>
        <TabsContent value="medical" className="mt-4"><Grid filter="Medical Document" /></TabsContent>
        <TabsContent value="lab" className="mt-4"><Grid filter="Lab Report" /></TabsContent>
        <TabsContent value="images" className="mt-4"><Grid filter="Image" /></TabsContent>
      </Tabs>
    </>
  );
}
