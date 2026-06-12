import { readFileSync, writeFileSync, renameSync, rmSync, existsSync, readdirSync } from "fs";
import { execSync } from "child_process";

// Clean dist (keep only .gitkeep etc.)
for (const f of readdirSync("dist")) {
  if (f.endsWith(".gitkeep")) continue;
  rmSync(`dist/${f}`, { recursive: true, force: true });
}

// 1. Compile TypeScript → dist/index.js (ESM) + dist/index.d.ts
execSync("npx tsc", { stdio: "inherit" });

// 2. Read compiled ESM
const src = readFileSync("dist/index.js", "utf8");
const code = src.replace(/^export default /m, "");

// 3. Create CJS UMD
const umd = `(function(g,f){typeof exports==="object"&&typeof module!=="undefined"?module.exports=f():typeof define==="function"&&define.amd?define(f):(g=typeof globalThis!=="undefined"?globalThis:g||self,g.Beidou=f())})(this,function(){
${code}
return KeyboardOrchestrator;
});
`;

writeFileSync("dist/index.cjs", umd);

// 4. Minified CJS
const min = umd
  .replace(/\n\s+/g, "\n")
  .replace(/\n{2,}/g, "\n")
  .replace(/\s*([{}();,:=/])\s*/g, "$1");

writeFileSync("dist/index.min.cjs", min);

// 5. Rename compiled ESM → .mjs
renameSync("dist/index.js", "dist/index.mjs");

console.log("✓ dist/index.mjs  (ESM + declarations)");
console.log("✓ dist/index.cjs  (CJS UMD)");
console.log("✓ dist/index.min.cjs  (minified)");
console.log("✓ dist/index.d.ts  (types)");
