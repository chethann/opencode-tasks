---
description: Open the workflow dashboard in your browser
subtask: false
---

Launch the opencode-workflow dashboard — a local web UI to browse tasks, view workflow files, and track progress.

## Your Job

First, check if the dashboard is already running:

```bash
curl -s http://localhost:3456/api/tasks > /dev/null 2>&1 && echo "RUNNING" || echo "NOT_RUNNING"
```

If already running, just tell the user to visit http://localhost:3456.

If not running, start it. Use the current working directory explicitly with `--dir`:

```bash
bun run .opencode/plugins/opencode-workflow-dashboard.ts --dir=$(pwd) &
```

If the file doesn't exist at that path, try the npm-installed location:

```bash
bun run node_modules/opencode-workflow/dashboard.ts --dir=$(pwd) &
```

Tell the user the dashboard is running at http://localhost:3456 and that it will auto-open in their browser.

If port 3456 is already in use (server already running), just tell the user to visit http://localhost:3456.

## Important
- The server runs in the background — it won't block the OpenCode session.
- The dashboard auto-refreshes every 5 seconds.
- Action buttons copy commands to clipboard — the user pastes them back into OpenCode.
- Press Escape to close modals or go back.
