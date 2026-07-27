import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/forms/file-uploader";
import { useWorkspaceData } from "@/lib/workspace-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/doctors/new")({ component: NewDoctor });

function Field({ label, span = 6, children }: { label: string; span?: number; children: React.ReactNode }) {
  return (
    <div className={`md:col-span-${span} space-y-1.5`}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NewDoctor() {
  const navigate = useNavigate();
  const { createDoctor } = useWorkspaceData();
  const [name, setName] = React.useState("");
  const [specialty, setSpecialty] = React.useState("");
  const [gender, setGender] = React.useState<"female" | "male" | "other" | "">("");
  const [qualification, setQualification] = React.useState("");
  const [medicalRegistrationNumber, setMedicalRegistrationNumber] = React.useState("");
  const [experienceYears, setExperienceYears] = React.useState(0);
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [consultationFee, setConsultationFee] = React.useState(0);
  const [workingHours, setWorkingHours] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !specialty.trim() || !qualification.trim() ||
      !medicalRegistrationNumber.trim() || !email.trim() || !phone.trim()) {
      toast.error("Name, credentials, specialty, email and phone are required");
      return;
    }
    setSaving(true);
    try {
      const doctor = await createDoctor({
        name: name.trim(),
        specialty: specialty.trim(),
        email: email.trim(),
        phone: phone.trim(),
        gender,
        qualification: qualification.trim(),
        medicalRegistrationNumber: medicalRegistrationNumber.trim(),
        experienceYears,
        consultationFee,
        workingHours: workingHours.trim(),
        notes: notes.trim(),
        photo,
      });
      toast.success(`${doctor.name} invited at ${email}`);
      if (doctor.photoWarning) toast.warning(doctor.photoWarning);
      navigate({ to: "/app/doctors" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invite doctor");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeader title="Add doctor" description="Register a new practitioner in your clinic." />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-4 font-display text-base font-semibold">Personal information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Full name" span={4}><Input required className="h-11 rounded-xl" placeholder="Dr. Amelia Chen" value={name} onChange={event => setName(event.target.value)} /></Field>
              <Field label="Gender" span={2}>
                <Select value={gender} onValueChange={value => setGender(value as typeof gender)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Specialty" span={3}><Input required className="h-11 rounded-xl" placeholder="General Medicine" value={specialty} onChange={event => setSpecialty(event.target.value)} /></Field>
              <Field label="Qualification" span={3}><Input required value={qualification} onChange={event => setQualification(event.target.value)} className="h-11 rounded-xl" placeholder="MBBS, MD" /></Field>
              <Field label="Medical registration No." span={3}><Input required value={medicalRegistrationNumber} onChange={event => setMedicalRegistrationNumber(event.target.value)} className="h-11 rounded-xl" placeholder="MCI-123456" /></Field>
              <Field label="Experience (years)" span={3}><Input required min={0} max={80} type="number" value={experienceYears} onChange={event => setExperienceYears(Number(event.target.value))} className="h-11 rounded-xl" placeholder="8" /></Field>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-1 font-display text-base font-semibold">Contact & login credentials</h2>
            <p className="mb-4 text-xs text-muted-foreground">A secure invitation link will be sent to the doctor so they can set a password.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Email (login ID)" span={3}><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl" placeholder="amelia@clinic.com" /></Field>
              <Field label="Phone" span={3}><Input required className="h-11 rounded-xl" placeholder="+91 98765 43210" value={phone} onChange={event => setPhone(event.target.value)} /></Field>
              <Field label="Consultation fee (₹)" span={3}><Input required min={0} max={10000000} step="0.01" value={consultationFee} onChange={event => setConsultationFee(Number(event.target.value))} type="number" className="h-11 rounded-xl" placeholder="500" /></Field>
              <Field label="Working hours" span={3}><Input value={workingHours} onChange={event => setWorkingHours(event.target.value)} className="h-11 rounded-xl" placeholder="9:00 AM – 5:00 PM" /></Field>
              <Field label="Notes" span={6}><Textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} rows={2} className="rounded-xl" placeholder="Available on weekends, etc." /></Field>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-3 font-display text-base font-semibold">Doctor photo</h2>
            <FileUploader label="Upload photo" accept="image/jpeg,image/png" hint="JPG or PNG · up to 5 MB" maxSizeBytes={5 * 1024 * 1024} onFile={setPhoto} />
          </section>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: "/app/doctors" })}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Inviting..." : "Invite doctor"}</Button>
          </div>
        </aside>
      </form>
    </>
  );
}
