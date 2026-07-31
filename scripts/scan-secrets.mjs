import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((path) => path !== "scripts/scan-secrets.mjs")
  .filter((path) => !path.endsWith("bun.lock"));

const rules = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /\bgh[opurs]_[A-Za-z0-9]{36,255}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  [
    "Supabase service-role value",
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!$|your-|replace-|<)[^\s#]{20,}/m,
  ],
];

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [name, pattern] of rules) {
    if (pattern.test(content)) findings.push(`${file}: possible ${name}`);
  }
}

if (findings.length) {
  console.error("Potential committed secrets found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret scan passed for ${files.length} tracked files.`);
