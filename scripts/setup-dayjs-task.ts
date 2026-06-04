#!/usr/bin/env bun
/**
 * Prepares one Day.js benchmark workspace.
 *
 * Reads AgentV hook context from stdin, clones the task repo into repo/, checks
 * out the frozen previous_commit, applies the reviewed Multi-SWE-bench
 * test_patch, installs dependencies with a minimal child-process environment,
 * and commits that prepared state so AgentV captures only agent changes.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface HookPayload {
	workspace_path: string;
	test_id: string;
	case_metadata?: {
		repo_url?: string;
		previous_commit?: string;
		test_patch?: string;
		setup_command?: string[];
	};
}

const payload = JSON.parse(readFileSync(0, "utf8")) as HookPayload;
const metadata = payload.case_metadata;

if (!metadata?.repo_url || !metadata.previous_commit || !metadata.test_patch) {
	throw new Error(
		"case_metadata must include repo_url, previous_commit, and test_patch",
	);
}

const workspacePath = payload.workspace_path;
const evalDir = process.cwd();
const repoPath = path.join(workspacePath, "repo");
const patchPath = path.resolve(evalDir, metadata.test_patch);
const setupCommand = metadata.setup_command ?? [
	"npm",
	"install",
	"--no-audit",
	"--no-fund",
];

function minimalEnv(cwd: string): NodeJS.ProcessEnv {
	return {
		CI: "true",
		HOME: process.env.HOME ?? "/tmp",
		PATH: process.env.PATH ?? "/usr/bin:/bin",
		npm_config_audit: "false",
		npm_config_fund: "false",
		npm_config_cache: path.join(cwd, ".npm-cache"),
	};
}

async function run(
	command: string,
	args: string[],
	options: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
	const { stdout, stderr } = await execFileAsync(command, args, {
		cwd: options.cwd,
		timeout: options.timeoutMs ?? 120_000,
		maxBuffer: 20 * 1024 * 1024,
		env: options.env ?? minimalEnv(options.cwd ?? workspacePath),
	});
	if (stdout.trim()) process.stdout.write(stdout);
	if (stderr.trim()) process.stderr.write(stderr);
}

if (!existsSync(patchPath)) {
	throw new Error(`test_patch not found: ${patchPath}`);
}

if (existsSync(repoPath)) {
	rmSync(repoPath, { recursive: true, force: true });
}
mkdirSync(workspacePath, { recursive: true });

await run("git", ["clone", "--no-tags", metadata.repo_url, repoPath], {
	timeoutMs: 300_000,
});
await run("git", ["checkout", metadata.previous_commit], { cwd: repoPath });
await run("git", ["apply", "--whitespace=nowarn", patchPath], {
	cwd: repoPath,
});
await run(setupCommand[0] as string, setupCommand.slice(1), {
	cwd: repoPath,
	timeoutMs: 900_000,
	env: minimalEnv(repoPath),
});

await run("git", ["config", "user.email", "agentv@example.invalid"], {
	cwd: repoPath,
});
await run("git", ["config", "user.name", "AgentV Harness"], { cwd: repoPath });
await run("git", ["add", "."], { cwd: repoPath });
await run(
	"git",
	["commit", "--no-gpg-sign", "-m", "Apply benchmark test patch"],
	{
		cwd: repoPath,
	},
);

console.log(
	`Prepared ${payload.test_id} at ${metadata.previous_commit} in ${repoPath}`,
);
