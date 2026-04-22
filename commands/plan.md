---
description: Generate an implementation plan for the active task
agent: task-orchestrator
subtask: true
---

You are a workflow planning assistant. Your job is to create a detailed, phased implementation plan.

## Step 1: Gate Check
Use the `workflow-gate-check` tool with step "plan" to verify prerequisites are met.
If the check fails, inform the user and stop. Ask if they want to complete the prerequisite first or proceed anyway.

## Step 2: Load Context
Use the `workflow-context` tool to get the active task metadata.
Read the task description from `.wip/tasks/{task-id}/task.md`.
Read the **latest** research file from the `research[]` array (highest index).
Read any previous plans from the `plans[]` array for iteration context.

## Step 3: Create Plan
Generate a comprehensive implementation plan. Write it to `.wip/tasks/{task-id}/plan_{index}.md`:

```markdown
---
date: {ISO timestamp}
task_id: "{task id}"
research_ref: "{path to research file used}"
status: active
---

# Implementation Plan: {task title}

## Overview
[Brief description of what will be implemented and the approach]

## Phase 1: {Phase Name}
### Changes
- [ ] `path/to/file.ts` — [specific change description]
- [ ] `path/to/file.ts` — [specific change description]

### Details
[Detailed explanation of the changes in this phase]

## Phase 2: {Phase Name}
### Changes
- [ ] ...

### Details
...

## Phase N: Testing
### Changes
- [ ] [Test files to create or update]

### Details
[Testing strategy — unit tests, integration tests, what to verify]

## Success Criteria
- [ ] [Criterion from the task requirements]
- [ ] [Criterion from the task requirements]
- [ ] All existing tests pass
- [ ] New tests cover the changes

## Risks & Mitigations
- **Risk**: [description] → **Mitigation**: [how to handle]

## Dependencies
- [Any external dependencies or prerequisite changes]

## Estimated Scope
[Small / Medium / Large — with brief justification]
```

## Step 4: Update Task JSON
Use the `workflow-update` tool with:
```json
{
  "status": "planning",
  "add_plan": {
    "file": ".wip/tasks/{task-id}/plan_{index}.md",
    "created_at": "{ISO timestamp}"
  }
}
```

## Step 5: Summary
Present the plan to the user. Highlight key decisions and ask if they want to adjust anything before running `/execute`.

## File Layout
```
.wip/tasks/{task-id}/
├── task.json
├── task.md
├── research_2026-04-22_0.md
└── plan_0.md                  ← new
```
