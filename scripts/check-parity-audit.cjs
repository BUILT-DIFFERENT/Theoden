const fs = require("fs");
const path = require("path");

const docsDir = path.resolve(__dirname, "..", "docs", "custom");
const reportPattern = /^official-debug-audit-(\d{4}-\d{2}-\d{2})\.json$/;

const reportFiles = fs
  .readdirSync(docsDir)
  .filter((name) => reportPattern.test(name))
  .sort();

if (reportFiles.length === 0) {
  throw new Error("No official debug audit report found under docs/custom.");
}

const latestReportName = reportFiles[reportFiles.length - 1];
const latestReportPath = path.join(docsDir, latestReportName);
const rawReport = fs
  .readFileSync(latestReportPath, "utf8")
  .replace(/^\uFEFF/, "");
const report = JSON.parse(rawReport);

if (report?.summary?.status !== "pass") {
  throw new Error(
    `Latest audit report ${latestReportName} did not pass (status=${report?.summary?.status ?? "unknown"}).`,
  );
}

const failedChecks = Array.isArray(report.checks)
  ? report.checks
      .filter((check) => check?.status !== "pass")
      .map((check) => check.id)
  : [];

if (failedChecks.length > 0) {
  throw new Error(
    `Latest audit report ${latestReportName} has failing checks: ${failedChecks.join(", ")}`,
  );
}

console.log(`Parity audit report passed: ${latestReportName}`);
