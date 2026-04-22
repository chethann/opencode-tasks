---
description: Load a task's full context into the current session
agent: task-orchestrator
subtask: false
---

You are loading a workflow task's full context into the current session so the user can ask questions, continue work, or run subsequent workflow steps with full awareness.

## Step 1: Resolve Task ID
If `$ARGUMENTS` is provided, use it as the task ID.
If no argument is provided, use the `workflow-context` tool (with no taskId) to check the active task. If there is no active task, list available tasks and ask the user which one to load.

## Step 2: Read Task Metadata
Use the `workflow-context` tool with the resolved task ID to get the full task JSON.

## Step 3: Read All Task Files
Read all the files referenced in the task JSON, in order:

1. **Task description**: Read the file at `task.file` (`.wip/tasks/{task-id}/task.md`)
2. **Latest research**: If `research[]` has entries, read the file from the highest-index entry
3. **Latest plan**: If `plans[]` has entries, read the file from the highest-index entry
4. **Latest review**: If `reviews[]` has entries, read the file from the highest-index entry

## Step 4: Set Active
Use the `workflow-switch` tool to make this the active task (if it isn't already).

## Step 5: Present Context Summary
Output a structured summary to the user:

```
## Task: {title} ({id})
**Type**: {type} | **Status**: {status}
**Created**: {created_at}

### Description
{brief summary from task.md}

### Research ({N} iteration(s))
{brief summary of latest research findings, or "No research yet"}

### Plan ({N} iteration(s))
{brief summary of latest plan, or "No plan yet"}

### Execution
{started/completed timestamps, or "Not started"}

### Review ({N} iteration(s))
{latest review outcome and summary, or "No review yet"}

### Next Step
{recommend the next workflow command based on status}
```

## Important
- This command runs in the **primary session** (not subtask) — the whole point is to inject context into the current conversation.
- After loading, the agent has full awareness of the task and can answer questions or proceed with any workflow step.
- If files referenced in the JSON don't exist on disk, note that to the user but don't fail.
