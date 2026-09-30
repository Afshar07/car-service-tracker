import { describe, expect, it, vi } from "vitest";
import { bumpVersion, parseVersion, readAndroidVersion, runRelease, updateAndroidVersion } from "../scripts/release.mjs";

const source = 'android {\n    defaultConfig {\n        versionCode 7\n        versionName "1.2"\n        applicationId "unchanged"\n    }\n}\n';
const path = "capacitor/android/app/build.gradle";

function harness(answers = ["", "release v1.2.1"], override?: (command: string, args: string[], count: number) => string | undefined) {
  let contents = source;
  let committed = false;
  let pushed = false;
  const calls: string[][] = [];
  const run = vi.fn((command: string, args: string[]) => {
    calls.push([command, ...args]);
    const replacement = override?.(command, args, calls.filter((call) => call.join(" ") === [command, ...args].join(" ")).length);
    if (replacement !== undefined) return replacement;
    const key = [command, ...args].join(" ");
    if (key === "git branch --show-current") return "main";
    if (key === "git status --porcelain --untracked-files=all") return "";
    if (key === "git rev-parse HEAD") return committed ? "bump-sha" : "initial-sha";
    if (key === "git rev-parse refs/remotes/origin/main") return "initial-sha";
    if (key.startsWith("git remote get-url")) return "git@github.com:owner/repo.git";
    if (key.startsWith("gh repo view")) return "owner/repo";
    if (key.startsWith("git commit")) committed = true;
    if (key.startsWith("git push")) pushed = true;
    if (key.startsWith("git ls-remote")) return pushed ? "bump-sha\trefs/tags/v1.2.1" : "";
    return "";
  });
  const write = vi.fn((value: string) => { contents = value; });
  const log = vi.fn();
  const prompt = vi.fn(async () => answers.shift() ?? "cancel");
  return { calls, write, log, run, prompt, contents: () => contents,
    options: { args: [], interactive: true, run, read: () => contents, write, log, prompt } };
}

describe("stable Android versions", () => {
  it("normalizes existing two-part versions", () => {
    expect(parseVersion("1.2", true)).toEqual([1, 2, 0]);
    expect(readAndroidVersion(source)).toEqual({ version: "1.2.0", code: 7 });
  });

  it.each([["patch", "1.2.1"], ["minor", "1.3.0"], ["major", "2.0.0"]])("bumps %s", (choice, expected) => {
    expect(bumpVersion("1.2", choice)).toBe(expected);
  });

  it("accepts a greater custom stable version", () => {
    expect(bumpVersion("1.2.0", "custom", "3.0.1")).toBe("3.0.1");
  });

  it.each(["1.2", "v1.2.1", "1.2.1-beta", "01.2.1", "1.2.0", "1.1.99", "9007199254740992.0.0"])("rejects invalid or nonincreasing custom %s", (version) => {
    expect(() => bumpVersion("1.2.0", "custom", version)).toThrow();
  });

  it("changes exactly the two literals, preserving comments and CRLF", () => {
    const input = source.replace("versionCode 7", "versionCode 7 // code").replace('versionName "1.2"', "versionName '1.2' // name").replaceAll("\n", "\r\n");
    expect(updateAndroidVersion(input, "1.3.0")).toBe(input.replace("versionCode 7", "versionCode 8").replace("'1.2'", "'1.3.0'"));
  });

  it.each([
    source.replace("versionCode 7", "versionCode 2100000000"),
    source.replace("versionCode 7", "versionCode 0"),
    source.replace("versionCode 7", "versionCode computed"),
    source + "versionName '2.0.0'\n",
    source + "versionCode computed\n",
    source.replace('versionName "1.2"', ""),
  ])("refuses absent, ambiguous, unsupported or exhausted fields", (input) => {
    expect(() => readAndroidVersion(input)).toThrow();
  });

  it("allows the last valid versionCode increment", () => {
    expect(updateAndroidVersion(source.replace("versionCode 7", "versionCode 2099999999"), "1.2.1")).toContain("versionCode 2100000000");
  });
});

