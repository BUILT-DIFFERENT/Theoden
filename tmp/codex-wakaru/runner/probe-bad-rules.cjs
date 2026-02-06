const fs = require("fs-extra");
const path = require("node:path");
const fg = require("fast-glob");
const { runTransformationRules, transformationRules } = require("@wakaru/unminify");

const BASE_FORBIDDEN = new Set([
  "un-esm",
  "un-type-constructor",
  "un-async-await",
  "un-undefined",
  "smart-inline",
]);

function parseArgs(argv) {
  const opts = {
    globs: [],
    extraExcludedRules: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--exclude-rule") {
      opts.extraExcludedRules.push(String(argv[i + 1] || "").trim());
      i += 1;
      continue;
    }
    opts.globs.push(a);
  }

  return opts;
}

function parseErroredRule(logLine) {
  if (typeof logLine !== "string") return null;

  let m = logLine.match(/Error running rule ([^ ]+) on /);
  if (m) return m[1];

  m = logLine.match(/Failed to parse rule .* in rule ([^ ]+)/);
  if (m) return m[1];

  return null;
}

async function detectBadRulesForFile(inputPath, source, initialRules) {
  const badRules = new Set();
  let activeRules = [...initialRules];

  for (let pass = 1; pass <= initialRules.length; pass += 1) {
    const passStart = Date.now();
    console.log(
      `[probe] ${path.relative(process.cwd(), inputPath)} pass ${pass} with ${activeRules.length} rules`,
    );
    const captured = [];
    const originalError = console.error;
    console.error = (...args) => {
      const line = args
        .map((v) => {
          if (v instanceof Error) return `${v.name}: ${v.message}`;
          if (typeof v === "string") return v;
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        })
        .join(" ");
      captured.push(line);
    };

    try {
      await runTransformationRules({ path: inputPath, source }, activeRules, {});
    } catch (e) {
      captured.push(`THROW ${e && e.message ? e.message : String(e)}`);
    } finally {
      console.error = originalError;
    }

    const failingRule = captured
      .map(parseErroredRule)
      .find((id) => id && activeRules.includes(id));

    if (!failingRule) {
      console.log(
        `[probe] ${path.relative(process.cwd(), inputPath)} pass ${pass} clean (${Date.now() - passStart} ms)`,
      );
      return { badRules, activeRules };
    }

    badRules.add(failingRule);
    activeRules = activeRules.filter((id) => id !== failingRule);
    console.log(
      `[probe] ${path.relative(process.cwd(), inputPath)} pass ${pass}: remove ${failingRule} (${Date.now() - passStart} ms)`,
    );
  }

  return { badRules, activeRules };
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  const files = await fg(opts.globs, {
    cwd: process.cwd(),
    absolute: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
  });

  if (!files.length) {
    throw new Error("No input files matched.");
  }

  const allRuleIds = transformationRules.map((r) => r.id);
  const excluded = new Set([
    ...BASE_FORBIDDEN,
    ...opts.extraExcludedRules.filter(Boolean),
  ]);
  const baseActive = allRuleIds.filter((id) => !excluded.has(id));

  const allBad = new Set();

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const { badRules } = await detectBadRulesForFile(file, source, baseActive);
    for (const id of badRules) allBad.add(id);
  }

  console.log("\nSuggested additional exclusions:");
  if (!allBad.size) {
    console.log("(none)");
  } else {
    for (const id of [...allBad].sort()) {
      console.log(id);
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
