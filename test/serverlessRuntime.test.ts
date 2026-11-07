import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const SERVERLESS_SOURCES = [
  "api/ai/batch-details.ts",
  "api/ai/word-details.ts",
  "api/ai/word-usages.ts",
  "api/lib/aiRateLimit.ts",
  "api/lib/auth.ts",
  "api/lib/gemini.ts",
  "api/lib/googleCloud.ts",
  "api/lib/testPush.ts",
  "api/lib/wordUsages.ts",
  "api/notifications/test.ts"
];

const SERVERLESS_ENTRYPOINTS = [
  "api/ai/batch-details.js",
  "api/ai/word-details.js",
  "api/ai/word-usages.js",
  "api/notifications/test.js"
];

describe("Vercel serverless runtime", () => {
  let outputRoot: string | null = null;

  afterEach(() => {
    if (outputRoot) rmSync(outputRoot, { recursive: true, force: true });
    outputRoot = null;
  });

  it("imports emitted API entrypoints with raw Node ESM resolution", () => {
    const projectRoot = process.cwd();
    outputRoot = mkdtempSync(join(tmpdir(), "vocabloom-serverless-"));
    writeFileSync(join(outputRoot, "package.json"), JSON.stringify({ type: "module" }));
    symlinkSync(join(projectRoot, "node_modules"), join(outputRoot, "node_modules"), "dir");
    cpSync(
      join(projectRoot, "firebase-applet-config.json"),
      join(outputRoot, "firebase-applet-config.json")
    );

    for (const sourcePath of SERVERLESS_SOURCES) {
      const source = readFileSync(join(projectRoot, sourcePath), "utf8");
      const emittedPath = join(outputRoot, sourcePath.replace(/\.ts$/, ".js"));
      mkdirSync(dirname(emittedPath), { recursive: true });
      const result = ts.transpileModule(source, {
        fileName: sourcePath,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022
        }
      });
      writeFileSync(emittedPath, result.outputText);
    }

    for (const entrypoint of SERVERLESS_ENTRYPOINTS) {
      const entrypointUrl = pathToFileURL(join(outputRoot, entrypoint)).href;
      const result = spawnSync(
        process.execPath,
        ["--input-type=module", "--eval", `await import(${JSON.stringify(entrypointUrl)})`],
        { encoding: "utf8" }
      );

      expect(
        result.status,
        `${relative(projectRoot, entrypoint)} failed to import:\n${result.stderr}`
      ).toBe(0);
    }
    // One Node process per entrypoint; the 5s default is too tight when the whole suite runs in parallel.
  }, 20000);
});
