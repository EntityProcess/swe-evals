# AgentV SWE Workspace

AgentV copies this template into a disposable workspace for each test case. The
before_each hook clones Day.js into `repo/`, checks out the task
`previous_commit`, applies the benchmark test patch, and installs dependencies.
