import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const includeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".md"]);
const ignoredDirectories = new Set([".git", ".next", "node_modules", "outputs", "work"]);
const mojibakePattern = /[\u00d8\u00d9\u00c3\u00c2\u00e2\uFFFD]/;
const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!includeExtensions.has(path.extname(entry.name))) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (mojibakePattern.test(line)) failures.push(`${path.relative(root, fullPath)}:${index + 1}`);
    });
  }
}

walk(root);

if (failures.length > 0) {
  console.error("Mojibake or replacement characters detected:");
  failures.slice(0, 50).forEach((failure) => console.error(`- ${failure}`));
  if (failures.length > 50) console.error(`...and ${failures.length - 50} more`);
  process.exit(1);
}

console.log("Mojibake scan passed.");
