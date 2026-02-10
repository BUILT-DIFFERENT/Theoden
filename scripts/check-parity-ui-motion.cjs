const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const registryPath = path.join(root, "docs/custom/parity-gap-registry.json");
const baselinePath = path.join(
  root,
  "third_party/CodexDesktop-Rebuild/docs/parity/animations.json",
);
const keyframesPath = path.join(root, "src/styles/parity-keyframes.css");
const tokensPath = path.join(root, "src/styles/parity-tokens.css");

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const keyframesCss = fs.readFileSync(keyframesPath, "utf8");
const tokensCss = fs.readFileSync(tokensPath, "utf8");

const requiredKeyframes = registry.requiredMotionContract?.keyframes ?? [];
const requiredTokens = registry.requiredMotionContract?.tokens ?? [];
const baselineKeyframes = new Set(baseline.keyframes ?? []);
const baselineTokens = new Set(baseline.cssVariables ?? []);

const missingKeyframes = requiredKeyframes.filter(
  (name) => !new RegExp(`@keyframes\\s+${name}\\b`).test(keyframesCss),
);
const missingTokens = requiredTokens.filter(
  (name) => !new RegExp(`${name}\\s*:`).test(tokensCss),
);
const outOfBaselineKeyframes = requiredKeyframes.filter(
  (name) => !baselineKeyframes.has(name),
);
const outOfBaselineTokens = requiredTokens.filter(
  (name) => !baselineTokens.has(name),
);

if (
  missingKeyframes.length ||
  missingTokens.length ||
  outOfBaselineKeyframes.length ||
  outOfBaselineTokens.length
) {
  console.error("UI motion/token parity check failed.");
  if (missingKeyframes.length) {
    console.error("Missing keyframes:");
    missingKeyframes.forEach((name) => console.error(`- ${name}`));
  }
  if (missingTokens.length) {
    console.error("Missing tokens:");
    missingTokens.forEach((name) => console.error(`- ${name}`));
  }
  if (outOfBaselineKeyframes.length) {
    console.error("Required keyframes not found in baseline animations.json:");
    outOfBaselineKeyframes.forEach((name) => console.error(`- ${name}`));
  }
  if (outOfBaselineTokens.length) {
    console.error("Required tokens not found in baseline animations.json:");
    outOfBaselineTokens.forEach((name) => console.error(`- ${name}`));
  }
  process.exit(1);
}

console.log(
  `UI motion/token parity check passed (${requiredKeyframes.length} keyframes, ${requiredTokens.length} tokens).`,
);
