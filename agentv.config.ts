export default {
	execution: {
		workers: 1,
		agentTimeoutMs: 1_800_000,
		keepWorkspaces: process.env.AGENTV_KEEP_WORKSPACES === "1",
	},
};
