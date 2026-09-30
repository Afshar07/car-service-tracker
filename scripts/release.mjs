import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const gradlePath = "capacitor/android/app/build.gradle";
const root = fileURLToPath(new URL("../", import.meta.url));
const maxVersionCode = 2100000000;

export function parseVersion(value, allowTwoParts = false) {
  const pattern = allowTwoParts
    ? /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/
    : /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const match = pattern.exec(value);
  if (!match) throw new Error(`Invalid stable version: ${value}. Use X.Y.Z.`);
  const parts = match.slice(1).map((part) => Number(part ?? 0));
  if (!parts.every(Number.isSafeInteger)) throw new Error("Version components exceed safe integer limits.");
  return parts;
}

export function bumpVersion(current, choice = "patch", custom) {
  const parts = parseVersion(current, true);
  let next;
  if (choice === "custom") {
    next = parseVersion(custom ?? "");
  } else {
    const index = ["major", "minor", "patch"].indexOf(choice);
    if (index < 0) throw new Error("Choose patch, minor, major, or custom.");
    next = parts.map((part, position) => position < index ? part : position === index ? part + 1 : 0);
  }
  const firstDifference = next.findIndex((part, index) => part !== parts[index]);
  if (!next.every(Number.isSafeInteger) || firstDifference < 0 || next[firstDifference] < parts[firstDifference]) {
    throw new Error("The new version must be greater than the current version.");
  }
  return next.join(".");
}

