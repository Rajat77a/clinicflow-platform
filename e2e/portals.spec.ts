import { expect, test, type Page } from "@playwright/test";

type DemoRole = "Super Admin" | "Clinic Admin" | "Doctor" | "Receptionist";

async function signIn(page: Page, role: DemoRole) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const probeRole = role === "Clinic Admin" ? "Super Admin" : "Clinic Admin";
  const probeButton = page.getByRole("button", { name: probeRole, exact: true });
  await probeButton.click();
  await expect(probeButton).toHaveClass(/border-primary/);

  const roleButton = page.getByRole("button", { name: role, exact: true });
  await roleButton.click();
  await expect(roleButton).toHaveClass(/border-primary/);
  await page
    .getByLabel("Work email")
    .fill(`${role.toLowerCase().replaceAll(" ", ".")}@example.test`);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("DemoOnly#2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("password recovery does not submit the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset your password" });
  await page.locator('[role="dialog"] input[type="email"]').fill("recovery@example.test");
  await dialog.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText("Demo reset flow opened")).toBeVisible();
  await expect(page.getByText("Email address is required")).toHaveCount(0);
});

test("super admin can invite a clinic admin but cannot enter clinical records", async ({
  page,
}) => {
  await signIn(page, "Super Admin");
  await page.goto("/app/users");

  await page.getByRole("button", { name: "Invite Clinic Admin" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite Clinic Admin" });
  const inputs = dialog.locator("input");
  await inputs.nth(0).fill("E2E Clinic Administrator");
  await inputs.nth(1).fill("e2e.clinic.admin@example.test");
  await inputs.nth(2).fill("+91 90000 00001");
  await dialog.getByRole("button", { name: "Send invitation" }).click();

  await expect(page.getByText("E2E Clinic Administrator", { exact: true })).toBeVisible();
  await page.goto("/app/patients");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
});

test("clinic admin can register a patient", async ({ page }) => {
  await signIn(page, "Clinic Admin");
  await page.goto("/app/patients/new");

  await page.getByPlaceholder("Liam Andersson").fill("E2E Patient");
  await page.locator('input[type="date"]').fill("1994-03-12");
  const gender = page.locator('button[role="combobox"]').nth(0);
  await gender.click();
  await page.getByRole("option", { name: "Female" }).click();

  const contact = page.locator("section").filter({ hasText: "Contact" });
  await contact.locator("input").nth(0).fill("+91 90000 00002");
  await page.getByRole("button", { name: "Save patient" }).click();

  await expect(page).toHaveURL(/\/app\/patients\/PT-/);
  await expect(page.getByRole("heading", { name: "E2E Patient", exact: true })).toBeVisible();
});

test("receptionist can book an appointment", async ({ page }) => {
  await signIn(page, "Receptionist");
  await page.goto("/app/appointments/new");

  const patient = page.getByPlaceholder(/Search by name, patient ID or phone/);
  await patient.fill("Emma Bauer");
  await patient.press("Enter");
  const timePicker = page.getByRole("button", { name: /Choose appointment time/ });
  await timePicker.click();
  await page.getByRole("listbox", { name: "Hour" }).getByRole("option", { name: "10", exact: true }).click();
  await page.getByRole("listbox", { name: "Minute" }).getByRole("option", { name: "30", exact: true }).click();
  await page.getByRole("listbox", { name: "Period" }).getByRole("option", { name: "AM", exact: true }).click();
  await expect(timePicker).toContainText("10:30 AM");
  await page.getByPlaceholder(/Reason for visit/).fill("E2E reception workflow");
  await page.getByRole("button", { name: "Book appointment" }).click();

  await expect(page).toHaveURL(/\/app\/appointments$/);
  await expect(page.getByText("Emma Bauer", { exact: true }).first()).toBeVisible();

  await page.goto("/app/doctors");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
});

test("doctor can create and sign a prescription", async ({ page }) => {
  await signIn(page, "Doctor");
  await page.goto("/app/prescriptions/new");

  const patient = page.getByPlaceholder(/Search by name, patient ID or phone/);
  await patient.fill("Emma Bauer");
  await patient.press("Enter");
  await page.getByTestId("prescription-diagnosis").fill("E2E clinical workflow");
  await page.getByPlaceholder("Medicine").fill("E2E Medicine");
  await page.getByPlaceholder("Dosage").fill("1 tablet");
  await page.getByPlaceholder("Frequency").fill("Once daily");
  await page.getByPlaceholder("Duration").fill("3 days");
  await page.getByRole("button", { name: "Save & sign" }).click();

  await expect(page).toHaveURL(/\/app\/prescriptions$/);
  await expect(page.getByText("E2E clinical workflow", { exact: true })).toBeVisible();

  await page.goto("/app/billing");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
});
