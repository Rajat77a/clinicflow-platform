import re

with open('src/routes/app.users.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''      setIsSending(true);
      try {
        let res;
        let roleTitle = "";

        if (inviteStaffForm.role === "doctor") {
          res = await createDoctor({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            specialty: inviteStaffForm.specialty.trim() || "General Medicine",
            qualification: "MBBS",
            medicalRegistrationNumber: \REG-\\,
            experienceYears: 5,
            gender: "other",
            consultationFee: 500,
            workingHours: "9:00 AM - 5:00 PM",
            notes: "",
            hospitalId: inviteStaffForm.hospitalId,
          });
          roleTitle = "Doctor";
        } else if (inviteStaffForm.role === "receptionist") {
          res = await createReceptionist({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            shift: inviteStaffForm.shift.trim() || "Morning (9 AM - 5 PM)",
            hospitalId: inviteStaffForm.hospitalId,
          });
          roleTitle = "Receptionist";
        } else if (inviteStaffForm.role === "clinic_admin") {
          res = await inviteClinicAdmin({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            hospitalId: inviteStaffForm.hospitalId,
          });
          roleTitle = "Clinic Admin";
        } else if (inviteStaffForm.role === "super_admin") {
          res = await inviteSuperAdmin({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            tempPassword: generateTempPassword(),
          });
          roleTitle = "Super Admin";
        }

        if (res) {
          setCreatedStaffInfo({
            roleTitle,
            staffName: res.data.name,
            staffEmail: res.data.email,
            setupUrl: res.setupUrl,
            emailSent: res.emailSent,
            emailId: res.emailId,
            emailError: res.emailError,
          });
        }

        setInviteStaffDialogOpen(false);
        setInviteStaffForm({'''

start_idx = content.find('const submitInviteStaff = async () => {')
if start_idx != -1:
    end_idx = content.find('setInviteStaffForm({', start_idx)
    if end_idx != -1:
        # Find the setIsSending(true); before end_idx
        set_is_sending_idx = content.rfind('setIsSending(true);', start_idx, end_idx)
        if set_is_sending_idx != -1:
            new_content = content[:set_is_sending_idx] + replacement + content[end_idx + len('setInviteStaffForm({'):]
            with open('src/routes/app.users.tsx', 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Successfully updated")
        else:
            print("setIsSending not found")
    else:
        print("setInviteStaffForm not found")
else:
    print("submitInviteStaff not found")

