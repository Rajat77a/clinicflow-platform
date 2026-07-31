import assert from "node:assert/strict";
import { resolveTxt } from "node:dns/promises";

const domain = (process.env.EMAIL_SENDER_DOMAIN ?? "").trim().toLowerCase();
const selector = (process.env.EMAIL_DKIM_SELECTOR ?? "").trim().toLowerCase();
if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
  throw new Error("EMAIL_SENDER_DOMAIN must be a valid domain name");
}
if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(selector)) {
  throw new Error("EMAIL_DKIM_SELECTOR must be a valid selector");
}

async function records(name) {
  try {
    return (await resolveTxt(name)).map((parts) => parts.join(""));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENODATA") return [];
    throw error;
  }
}

const [senderRecords, dmarcRecords, dkimRecords] = await Promise.all([
  records(domain),
  records(`_dmarc.${domain}`),
  records(`${selector}._domainkey.${domain}`),
]);
const spf = senderRecords.filter((record) => /^v=spf1\s/i.test(record));
const dmarc = dmarcRecords.filter((record) => /^v=DMARC1\s*;/i.test(record));
const dkim = dkimRecords.filter((record) => /^(?:v=DKIM1\s*;.*;\s*)?p=[A-Za-z0-9+/=]+/i.test(record));

assert.equal(spf.length, 1, "Sender domain must publish exactly one SPF policy");
assert.equal(dmarc.length, 1, "Sender domain must publish exactly one DMARC policy");
assert.equal(dkim.length, 1, "DKIM selector must publish exactly one public key");
assert.match(dmarc[0], /;\s*p=(quarantine|reject)(?:;|\s|$)/i, "DMARC must enforce quarantine or reject");

console.log(JSON.stringify({
  status: "valid",
  domain,
  dkimSelector: selector,
  spf: "present",
  dkim: "present",
  dmarc: "enforcing",
}, null, 2));
