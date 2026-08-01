import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const billingFormSource = await readFile(
  new URL("../routes/app.billing.new.tsx", import.meta.url),
  "utf8",
);
const repositorySource = await readFile(
  new URL("./supabase/workspace-repository.ts", import.meta.url),
  "utf8",
);
const migrationSource = await readFile(
  new URL(
    "../../supabase/migrations/20260802140000_preserve_itemized_billing.sql",
    import.meta.url,
  ),
  "utf8",
);

test("billing submits every visible line and adjustment", () => {
  assert.match(billingFormSource, /items: lines\.map/);
  assert.match(billingFormSource, /subtotal,/);
  assert.match(billingFormSource, /discount,/);
  assert.match(billingFormSource, /taxRate: tax/);
  assert.match(repositorySource, /create_itemized_invoice/);
  assert.match(repositorySource, /p_items: input\.items/);
});

test("itemized invoices validate and persist their database breakdown", () => {
  assert.match(migrationSource, /jsonb_typeof\(p_items\) <> 'array'/);
  assert.match(migrationSource, /item_count < 1 or item_count > 100/);
  assert.match(migrationSource, /insert into public\.invoice_items[\s\S]*item\.value ->> 'category'[\s\S]*item\.ordinality/);
  assert.match(migrationSource, /calculated_subtotal[\s\S]*calculated_tax[\s\S]*p_discount/);
});

test("invoice reads include persisted line items and totals", () => {
  assert.match(repositorySource, /invoice_items\(category,description,quantity,unit_price,amount,position\)/);
  assert.match(repositorySource, /subtotal: Number\(row\.subtotal\)/);
  assert.match(repositorySource, /discount: Number\(row\.discount\)/);
  assert.match(repositorySource, /tax: Number\(row\.tax\)/);
});
