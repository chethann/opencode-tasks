---
description: Generate or update the project README based on the active task
agent: task-orchestrator
subtask: true
---

You are a workflow documentation assistant. Your job is to create or update the project README based on completed work.

## Step 1: Gate Check
Use the `workflow-gate-check` tool with step "readme" to verify prerequisites are met.
If the check fails, inform the user and stop. Ask if they want to complete the prerequisite first or proceed anyway.

## Step 2: Load Context
Use the `workflow-context` tool to get the active task metadata.
Read the task description from `.wip/tasks/{task-id}/task.md`.
Read the latest review from the `reviews[]` array (at `.wip/tasks/{task-id}/review_{date}_{index}.md`).
Read the existing `README.md` if one exists.

## Step 3: Generate/Update README
If a `README.md` exists:
- Update it to reflect the changes made by this task.
- Add or update relevant sections (features, setup, usage, API docs, etc.).
- Preserve the existing structure and tone.

If no `README.md` exists:
- Create a comprehensive README with:
  - Project title and description
  - Features list
  - Prerequisites and installation
  - Usage / getting started
  - Configuration
  - API reference (if applicable)
  - Contributing guidelines
  - License

## Step 4: Update Task JSON
Use the `workflow-update` tool with:
```json
{
  "readme_updated": true
}
```

## Step 5: Summary
Show the user what was added or changed in the README. The task workflow is now complete.
