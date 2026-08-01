import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceData } from "@/lib/workspace-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/patients/new")({ component: NewPatient });

function Field({ label, span = 6, children }: { label: string; span?: number; children: React.ReactNode }) {
  return (
    <div className={`md:col-span-${span} space-y-1.5`}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NewPatient() {
  const navigate = useNavigate();
  const { createPatient, doctors } = useWorkspaceData();
  const activeDoctors = doctors.filter(doctor => doctor.status === "Active");
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [doctorId, setDoctorId] = useState(activeDoctors[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error("Full name is required");
    if (!dateOfBirth || new Date(dateOfBirth) > new Date()) {
      return toast.error("Enter a valid date of birth");
    }
    if (!gender) return toast.error("Select a gender");
    if (!phone.trim()) return toast.error("Phone is required");
    if (!doctorId) return toast.error("Assign a doctor");
    setSaving(true);
    try {
      const patient = await createPatient({
        name: name.trim(),
        dateOfBirth,
        gender,
        phone: phone.trim(),
        doctorId,
        bloodGroup: bloodGroup || undefined,
        email: email.trim() || undefined,
        whatsappPhone: whatsappPhone.trim() || undefined,
        address: address.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        allergies: allergies.split(",").map(value => value.trim()).filter(Boolean),
        chronicConditions: chronicConditions.split(",").map(value => value.trim()).filter(Boolean),
      });
      toast.success(`Patient ${patient.medicalRecordNumber ?? patient.id} registered`);
      navigate({ to: "/app/patients/$id", params: { id: patient.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to register patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Register patient" description="Capture demographic, contact and medical info." />
      <form onSubmit={submit}
        className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-4 font-display text-base font-semibold">Personal information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Full name" span={4}><Input className="h-11 rounded-xl" placeholder="Liam Andersson" value={name} onChange={event => setName(event.target.value)} /></Field>
              <Field label="Date of birth" span={2}><Input type="date" max={new Date().toISOString().slice(0, 10)} className="h-11 rounded-xl" value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} /></Field>
              <Field label="Gender" span={2}>
                <Select value={gender} onValueChange={setGender}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="unknown">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Blood group" span={2}>
                <Select value={bloodGroup} onValueChange={setBloodGroup}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Assigned doctor" span={6}>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>{activeDoctors.map(item => <SelectItem key={item.id} value={item.id}>{item.name} · {item.specialty}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-4 font-display text-base font-semibold">Contact</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Phone" span={3}><Input required maxLength={40} className="h-11 rounded-xl" value={phone} onChange={event => setPhone(event.target.value)} /></Field>
              <Field label="Email" span={3}><Input type="email" maxLength={254} className="h-11 rounded-xl" value={email} onChange={event => setEmail(event.target.value)} /></Field>
              <Field label="WhatsApp" span={3}><Input maxLength={40} className="h-11 rounded-xl" value={whatsappPhone} onChange={event => setWhatsappPhone(event.target.value)} /></Field>
              <Field label="Address" span={6}><Textarea maxLength={1000} rows={2} className="rounded-xl" value={address} onChange={event => setAddress(event.target.value)} /></Field>
              <Field label="Emergency contact name" span={3}><Input maxLength={200} className="h-11 rounded-xl" value={emergencyContactName} onChange={event => setEmergencyContactName(event.target.value)} /></Field>
              <Field label="Emergency contact phone" span={3}><Input maxLength={40} className="h-11 rounded-xl" value={emergencyContactPhone} onChange={event => setEmergencyContactPhone(event.target.value)} /></Field>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-4 font-display text-base font-semibold">Medical</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Allergies" span={3}><Input maxLength={1000} value={allergies} onChange={event => setAllergies(event.target.value)} className="h-11 rounded-xl" placeholder="None / penicillin / …" /></Field>
              <Field label="Existing conditions" span={3}><Input maxLength={1000} value={chronicConditions} onChange={event => setChronicConditions(event.target.value)} className="h-11 rounded-xl" placeholder="Hypertension, asthma…" /></Field>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: "/app/patients" })}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving..." : "Save patient"}</Button>
          </div>
        </aside>
      </form>
    </>
  );
}
