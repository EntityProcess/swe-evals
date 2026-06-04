#!/usr/bin/env bun
/**
 * Deterministic Day.js SWE task grader.
 *
 * Runs the focused Jest command from the assertion config inside repo/ with a
 * minimal child-process environment. A task passes when the benchmark test file
 * passes after the agent's changes.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { defineCodeGrader } from "@agentv/eval";

const execFileAsync = promisify(execFile);

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

async function run(command: string, args: string[], cwd: string) {
	try {
		const result = await execFileAsync(command, args, {
			cwd,
			timeout: 900_000,
			maxBuffer: 20 * 1024 * 1024,
			env: minimalEnv(cwd),
		});
		return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
	} catch (error) {
		const err = error as {
			code?: number;
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		return {
			exitCode: typeof err.code === "number" ? err.code : 1,
			stdout: err.stdout ?? "",
			stderr: err.stderr ?? err.message ?? "",
		};
	}
}

defineCodeGrader(async ({ workspacePath, fileChanges, config }) => {
	const repoPath = workspacePath ? path.join(workspacePath, "repo") : "";
	const focusedCommand =
		(config?.focusedCommand as string[] | undefined) ??
		(config?.focused_command as string[] | undefined);
	const expectedChangedFiles =
		(config?.expectedChangedFiles as string[] | undefined) ??
		(config?.expected_changed_files as string[] | undefined) ??
		[];

	const assertions: Array<{
		text: string;
		passed: boolean;
		evidence?: string;
	}> = [];

	if (!workspacePath || !existsSync(repoPath)) {
		return {
			score: 0,
			assertions: [
				{
					text: "Workspace repo checkout exists",
					passed: false,
					evidence: workspacePath ?? "workspace_path missing",
				},
			],
		};
	}

	if (!focusedCommand?.length) {
		return {
			score: 0,
			assertions: [{ text: "focused_command configured", passed: false }],
		};
	}

	const testResult = await run(
		focusedCommand[0] as string,
		focusedCommand.slice(1),
		repoPath,
	);
	const output = `${testResult.stdout}\n${testResult.stderr}`.trim();
	const testsPassed = testResult.exitCode === 0;

	assertions.push({
		text: `Focused command passes: ${focusedCommand.join(" ")}`,
		passed: testsPassed,
		evidence: output.slice(-4000),
	});

	if (fileChanges && expectedChangedFiles.length > 0) {
		for (const file of expectedChangedFiles) {
			assertions.push({
				text: `Expected source file touched: ${file}`,
				passed:
					fileChanges.includes(`a/repo/${file}`) ||
					fileChanges.includes(`b/repo/${file}`),
			});
		}
	}

	return {
		score: testsPassed ? 1 : 0,
		assertions,
		details: {
			command: focusedCommand,
			exit_code: testResult.exitCode,
		},
	};
});
