import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { notifications } from "@/lib/sample-data";
import { BellRing, CheckCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const { user } = useAuth();
  const { clinics } = useWorkspaceData();
  const [target, setTarget] = useState("all");
  const [subject, setSubject] = useState("Subscription reminder");
  const [message, setMessage] = useState("Your ClinicFlow subscription is nearing its renewal date. Please complete payment to avoid an access pause.");
  const toneMap = {
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
    success: "bg-success/15 text-success",
  } as const;

  const send = () => {
    if (!subject.trim() || !message.trim()) return toast.error("Subject and message are required");
    const name = target === "all" ? "all Clinic Admins" : clinics.find(clinic => clinic.id === target)?.name ?? "selected clinic";
    toast.success(`Notification queued for ${name}`);
  };

  return (
    <>
      <PageHeader title="Notifications" description="Send subscription reminders and custom messages to Clinic Admins."
        actions={<Button variant="outline"><CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read</Button>} />
      {user?.role === "super_admin" && (
        <section className="mb-6 grid gap-4 rounded-2xl border bg-card p-6 shadow-soft lg:grid-cols-[280px_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label>Send to</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clinic Admins</SelectItem>
                {clinics.map(clinic => <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input className="h-11 rounded-xl" value={subject} onChange={event => setSubject(event.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Message</Label>
              <Textarea rows={3} className="rounded-xl" value={message} onChange={event => setMessage(event.target.value)} />
            </div>
          </div>
          <Button onClick={send} className="h-11">
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </section>
      )}
      <div className="divide-y rounded-2xl border bg-card shadow-soft">
        {notifications.map((n, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneMap[n.type as keyof typeof toneMap]}`}>
              <BellRing className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{n.title}</div>
              <div className="text-xs text-muted-foreground">{n.time}</div>
            </div>
            <Button variant="ghost" size="sm">View</Button>
          </div>
        ))}
      </div>
    </>
  );
}
