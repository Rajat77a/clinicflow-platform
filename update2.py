import re

with open('src/routes/app.users.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the inviteStaffForm state
new_state = '''const [inviteStaffForm, setInviteStaffForm] = useState<{
    role: Role;
    name: string;
    email: string;
    phone: string;
    hospitalId: string;
    specialty: string;
    shift: string;
    gender: string;
    qualification: string;
    medicalRegistrationNumber: string;
    experienceYears: number;
    consultationFee: number;
    workingHours: string;
    notes: string;
  }>({
    role: "doctor",
    name: "",
    email: "",
    phone: "",
    hospitalId: clinics[0]?.id || "",
    specialty: "General Medicine",
    shift: "Morning (9 AM - 5 PM)",
    gender: "other",
    qualification: "",
    medicalRegistrationNumber: "",
    experienceYears: 0,
    consultationFee: 500,
    workingHours: "9:00 AM - 5:00 PM",
    notes: "",
  });'''

content = re.sub(
    r'const \[inviteStaffForm, setInviteStaffForm\] = useState<\s*\{\s*role: Role;.*?\}\s*>\(\{\s*role: "doctor",.*?(?=const \[deactivationTarget, setDeactivationTarget\])',
    new_state + '\n\n  ',
    content,
    flags=re.DOTALL
)

# Replace the createDoctor call inside submitInviteStaff
new_create = '''res = await createDoctor({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            specialty: inviteStaffForm.specialty.trim() || "General Medicine",
            qualification: inviteStaffForm.qualification.trim() || "MBBS",
            medicalRegistrationNumber: inviteStaffForm.medicalRegistrationNumber.trim() || REG-\,
            experienceYears: inviteStaffForm.experienceYears || 0,
            gender: inviteStaffForm.gender as any || "other",
            consultationFee: inviteStaffForm.consultationFee || 500,
            workingHours: inviteStaffForm.workingHours.trim() || "9:00 AM - 5:00 PM",
            notes: inviteStaffForm.notes.trim(),
            hospitalId: inviteStaffForm.hospitalId,
          });'''

content = re.sub(
    r'res = await createDoctor\(\{[^}]+\}\);',
    new_create,
    content,
    flags=re.DOTALL
)

# Replace the reset inside submitInviteStaff
new_reset = '''setInviteStaffForm({
          role: "doctor",
          name: "",
          email: "",
          phone: "",
          hospitalId: clinics[0]?.id || "",
          specialty: "General Medicine",
          shift: "Morning (9 AM - 5 PM)",
          gender: "other",
          qualification: "",
          medicalRegistrationNumber: "",
          experienceYears: 0,
          consultationFee: 500,
          workingHours: "9:00 AM - 5:00 PM",
          notes: "",
        });'''

content = re.sub(
    r'setInviteStaffForm\(\{\s*role: "doctor",\s*name: "",\s*email: "",\s*phone: "",\s*hospitalId: clinics\[0\]\?\.id \|\| "",\s*specialty: "General Medicine",\s*shift: "Morning \(9[^)]+\)",\s*\}\);',
    new_reset,
    content,
    flags=re.DOTALL
)

# Replace the JSX for doctor role
new_jsx = '''{inviteStaffForm.role === "doctor" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Medical Specialty</Label>
                        <Input
                          value={inviteStaffForm.specialty}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, specialty: e.target.value })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. Cardiology, Pediatrics"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gender</Label>
                        <Select value={inviteStaffForm.gender} onValueChange={(value) => setInviteStaffForm({ ...inviteStaffForm, gender: value })}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Qualification</Label>
                        <Input
                          value={inviteStaffForm.qualification}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, qualification: e.target.value })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. MBBS, MD"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Medical Registration No.</Label>
                        <Input
                          value={inviteStaffForm.medicalRegistrationNumber}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, medicalRegistrationNumber: e.target.value })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. MCI-123456"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Experience (years)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={inviteStaffForm.experienceYears}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, experienceYears: Number(e.target.value) })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. 5"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Consultation Fee (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={inviteStaffForm.consultationFee}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, consultationFee: Number(e.target.value) })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. 500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Working Hours</Label>
                        <Input
                          value={inviteStaffForm.workingHours}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, workingHours: e.target.value })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. 9:00 AM - 5:00 PM"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={inviteStaffForm.notes}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, notes: e.target.value })}
                          className="rounded-xl"
                          placeholder="Available on weekends, etc."
                        />
                      </div>
                    </div>
                  )}'''

content = re.sub(
    r'\{inviteStaffForm\.role === "doctor" && \(\s*<div className="space-y-1\.5">\s*<Label>Medical Specialty</Label>\s*<Input[^>]+/>\s*</div>\s*\)\}',
    new_jsx,
    content,
    flags=re.DOTALL
)

with open('src/routes/app.users.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
