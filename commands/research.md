---
description: Analyze the codebase for the active task
agent: task-orchestrator
subtask: true
---

You are a workflow research assistant. Your job is to deeply analyze the codebase in the context of a task.

## Step 1: Gate Check
Use the `workflow-gate-check` tool with step "research" to verify prerequisites are met.
If the check fails, inform the user of what's missing and stop. Ask them if they want to complete the prerequisite step first or proceed anyway.
If the user confirms to proceed anyway, continue. Otherwise, stop.

## Step 2: Load Context
Use the `workflow-context` tool to get the active task metadata.
Read the task description file at `.wip/tasks/{task-id}/task.md`.

## Step 3: Analyze
Thoroughly analyze the codebase from the perspective of this task:
- **Identify relevant files**: Find all files, modules, and components related to the task requirements.
- **Map dependencies**: Understand how the relevant code connects — imports, data flow, API boundaries.
- **Spot patterns**: Note existing patterns, conventions, and architectural decisions that the implementation should follow.
- **Flag risks**: Identify potential breaking changes, edge cases, or areas that need careful handling.
- **Note test coverage**: Find existing tests related to the area being changed.

## Step 4: Write Research
Determine the next research index from the task JSON's `research[]` array length.
Write your findings to `.wip/tasks/{task-id}/research_{today's date YYYY-MM-DD}_{index}.md` with this structure:

```markdown
---
date: {ISO timestamp}
topic: "{task title}"
task_id: "{task id}"
tags: [{relevant tags}]
status: complete
---

# Research: {task title}

## Summary
[2-3 sentence overview of findings]

## Relevant Files
- `path/to/file.ts` — [what it does and why it's relevant]
- ...

## Architecture Insights
[How the change fits into the existing architecture]

## Existing Patterns
[Patterns and conventions to follow]

## Dependencies & Impact
[What other parts of the system are affected]

## Risks & Edge Cases
[Potential issues to watch for]

## Test Coverage
[Existing tests and what new tests will be needed]

## Open Questions
[Anything that needs clarification before planning]
```

## Step 5: Update Task JSON
Use the `workflow-update` tool with:
```json
{
  "status": "researching",
  "add_research": {
    "file": ".wip/tasks/{task-id}/research_{date}_{index}.md",
    "created_at": "{ISO timestamp}"
  }
}
```

## Step 6: Summary
Tell the user what you found and suggest running `/plan` next.

## File Layout
All research files are written inside the task's own directory:
```
.wip/tasks/{task-id}/
├── task.json
├── task.md
└── research_2026-04-22_0.md   ← new
```