export function readAndroidVersion(source) {
  const codes = [...source.matchAll(/^(\s*versionCode\s+)(\d+)(\s*(?:\/\/[^\r\n]*)?)$/gm)];
  const names = [...source.matchAll(/^(\s*versionName\s+)(["'])([^"'\r\n]+)\2(\s*(?:\/\/[^\r\n]*)?)$/gm)];
  /** Count declarations too, so unsupported expressions cannot hide ambiguity. */
  if (codes.length !== 1 || names.length !== 1
    || [...source.matchAll(/^\s*versionCode\b/gm)].length !== 1
    || [...source.matchAll(/^\s*versionName\b/gm)].length !== 1) {
    throw new Error("Expected exactly one literal versionCode and versionName in build.gradle.");
  }
  const code = Number(codes[0][2]);
  if (!Number.isSafeInteger(code) || code < 1 || code >= maxVersionCode) {
    throw new Error(`versionCode cannot be incremented within 1..${maxVersionCode}.`);
  }
  return { version: parseVersion(names[0][3], true).join("."), code };
}

export function updateAndroidVersion(source, version) {
  const current = readAndroidVersion(source);
  bumpVersion(current.version, "custom", version);
  return source
    .replace(/^(\s*versionCode\s+)\d+/m, `$1${current.code + 1}`)
    .replace(/^(\s*versionName\s+)(["'])[^"'\r\n]+\2/m, `$1$2${version}$2`);
}

function originRepository(origin) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(origin);
  if (!match) throw new Error("origin must be a GitHub SSH or HTTPS repository URL.");
  return `${match[1]}/${match[2]}`;
}

/** Dependencies are injectable so verification never needs a real Git repository. */
export async function runRelease({
  args = process.argv.slice(2),
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  run = (command, commandArgs) => {
    try {
      return execFileSync(command, commandArgs, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch (error) {
      throw new Error(`${command} ${commandArgs.join(" ")} failed: ${error.code === "ENOENT" ? `${command} is not installed` : String(error.stderr || error.message).trim()}`);
    }
  },
  read = () => readFileSync(new URL(`../${gradlePath}`, import.meta.url), "utf8"),
  write = (source) => writeFileSync(new URL(`../${gradlePath}`, import.meta.url), source),
  prompt,
  log = console.log,
} = {}) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    log("Usage: node scripts/release.mjs\nInteractive stable Android release from clean, synchronized main. Choose patch (default), minor, major, or custom; type the final release confirmation. Requires Node 22+, git and authenticated gh. Publishes a release; the signed APK arrives later.");
    return;
  }
  if (args.length) throw new Error("Unknown arguments. Use --help.");
  if (!interactive) throw new Error("Release requires an interactive terminal. Use --help for usage.");
  let readline;
  let phase = "not modified";
  let head;
  let releaseHead;
  let tag;
  let repo;
  const ask = prompt ?? ((question) => {
    readline ??= createInterface({ input: process.stdin, output: process.stdout });
    return readline.question(question);
  });
  const git = (...commandArgs) => run("git", commandArgs);
  const gh = (...commandArgs) => run("gh", commandArgs);
  const checkTree = () => {
    if (git("branch", "--show-current") !== "main") throw new Error("Release must run on main.");
    if (git("status", "--porcelain", "--untracked-files=all")) throw new Error("Working tree must be clean, including untracked files.");
    git("fetch", "origin", "main");
    const currentHead = git("rev-parse", "HEAD");
    if (currentHead !== git("rev-parse", "refs/remotes/origin/main")) throw new Error("main is not exactly synchronized with origin/main.");
    if (head && currentHead !== head) throw new Error("HEAD changed while confirming the release. Start again.");
    return currentHead;
  };
  const checkTag = () => {
    if (git("tag", "--list", tag)) throw new Error(`Local tag ${tag} already exists.`);
    if (git("ls-remote", "--tags", "origin", `refs/tags/${tag}`)) throw new Error(`Remote tag ${tag} already exists.`);
    /** Successful enumeration distinguishes absence from authentication/network errors. */
    const releases = gh("api", "--hostname", "github.com", "--paginate", `repos/${repo}/releases`, "--jq", ".[].tag_name");
    if (releases.split(/\r?\n/).includes(tag)) throw new Error(`GitHub release ${tag} already exists.`);
  };
  try {
    git("--version");
    gh("--version");
    gh("auth", "status", "--hostname", "github.com");
    head = checkTree();
    const origin = git("remote", "get-url", "origin");
    const expectedRepo = originRepository(origin);
    const checkPushOrigin = () => {
      const pushOrigins = git("remote", "get-url", "--push", "--all", "origin").split(/\r?\n/);
      if (pushOrigins.length !== 1 || originRepository(pushOrigins[0]).toLowerCase() !== expectedRepo.toLowerCase()) {
        throw new Error("origin push URL must point only to the same GitHub repository.");
      }
    };
    checkPushOrigin();
    repo = gh("repo", "view", `https://github.com/${expectedRepo}`, "--json", "nameWithOwner", "--jq", ".nameWithOwner");
    if (repo.toLowerCase() !== expectedRepo.toLowerCase()) throw new Error("GitHub repository does not agree with git origin.");
    const source = read();
    const current = readAndroidVersion(source);
    const choice = (await ask(`Current v${current.version} (code ${current.code}). Bump patch [default], minor, major, custom, or cancel? `)).trim().toLowerCase();
    if (["cancel", "no", "n"].includes(choice)) {
      log("Cancelled. No files changed.");
      return;
    }
    const version = bumpVersion(current.version, choice || "patch", choice === "custom" ? (await ask("New stable version (X.Y.Z): ")).trim() : undefined);
    tag = `v${version}`;
    const updated = updateAndroidVersion(source, version);
    checkTag();
    log(`Plan: ${current.version} → ${version}; versionCode ${current.code} → ${current.code + 1}.\nCommit only ${gradlePath} as "chore: release ${tag}".\nCreate ${tag} at the exact bump commit; atomically push main and that tag to origin.\nPublish stable GitHub release ${repo}/${tag} targeting main using the verified tag.\nThe published release triggers the signed APK workflow; APK assets arrive later.`);
    if ((await ask(`Type "release ${tag}" to proceed (anything else cancels): `)).trim() !== `release ${tag}`) {
      log("Cancelled. No files changed.");
      return;
    }
    checkTree();
    checkPushOrigin();
    if (git("remote", "get-url", "origin") !== origin || read() !== source) throw new Error("Release inputs changed while confirming. Start again.");
    checkTag();
    phase = "not committed";
    write(updated);
    git("add", "--", gradlePath);
    /** Restrict the commit path even if another process stages unrelated files. */
    git("commit", "--only", "-m", `chore: release ${tag}`, "--", gradlePath);
    phase = "committed but push failed";
    releaseHead = git("rev-parse", "HEAD");
    git("tag", tag, releaseHead);
    phase = "committed and local tag created but atomic push failed";
    if (git("rev-parse", "HEAD") !== releaseHead) throw new Error("HEAD changed before push. Inspect the bump commit and tag before continuing.");
    git("push", "--atomic", "origin", `${releaseHead}:main`, `refs/tags/${tag}`);
    phase = "pushed but GitHub release failed";
    if (git("ls-remote", "--tags", "origin", `refs/tags/${tag}`).split(/\s+/)[0] !== releaseHead) {
      throw new Error("Remote release tag does not point at the version-bump commit.");
    }
    gh("release", "create", tag, "--repo", `github.com/${repo}`, "--target", "main", "--verify-tag", "--generate-notes");
    phase = "published";
    log(`Published ${repo}/${tag}. The signed APK workflow will attach assets when it finishes.`);
  } catch (error) {
    if (phase === "not committed") {
      try {
        if (git("rev-parse", "HEAD") !== head) phase = "committed but push failed";
      } catch {
        phase = "commit state unknown";
      }
    }
    if (phase !== "not modified") {
      log(`Release stopped: ${phase}. Work is preserved; no automatic rollback or retry.`);
      if (phase === "not committed" || phase === "commit state unknown") log("Recovery: inspect git status and git log, review the Gradle change and staging, then finish the one-file commit manually if needed.");
      if (phase === "committed but push failed" || phase === "committed and local tag created but atomic push failed" || phase === "commit state unknown") log(`Recovery: inspect local and remote main and ${tag} to determine whether the atomic push landed. Preserve the bump commit and local tag; resolve the failure, identify and review the actual bump SHA, verify the tag points at that commit, then manually push with: git push --atomic origin ${releaseHead ?? "<reviewed-bump-sha>"}:main refs/tags/${tag}. Do not rerun the version bump.`);
      if (phase === "pushed but GitHub release failed") log(`Recovery: main and ${tag} were pushed. Inspect GitHub for ${tag} and verify the remote tag still points at the bump commit before retrying publication. If the release is absent, run: gh release create ${tag} --repo github.com/${repo} --target main --verify-tag --generate-notes`);
    }
    throw error;
  } finally {
    readline?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRelease().catch((error) => {
    console.error(`Release failed: ${error.message}`);
    process.exitCode = 1;
  });
}
