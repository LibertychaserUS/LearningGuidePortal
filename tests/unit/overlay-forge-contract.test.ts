import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// docs/phase1/overlay-forge-issues.md OF-06: the entry docs drifted from the
// tree three times in one day (suite status, workflow shape, pins). These
// locks run in Verify so the drift is red in CI instead of being found by a
// reader. Nothing here changes Verify's purpose; it only reads files.

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const AGENTS = read("AGENTS.md");
const BRIEF = read("docs/phase1/overlay-forge-brief.md");
const USE_FORGE = read("docs/phase1/skills/use-forge/SKILL.md");
const FORGE_YAML = read("forge.yaml");
const OVERLAY_YAML = read("overlay.yaml");
const OVERLAY_CHECK = read(".github/workflows/overlay-check.yml");

function yamlList(source: string, key: string): string[] {
  const match = source.match(new RegExp(`^${key}:\\n((?:  - .*\\n)+)`, "m"));
  assert.ok(match, `${key} list missing`);
  return match[1]
    .split("\n")
    .filter((line) => line.startsWith("  - "))
    .map((line) => line.slice(4).trim());
}

function jobNames(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(join(ROOT, ".github", "workflows"))) {
    const text = read(join(".github", "workflows", file));
    for (const line of text.split("\n")) {
      const job = line.match(/^    name: (.+)$/);
      if (job) names.add(job[1].trim());
    }
  }
  return names;
}

test("forge.yaml required_checks are CI job names, never a workflow name", () => {
  const required = yamlList(FORGE_YAML, "required_checks");
  const jobs = jobNames();
  for (const check of required) {
    assert.ok(jobs.has(check), `required check "${check}" is not a job name in .github/workflows (jobs: ${[...jobs].join(", ")})`);
  }
  assert.equal(required.includes("Verify"), false, "Verify is the workflow name, not a job");
});

test("forge.yaml deny_paths exist and cover every workflow file", () => {
  const deny = yamlList(FORGE_YAML, "deny_paths");
  for (const rel of deny) {
    assert.ok(existsSync(join(ROOT, rel)), `deny_path ${rel} does not exist`);
  }
  for (const file of readdirSync(join(ROOT, ".github", "workflows"))) {
    assert.ok(deny.includes(`.github/workflows/${file}`), `.github/workflows/${file} is not in deny_paths`);
  }
});

test("overlay-check.yml is the inline native job and the docs say so", () => {
  assert.equal(/^\s+uses: .*\/\.github\/workflows\/overlay\.yml@/m.test(OVERLAY_CHECK), false, "overlay-check.yml became a reusable caller; update AGENTS.md / brief §6 first");
  assert.match(OVERLAY_CHECK, /^    name: overlay-check$/m);
  for (const [label, text] of [["AGENTS.md", AGENTS], ["brief", BRIEF]] as const) {
    assert.equal(text.includes("reusable `uses:` + wrapper"), false, `${label} still describes the old reusable + wrapper shape`);
  }
  const ciPin = OVERLAY_CHECK.match(/ref: (overlay-v\d+\.\d+\.\d+)/);
  assert.ok(ciPin, "overlay-check.yml must pin an overlay-v* tag for the tool checkout");
  assert.ok(BRIEF.includes(`@${ciPin[1]}`) || BRIEF.includes(`checkout \`${ciPin[1]}\``) || BRIEF.includes(`AIOps@${ciPin[1]}`), `brief does not state the CI pin ${ciPin[1]}`);
});

test("the published pin SHA is the same in AGENTS.md, the brief and use-forge", () => {
  const pick = (text: string, label: string) => {
    const match = text.match(/overlay-v1\.0\.\d+[^\n]*?([0-9a-f]{40})/);
    assert.ok(match, `${label} does not state the pin SHA next to the overlay tag`);
    return match[1];
  };
  const agents = pick(AGENTS, "AGENTS.md");
  assert.equal(pick(BRIEF, "brief"), agents);
  assert.equal(pick(USE_FORGE, "use-forge"), agents);
});

test("armed suites carry a human signature", () => {
  const suites = readdirSync(join(ROOT, "suites"));
  assert.ok(suites.length > 0);
  for (const suite of suites) {
    const text = read(join("suites", suite, "suite.yaml"));
    const status = text.match(/^status: (\w+)$/m)?.[1];
    assert.ok(status, `${suite}: status missing`);
    if (status === "armed" || status === "blocked") {
      assert.match(text, /^reviewed_by: (?!null\b)\S+/m, `${suite}: ${status} without reviewed_by`);
      assert.match(text, /^reviewed_at: (?!null\b)\S+/m, `${suite}: ${status} without reviewed_at`);
    }
  }
});

test("overlay.yaml default_ref is a full SHA that the brief documents", () => {
  const ref = OVERLAY_YAML.match(/^  default_ref: ([0-9a-f]{40})$/m)?.[1];
  assert.ok(ref, "overlay.yaml default_ref must be a 40-hex SHA, not a branch");
  assert.ok(BRIEF.includes(ref), `brief §6 does not mention default_ref ${ref}`);
});