describe("interactive release", () => {
  it.each([{ answers: ["cancel"] }, { answers: ["", "no"] }, { answers: ["", "yes"] }])("cancels without modifications for $answers", async ({ answers }) => {
    const h = harness([...answers]);
    await runRelease(h.options);
    expect(h.write).not.toHaveBeenCalled();
    expect(h.calls.some((call) => ["add", "commit", "push"].includes(call[1]))).toBe(false);
    expect(h.log).toHaveBeenCalledWith("Cancelled. No files changed.");
  });

  it("refuses noninteractive execution but allows help without commands", async () => {
    const h = harness();
    await expect(runRelease({ ...h.options, interactive: false })).rejects.toThrow("interactive");
    await runRelease({ ...h.options, interactive: false, args: ["--help"] });
    expect(h.run).not.toHaveBeenCalled();
  });

  it.each([
    ["git --version", "missing git"],
    ["gh --version", "missing gh"],
    ["gh auth status --hostname github.com", "not authenticated"],
    ["git fetch origin main", "network failure"],
    ["git ls-remote --tags origin refs/tags/v1.2.1", "remote unavailable"],
    ["gh api --hostname github.com --paginate repos/owner/repo/releases --jq .[].tag_name", "API authentication failed"],
  ])("fails closed when %s fails", async (key, message) => {
    const h = harness(undefined, (command, args) => { if ([command, ...args].join(" ") === key) throw new Error(message); });
    await expect(runRelease(h.options)).rejects.toThrow(message);
    expect(h.write).not.toHaveBeenCalled();
  });

  it.each([
    ["git branch --show-current", "feature", "main"],
    ["git status --porcelain --untracked-files=all", "?? notes.txt", "clean"],
    ["git status --porcelain --untracked-files=all", " M tracked.txt", "clean"],
    ["git rev-parse refs/remotes/origin/main", "different", "synchronized"],
    ["git tag --list v1.2.1", "v1.2.1", "Local tag"],
    ["git ls-remote --tags origin refs/tags/v1.2.1", "sha\trefs/tags/v1.2.1", "Remote tag"],
    ["gh api --hostname github.com --paginate repos/owner/repo/releases --jq .[].tag_name", "v1.2.1", "already exists"],
    ["gh repo view https://github.com/owner/repo --json nameWithOwner --jq .nameWithOwner", "wrong/repo", "does not agree"],
    ["git remote get-url --push --all origin", "https://github.com/other/repo.git", "push URL"],
  ])("refuses unsafe preflight %s", async (key, output, message) => {
    const h = harness(undefined, (command, args) => [command, ...args].join(" ") === key ? output : undefined);
    await expect(runRelease(h.options)).rejects.toThrow(message);
    expect(h.write).not.toHaveBeenCalled();
  });

  it.each(["git status --porcelain --untracked-files=all", "git rev-parse HEAD"])("rechecks concurrent changes in %s after confirmation", async (key) => {
    const h = harness(undefined, (command, args, count) => [command, ...args].join(" ") === key && count === 2 ? "concurrent change" : undefined);
    await expect(runRelease(h.options)).rejects.toThrow();
    expect(h.write).not.toHaveBeenCalled();
  });

  it("commits only Gradle, pins the tag and atomically pushes it before verified publication", async () => {
    const h = harness();
    await runRelease(h.options);
    expect(h.write).toHaveBeenCalledOnce();
    expect(h.contents()).toBe(source.replace("versionCode 7", "versionCode 8").replace('"1.2"', '"1.2.1"'));
    const commands = h.calls.map((call) => call.join(" "));
    const expected = [
      `git add -- ${path}`,
      `git commit --only -m chore: release v1.2.1 -- ${path}`,
      "git tag v1.2.1 bump-sha",
       "git push --atomic origin bump-sha:main refs/tags/v1.2.1",
       "gh release create v1.2.1 --repo github.com/owner/repo --target main --verify-tag --generate-notes",
    ];
    const indices = expected.map((command) => commands.indexOf(command));
    expect(indices.every((index) => index >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(h.log.mock.calls.flat().join("\n")).toContain("APK assets arrive later");
  });

  it("explicitly pins all GitHub operations to github.com despite ambient host and repo", async () => {
    vi.stubEnv("GH_HOST", "wrong.example.com");
    vi.stubEnv("GH_REPO", "wrong.example.com/wrong/repo");
    try {
      const h = harness();
      await runRelease(h.options);
      expect(h.calls).toContainEqual(["gh", "auth", "status", "--hostname", "github.com"]);
      expect(h.calls).toContainEqual(["gh", "repo", "view", "https://github.com/owner/repo", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
      for (const call of h.calls.filter((call) => call[0] === "gh" && call[1] === "api")) {
        expect(call[call.indexOf("--hostname") + 1]).toBe("github.com");
      }
      expect(h.calls).toContainEqual(["gh", "release", "create", "v1.2.1", "--repo", "github.com/owner/repo", "--target", "main", "--verify-tag", "--generate-notes"]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([["minor", "1.3.0"], ["major", "2.0.0"], ["custom", "4.5.6"]])("releases selected %s version", async (choice, version) => {
    const answers = choice === "custom" ? [choice, version, `release v${version}`] : [choice, `release v${version}`];
    const h = harness(answers, (command, args) => command === "git" && args[0] === "ls-remote" && h.calls.some((call) => call[1] === "push") ? `bump-sha\trefs/tags/v${version}` : undefined);
    await runRelease(h.options);
    expect(h.contents()).toContain(`versionName "${version}"`);
    expect(h.calls).toContainEqual(["git", "tag", `v${version}`, "bump-sha"]);
  });

  it.each([
    ["add", "not committed"],
    ["commit", "not committed"],
    ["push", "local tag created but atomic push failed"],
    ["release", "pushed but GitHub release failed"],
  ])("preserves changes and explains recovery after %s failure", async (operation, phase) => {
    const h = harness(undefined, (command, args) => {
      if (args[0] === operation && (operation !== "release" || command === "gh")) throw new Error("operation failed");
    });
    await expect(runRelease(h.options)).rejects.toThrow("operation failed");
    expect(h.write).toHaveBeenCalledOnce();
    const logs = h.log.mock.calls.flat().join("\n");
    expect(logs).toContain(phase);
    expect(logs).toContain("Recovery:");
    expect(logs).toContain("no automatic rollback or retry");
    if (operation === "push") {
      expect(logs).toContain("git push --atomic origin bump-sha:main refs/tags/v1.2.1");
      expect(logs).not.toContain("HEAD:main");
    }
    if (operation === "release") expect(logs).toContain("--repo github.com/owner/repo");
    expect(h.calls.some((call) => ["reset", "clean", "revert"].includes(call[1]))).toBe(false);
  });

  it("does not publish if the pushed tag no longer matches the bump commit", async () => {
    const h = harness(undefined, (command, args, count) => command === "git" && args[0] === "ls-remote" && count === 3 ? "wrong-sha\trefs/tags/v1.2.1" : undefined);
    await expect(runRelease(h.options)).rejects.toThrow("version-bump commit");
    expect(h.calls.some((call) => call[0] === "gh" && call[1] === "release")).toBe(false);
  });
});
