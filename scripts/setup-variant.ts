#!/usr/bin/env bun
/**
 * Installs a runtime variant instruction file into the prepared repo.
 *
 * The variants intentionally avoid provider secrets and external plugin
 * installation. They are prompt/runtime shapes that can be applied to Codex or
 * Pi through the same AGENT_TARGET-selected base target.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface HookPayload {
	workspace_path: string;
}

const variant = process.argv[2];
if (!variant) {
	throw new Error(
		"Usage: setup-variant.ts <baseline|compound-engineering|superpowers>",
	);
}

const payload = JSON.parse(readFileSync(0, "utf8")) as HookPayload;
const repoPath = path.join(payload.workspace_path, "repo");
const variantPath = path.resolve(
	process.cwd(),
	"..",
	"runtime-variants",
	variant,
	"AGENTS.md",
);

if (!existsSync(repoPath)) {
	throw new Error(`repo checkout not found: ${repoPath}`);
}
if (!existsSync(variantPath)) {
	throw new Error(`unknown runtime variant: ${variant}`);
}

const instructions = readFileSync(variantPath, "utf8");
writeFileSync(path.join(repoPath, "AGENTS.md"), instructions);
writeFileSync(path.join(repoPath, "CLAUDE.md"), instructions);
console.log(`Installed ${variant} runtime instructions in ${repoPath}`);
