#!/usr/bin/env node
/**
 * Rewrites exported HTML in out/ so asset paths work in Capacitor (iOS/Android).
 * Capacitor loads from capacitor://localhost or file://; absolute paths like
 * /_next/static/... can fail. We make them relative and fix RSC payload paths.
 *
 * Run after next build (Capacitor export). Used by cap:sync.
 */

const fs = require("fs");
const path = require("path");

const outDir = path.resolve(__dirname, "..", "out");

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full, fileList);
    else if (f.name.endsWith(".html")) fileList.push(full);
  }
  return fileList;
}

if (!fs.existsSync(outDir)) {
  console.error("[cap-rewrite-out-html] out/ not found. Run npm run build first.");
  process.exit(1);
}

const htmlFiles = walk(outDir);
let count = 0;

function relativePrefix(file) {
  const rel = path.relative(path.dirname(file), outDir);
  if (!rel || rel === ".") return "./";
  return rel.replace(/\\/g, "/") + "/";
}

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf8");
  const prefix = relativePrefix(file);

  // 0. Set base URL so relative paths resolve correctly in Capacitor WebView (iOS/Android)
  if (!content.includes("<base ")) {
    content = content.replace(/<head[^>]*>/, (m) => m + '<base href="capacitor://localhost/">');
  }

  // 1. Absolute asset paths -> relative so they resolve from document location
  content = content.replace(/href="\/_next\//g, `href="${prefix}_next/`);
  content = content.replace(/src="\/_next\//g, `src="${prefix}_next/`);
  content = content.replace(/href="\/favicon\.ico"/g, `href="${prefix}favicon.ico"`);

  // 2. RSC payload uses "static/chunks/..." (no leading slash); runtime resolves
  //    from origin, so we get origin + "static/chunks/..." = 404. Use _next/ prefix.
  content = content.replace(/"static\/chunks\//g, `"${prefix}_next/static/chunks/`);
  content = content.replace(/"static\/css\//g, `"${prefix}_next/static/css/`);
  content = content.replace(/"static\/media\//g, `"${prefix}_next/static/media/`);

  // 3. Payload and inline JSON also have "/_next/..." and "/favicon.ico" strings
  content = content.replace(/\"\/_next\//g, `"${prefix}_next/`);
  content = content.replace(/(["'])\/favicon\.ico\1/g, "$1./favicon.ico$1");

  fs.writeFileSync(file, content, "utf8");
  count++;
}

console.log("[cap-rewrite-out-html] Rewrote", count, "HTML file(s) in out/ for Capacitor.");
