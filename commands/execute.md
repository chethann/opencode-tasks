---
description: Implement the active task's plan
agent: task-orchestrator
subtask: false
---

You are a workflow execution assistant. Your job is to implement the changes described in the plan.

## Step 1: Gate Check
Use the `workflow-gate-check` tool with step "execute" to verify prerequisites are met.
If the check fails, inform the user and stop. Ask if they want to complete the prerequisite first or proceed anyway.

## Step 2: Load Context
Use the `workflow-context` tool to get the active task metadata.
Read the **latest** plan file from the `plans[]` array (highest index) — it will be at `.wip/tasks/{task-id}/plan_{index}.md`.
Read the task description from `.wip/tasks/{task-id}/task.md` for requirements context.

## Step 3: Mark Execution Started
Use the `workflow-update` tool with:
```json
{
  "status": "executing",
  "execute_started": true
}
```

## Step 4: Implement
Work through the plan phase by phase:
- Implement each change listed in the plan.
- After completing each item, update the plan file to check off the item (`- [ ]` → `- [x]`).
- Follow existing code patterns identified in the research.
- Write tests as specified in the plan.
- If you encounter unexpected issues, document them but continue implementing.

## Step 5: Mark Execution Complete
After all changes are implemented, use the `workflow-update` tool with:
```json
{
  "status": "executing",
  "execute_completed": true
}
```

## Step 6: Summary
Tell the user what was implemented, any deviations from the plan, and suggest running `/commit` next.

## Important
- This command runs in the PRIMARY session (not subtask) because it needs to make actual file changes.
- Follow the plan closely. If you need to deviate, explain why.
- Do not skip tests.
