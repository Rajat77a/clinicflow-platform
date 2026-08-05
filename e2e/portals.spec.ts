import { expect, test, type Page } from "@playwright/test";

type DemoRole = "Super Admin" | "Clinic Admin" | "Doctor" | "Receptionist";

async function signIn(page: Page, role: DemoRole) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page
    .getByLabel("Work email")
    .fill(`${role.toLowerCase().replaceAll(" ", ".")}@example.test`);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill("E2EOnly#2026ClinicFlow");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/app$/, { timeout: 10_000 });
  } catch (error) {
    const messages = await page.locator("[data-sonner-toast]").allTextContents();
    throw new Error(`Sign in failed for ${role}: ${messages.join(" | ") || "no error message"}`, {
      cause: error,
    });
  }
}

test("password recovery does not submit the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset your password" });
  await page.locator('[role="dialog"] input[type="email"]').fill("recovery@example.test");
  await dialog.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText("If the account exists, a secure reset link has been sent")).toBeVisible();
  await expect(page.getByText("Email address is required")).toHaveCount(0);
});

test("super admin can manage clinics but cannot enter clinical records", async ({
  page,
}) => {
  await signIn(page, "Super Admin");
  await page.goto("/app/clinics");
  await expect(page.getByRole("heading", { name: "Clinics", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Add Clinic/ })).toBeVisible();
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
