// Fails if browser bundles contain Supabase details (specs/002-login).
// Run after `npm run build`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = ".next/static";

const literals = ["supabase.co", "sb_publishable_", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
// When the variables are present (local check, Vercel build) also look for
// the actual values. They are never printed.
const secrets = ["SUPABASE_URL", "SUPABASE_ANON_KEY"]
  .map((name) => process.env[name])
  .filter((value) => value && value.length >= 8);

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let leaks = 0;
for (const file of files(STATIC_DIR)) {
  const content = readFileSync(file, "utf8");
  for (const needle of literals) {
    if (content.includes(needle)) {
      console.error(`Leak: "${needle}" found in ${file}`);
      leaks += 1;
    }
  }
  for (const secret of secrets) {
    if (content.includes(secret)) {
      console.error(`Leak: a configured Supabase value found in ${file}`);
      leaks += 1;
    }
  }
}

if (leaks > 0) {
  console.error(`check-bundle: ${leaks} leak(s) found.`);
  process.exit(1);
}
console.log("check-bundle: no Supabase details in browser bundles.");
