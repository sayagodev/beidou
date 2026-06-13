import { readFileSync, writeFileSync, renameSync, rmSync, readdirSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import * as esbuild from "esbuild";

mkdirSync("dist", { recursive: true });

for (const f of readdirSync("dist")) {
  if (f.endsWith(".gitkeep")) continue;
  rmSync(`dist/${f}`, { recursive: true, force: true });
}

execSync("pnpm exec tsc", { stdio: "inherit" });

const code = readFileSync("dist/index.js", "utf8");
renameSync("dist/index.js", "dist/index.mjs");

const minEsm = await esbuild.transform(code, {
  minify: true,
  format: "esm",
  target: "es2020",
  keepNames: true
});

writeFileSync("dist/index.min.mjs", minEsm.code);

console.log("✓ dist/index.mjs       (ESM)");
console.log("✓ dist/index.min.mjs   (ESM minified)");
console.log("✓ dist/index.d.ts      (types)");
