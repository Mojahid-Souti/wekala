const fs = require("node:fs");
const path = require("node:path");

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else if (entry.name.endsWith(".svg") || entry.name.endsWith(".node.json")) results.push(full);
  }
  return results;
}

const srcDir = path.join(__dirname, "nodes");
const destBase = path.join(__dirname, "dist");

for (const src of walk(srcDir)) {
  const rel = path.relative(srcDir, src);
  const dest = path.join(destBase, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`copied ${rel}`);
}
