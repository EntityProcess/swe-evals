#!/usr/bin/env bun
/**
 * Verifies that the executable AgentV eval YAML still matches the frozen
 * Day.js task pack for metadata consumed by setup and grading scripts.
 */

import { existsSync } from "node:fs";
import path from "node:path";

type StringRecord = Record<string, unknown>;

interface TaskPack {
	shared_repo?: {
		repo_url?: string;
		setup_command?: string;
	};
	tasks?: TaskRecord[];
}

interface TaskRecord {
	id?: string;
	benchmark_instance_id?: string;
	repo_url?: string;
	previous_commit?: string;
	verification?: {
		focused_command?: string;
		fail_to_pass_tests?: string[];
		pass_to_pass_tests?: string[];
	};
}

interface EvalConfig {
	tests?: EvalTest[];
}

interface EvalTest {
	id?: string;
	metadata?: StringRecord;
	assertions?: EvalAssertion[];
}

interface EvalAssertion extends StringRecord {
	name?: string;
	focused_command?: string[];
	focusedCommand?: string[];
}

const taskPackPath = "tasks/dayjs-v1.yaml";
const evalPath = "evals/dayjs-v1.eval.yaml";
const yaml = (Bun as unknown as { YAML: { parse(input: string): unknown } })
	.YAML;

async function readYaml<T>(filePath: string): Promise<T> {
	const input = await Bun.file(filePath).text();
	return yaml.parse(input) as T;
}

function format(value: unknown): string {
	if (value === undefined) return "<missing>";
	return JSON.stringify(value);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function commandText(value: unknown): string | undefined {
	if (typeof value === "string") return value.trim();
	if (isStringArray(value)) return value.join(" ");
	return undefined;
}

function compare(
	errors: string[],
	testId: string,
	field: string,
	expected: unknown,
	actual: unknown,
): void {
	if (JSON.stringify(expected) === JSON.stringify(actual)) return;

	errors.push(
		[
			`${testId}: ${field} drifted`,
			`  expected: ${format(expected)}`,
			`  actual:   ${format(actual)}`,
		].join("\n"),
	);
}

function compareCommand(
	errors: string[],
	testId: string,
	field: string,
	expected: string | undefined,
	actual: unknown,
): void {
	compare(errors, testId, field, expected, commandText(actual));
}

function requireValue<T>(
	errors: string[],
	label: string,
	value: T | undefined,
): T | undefined {
	if (value === undefined || value === "") {
		errors.push(`${label} is missing`);
		return undefined;
	}

	return value;
}

function patchPathFor(task: TaskRecord): string | undefined {
	if (!task.benchmark_instance_id) return undefined;
	return `../patches/${task.benchmark_instance_id}.test.patch`;
}

const errors: string[] = [];
const taskPack = await readYaml<TaskPack>(taskPackPath);
const evalConfig = await readYaml<EvalConfig>(evalPath);

const tasks = taskPack.tasks ?? [];
const evalTests = evalConfig.tests ?? [];
const evalTestsById = new Map<string, EvalTest>();

for (const test of evalTests) {
	if (!test.id) {
		errors.push(`${evalPath}: test without id`);
		continue;
	}

	if (evalTestsById.has(test.id)) {
		errors.push(`${evalPath}: duplicate test id ${test.id}`);
	}
	evalTestsById.set(test.id, test);
}

compare(
	errors,
	"dayjs-v1",
	"test id order",
	tasks.map((task) => task.id),
	evalTests.map((test) => test.id),
);

for (const task of tasks) {
	const taskId = requireValue(errors, `${taskPackPath}: task id`, task.id);
	if (!taskId) continue;

	const evalTest = evalTestsById.get(taskId);
	if (!evalTest) {
		errors.push(`${evalPath}: missing test ${taskId}`);
		continue;
	}

	const metadata = evalTest.metadata ?? {};
	const focusedAssertion = evalTest.assertions?.find(
		(assertion) => assertion.name === "focused-jest",
	);
	const expectedRepoUrl = task.repo_url ?? taskPack.shared_repo?.repo_url;
	const expectedPatchPath = patchPathFor(task);
	const expectedSetupCommand = taskPack.shared_repo?.setup_command?.trim();
	const expectedFocusedCommand = task.verification?.focused_command?.trim();
	const expectedFailToPassTests = task.verification?.fail_to_pass_tests ?? [];
	const expectedPassToPassTests = task.verification?.pass_to_pass_tests ?? [];

	requireValue(errors, `${taskPackPath}: ${taskId}.repo_url`, expectedRepoUrl);
	requireValue(
		errors,
		`${taskPackPath}: ${taskId}.previous_commit`,
		task.previous_commit,
	);
	requireValue(
		errors,
		`${taskPackPath}: ${taskId}.benchmark_instance_id`,
		task.benchmark_instance_id,
	);
	requireValue(
		errors,
		`${taskPackPath}: shared_repo.setup_command`,
		expectedSetupCommand,
	);
	requireValue(
		errors,
		`${taskPackPath}: ${taskId}.verification.focused_command`,
		expectedFocusedCommand,
	);

	compare(
		errors,
		taskId,
		"metadata.repo_url",
		expectedRepoUrl,
		metadata.repo_url,
	);
	compare(
		errors,
		taskId,
		"metadata.previous_commit",
		task.previous_commit,
		metadata.previous_commit,
	);
	compare(
		errors,
		taskId,
		"metadata.test_patch",
		expectedPatchPath,
		metadata.test_patch,
	);
	compareCommand(
		errors,
		taskId,
		"metadata.setup_command",
		expectedSetupCommand,
		metadata.setup_command,
	);
	compareCommand(
		errors,
		taskId,
		"metadata.focused_command",
		expectedFocusedCommand,
		metadata.focused_command,
	);
	compare(
		errors,
		taskId,
		"metadata.fail_to_pass_tests",
		expectedFailToPassTests,
		metadata.fail_to_pass_tests,
	);
	compare(
		errors,
		taskId,
		"metadata.pass_to_pass_tests",
		expectedPassToPassTests,
		metadata.pass_to_pass_tests,
	);

	if (!focusedAssertion) {
		errors.push(`${taskId}: assertions[focused-jest] is missing`);
	} else {
		compareCommand(
			errors,
			taskId,
			"assertions[focused-jest].focused_command",
			expectedFocusedCommand,
			focusedAssertion.focused_command ?? focusedAssertion.focusedCommand,
		);
	}

	if (expectedPatchPath) {
		const normalizedPatchPath = path.normalize(
			path.join(path.dirname(evalPath), expectedPatchPath),
		);
		if (!existsSync(normalizedPatchPath)) {
			errors.push(`${taskId}: patch file not found: ${normalizedPatchPath}`);
		}
	}
}

for (const test of evalTests) {
	if (!tasks.some((task) => task.id === test.id)) {
		errors.push(`${evalPath}: extra test ${test.id ?? "<missing id>"}`);
	}
}

if (errors.length > 0) {
	console.error(
		[
			"Day.js SWE eval metadata drift check failed:",
			...errors.map((error) => `\n${error}`),
		].join("\n"),
	);
	process.exit(1);
}

console.log(
	`Day.js SWE eval metadata matches ${taskPackPath} for consumed fields.`,
);
