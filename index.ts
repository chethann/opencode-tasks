import { type Plugin, tool } from "@opencode-ai/plugin"
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs"
import { join } from "path"

// ─── Constants ───────────────────────────────────────────────────────────────

const WIP_DIR = ".wip"

const STATUS_ORDER = [
  "drafting",
  "researching",
  "planning",
  "executing",
  "committed",
  "in-review",
  "done",
] as const

type WorkflowStatus = (typeof STATUS_ORDER)[number]

// Map command names to the prerequisite check
const STATUS_GATES: Record<
  string,
  { check: (task: TaskJson) => string | null }
> = {
  research: {
    check: (t) =>
      t.task?.file && existsSync(t.task.file)
        ? null
        : "No task description found. Run /task first to create one.",
  },
  plan: {
    check: (t) =>
      t.research && t.research.length > 0
        ? null
        : "No research found. Run /research first to analyze the codebase.",
  },
  execute: {
    check: (t) =>
      t.plans && t.plans.length > 0
        ? null
        : "No plan found. Run /plan first to create an implementation plan.",
  },
  commit: {
    check: (t) =>
      t.execute?.started_at
        ? null
        : "Execution not started. Run /execute first to implement the plan.",
  },
  review: {
    check: (t) =>
      t.execute?.completed_at
        ? null
        : "Execution not completed. Run /execute first to finish implementation.",
  },
  readme: {
    check: (t) =>
      t.reviews && t.reviews.some((r) => r.outcome === "approved")
        ? null
        : 'No approved review found. Run /review first and ensure outcome is "approved".',
  },
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileEntry {
  index: number
  file: string
  created_at: string
}

interface ReviewEntry extends FileEntry {
  outcome?: string
}

interface CommitDraft {
  message: string
  prepared_at: string
}

interface TaskJson {
  id: string
  title: string
  type: string
  status: WorkflowStatus
  created_at: string
  updated_at: string
  task: {
    file: string
    created_at: string
  }
  research: FileEntry[]
  plans: FileEntry[]
  execute: {
    started_at: string | null
    completed_at: string | null
  }
  commit: {
    drafts: CommitDraft[]
    committed: boolean
  }
  reviews: ReviewEntry[]
  readme: {
    updated_at: string | null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Root .wip path */
function wipRoot(directory: string): string {
  return join(directory, WIP_DIR)
}

/** Path to a task's directory: .wip/tasks/[id]/ */
function taskDir(directory: string, id: string): string {
  return join(directory, WIP_DIR, "tasks", id)
}

/** Scaffold .wip/tasks/ and .wip/archive/ at the root */
function scaffoldDirs(directory: string) {
  const root = wipRoot(directory)
  for (const sub of ["tasks", "archive"]) {
    const p = join(root, sub)
    if (!existsSync(p)) {
      mkdirSync(p, { recursive: true })
    }
  }
}

/** Scaffold a task's own directory with its subdirs */
function scaffoldTaskDir(directory: string, id: string) {
  const dir = taskDir(directory, id)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readActiveTaskId(directory: string): string | null {
  const p = join(wipRoot(directory), ".active")
  if (!existsSync(p)) return null
  return readFileSync(p, "utf-8").trim() || null
}

function writeActiveTaskId(directory: string, id: string) {
  writeFileSync(join(wipRoot(directory), ".active"), id, "utf-8")
}

function readTaskJson(directory: string, id: string): TaskJson | null {
  const p = join(taskDir(directory, id), "task.json")
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, "utf-8"))
  } catch {
    return null
  }
}

function writeTaskJson(directory: string, task: TaskJson) {
  const p = join(taskDir(directory, task.id), "task.json")
  task.updated_at = new Date().toISOString()
  writeFileSync(p, JSON.stringify(task, null, 2), "utf-8")
}

function resolveTaskId(directory: string, explicitId?: string): string | null {
  if (explicitId) return explicitId
  return readActiveTaskId(directory)
}

function listTasks(directory: string): string[] {
  const dir = join(wipRoot(directory), "tasks")
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

function createEmptyTaskJson(id: string, directory: string): TaskJson {
  const dir = taskDir(directory, id)
  return {
    id,
    title: "",
    type: "",
    status: "drafting",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    task: {
      file: join(dir, "task.md"),
      created_at: new Date().toISOString(),
    },
    research: [],
    plans: [],
    execute: {
      started_at: null,
      completed_at: null,
    },
    commit: {
      drafts: [],
      committed: false,
    },
    reviews: [],
    readme: {
      updated_at: null,
    },
  }
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export const WorkflowPlugin: Plugin = async ({
  project,
  client,
  $,
  directory,
  worktree,
}) => {
  // Scaffold on plugin load
  scaffoldDirs(directory)

  return {
    // Re-scaffold on session creation (in case dirs were deleted)
    event: async ({ event }) => {
      if (event.type === "session.created") {
        scaffoldDirs(directory)
      }
    },

    // ─── Custom tools ──────────────────────────────────────────────────

    tool: {
      /**
       * Read the active task's JSON and return structured context.
       * Commands use this to discover which files to read.
       */
      "workflow-context": tool({
        description:
          "Read the current active workflow task's metadata (JSON). Returns the task JSON with file pointers, status, and all step history. All task files live under .wip/tasks/[task-id]/. Use this to discover which workflow files to read for context.",
        args: {
          taskId: tool.schema.optional(tool.schema.string()),
        },
        async execute(args, context) {
          const { directory } = context
          const id = resolveTaskId(directory, args.taskId)
          if (!id) {
            return JSON.stringify({
              error: "No active task. Run /task to create one or /switch to activate an existing one.",
              available_tasks: listTasks(directory),
            })
          }
          const task = readTaskJson(directory, id)
          if (!task) {
            return JSON.stringify({
              error: `Task "${id}" not found.`,
              available_tasks: listTasks(directory),
            })
          }
          return JSON.stringify(task, null, 2)
        },
      }),

      /**
       * Update the task JSON after a workflow step completes.
       * Each command calls this to record its output.
       */
      "workflow-update": tool({
        description: `Update the workflow task metadata JSON. Use this after completing a workflow step to record file paths, timestamps, and status changes. All files are stored under .wip/tasks/[task-id]/.

Fields you can update:
- "status": one of drafting, researching, planning, executing, committed, in-review, done
- "title": task title (string)
- "type": task type like feat, bug, arch, chore (string)
- "add_research": { "file": "<path>", "created_at": "<iso>" } — appends a research entry
- "add_plan": { "file": "<path>", "created_at": "<iso>" } — appends a plan entry
- "add_review": { "file": "<path>", "created_at": "<iso>", "outcome": "<approved|changes-needed>" } — appends a review entry
- "add_commit_draft": { "message": "<msg>", "prepared_at": "<iso>" } — appends a commit draft
- "execute_started": true — sets execute.started_at to now
- "execute_completed": true — sets execute.completed_at to now
- "readme_updated": true — sets readme.updated_at to now
- "committed": true — marks commit.committed = true`,
        args: {
          taskId: tool.schema.optional(tool.schema.string()),
          updates: tool.schema.string(),
        },
        async execute(args, context) {
          const { directory } = context
          const id = resolveTaskId(directory, args.taskId)
          if (!id) return "Error: No active task."

          const task = readTaskJson(directory, id)
          if (!task) return `Error: Task "${id}" not found.`

          let updates: Record<string, any>
          try {
            updates = JSON.parse(args.updates)
          } catch {
            return "Error: updates must be valid JSON."
          }

          // Apply updates
          if (updates.status) task.status = updates.status
          if (updates.title) task.title = updates.title
          if (updates.type) task.type = updates.type

          if (updates.add_research) {
            const entry: FileEntry = {
              index: task.research.length,
              file: updates.add_research.file,
              created_at: updates.add_research.created_at || new Date().toISOString(),
            }
            task.research.push(entry)
          }

          if (updates.add_plan) {
            const entry: FileEntry = {
              index: task.plans.length,
              file: updates.add_plan.file,
              created_at: updates.add_plan.created_at || new Date().toISOString(),
            }
            task.plans.push(entry)
          }

          if (updates.add_review) {
            const entry: ReviewEntry = {
              index: task.reviews.length,
              file: updates.add_review.file,
              created_at: updates.add_review.created_at || new Date().toISOString(),
              outcome: updates.add_review.outcome,
            }
            task.reviews.push(entry)
          }

          if (updates.add_commit_draft) {
            task.commit.drafts.push({
              message: updates.add_commit_draft.message,
              prepared_at: updates.add_commit_draft.prepared_at || new Date().toISOString(),
            })
          }

          if (updates.execute_started) {
            task.execute.started_at = new Date().toISOString()
          }
          if (updates.execute_completed) {
            task.execute.completed_at = new Date().toISOString()
          }
          if (updates.readme_updated) {
            task.readme.updated_at = new Date().toISOString()
          }
          if (updates.committed) {
            task.commit.committed = true
          }

          writeTaskJson(directory, task)
          return JSON.stringify(task, null, 2)
        },
      }),

      /**
       * Initialize a new task — creates task dir, .json + .md, sets .active
       */
      "workflow-task-init": tool({
        description:
          "Create a new workflow task. Creates the task directory at .wip/tasks/[id]/, the task.json and task.md files inside it, and sets it as the active task. Returns the task JSON.",
        args: {
          id: tool.schema.string(),
          title: tool.schema.optional(tool.schema.string()),
          type: tool.schema.optional(tool.schema.string()),
        },
        async execute(args, context) {
          const { directory } = context
          const id = args.id
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")

          if (!id) return "Error: task id cannot be empty."

          const existing = readTaskJson(directory, id)
          if (existing) {
            return `Error: Task "${id}" already exists. Use /switch ${id} to activate it.`
          }

          scaffoldDirs(directory)
          scaffoldTaskDir(directory, id)

          const task = createEmptyTaskJson(id, directory)
          if (args.title) task.title = args.title
          if (args.type) task.type = args.type

          // Create empty task.md
          writeFileSync(
            join(taskDir(directory, id), "task.md"),
            `# ${args.title || id}\n\n## Description\n\n## Requirements\n\n## Success Criteria\n\n## Context\n`,
            "utf-8"
          )

          writeTaskJson(directory, task)
          writeActiveTaskId(directory, id)

          return JSON.stringify(task, null, 2)
        },
      }),

      /**
       * Switch active task
       */
      "workflow-switch": tool({
        description:
          "Switch the active workflow task. Sets .wip/.active to the given task ID.",
        args: {
          taskId: tool.schema.string(),
        },
        async execute(args, context) {
          const { directory } = context
          const task = readTaskJson(directory, args.taskId)
          if (!task) {
            return JSON.stringify({
              error: `Task "${args.taskId}" not found.`,
              available_tasks: listTasks(directory),
            })
          }
          writeActiveTaskId(directory, args.taskId)
          return `Switched active task to "${args.taskId}" (status: ${task.status})`
        },
      }),

      /**
       * Check if a workflow step's prerequisites are met
       */
      "workflow-gate-check": tool({
        description:
          "Check if the prerequisites for a workflow step are met. Returns ok or an error message. Steps: research, plan, execute, commit, review, readme.",
        args: {
          step: tool.schema.string(),
          taskId: tool.schema.optional(tool.schema.string()),
        },
        async execute(args, context) {
          const { directory } = context
          const id = resolveTaskId(directory, args.taskId)
          if (!id) {
            return JSON.stringify({
              ok: false,
              error: "No active task. Run /task first.",
            })
          }
          const task = readTaskJson(directory, id)
          if (!task) {
            return JSON.stringify({
              ok: false,
              error: `Task "${id}" not found.`,
            })
          }

          const gate = STATUS_GATES[args.step]
          if (!gate) {
            return JSON.stringify({ ok: true, task_id: id })
          }

          const error = gate.check(task)
          if (error) {
            return JSON.stringify({ ok: false, error, task_id: id, status: task.status })
          }
          return JSON.stringify({ ok: true, task_id: id, status: task.status })
        },
      }),
    },

    // ─── Compaction hook ─────────────────────────────────────────────────
    // Preserve active task context across session compactions so the agent
    // doesn't lose awareness of the current workflow state.

    "experimental.session.compacting": async (
      input: any,
      output: { context: string[]; prompt?: string }
    ) => {
      const id = readActiveTaskId(directory)
      if (!id) return

      const task = readTaskJson(directory, id)
      if (!task) return

      const statusNext: Record<string, string> = {
        drafting: "/research",
        researching: "/plan",
        planning: "/execute",
        executing: "/commit",
        committed: "/review",
        "in-review": "/readme",
        done: "(complete)",
      }

      const latestResearch =
        task.research.length > 0
          ? task.research[task.research.length - 1].file
          : "none"
      const latestPlan =
        task.plans.length > 0
          ? task.plans[task.plans.length - 1].file
          : "none"
      const latestReview =
        task.reviews.length > 0
          ? task.reviews[task.reviews.length - 1].file
          : "none"

      output.context.push(`## Active Workflow Task
- **ID**: ${task.id}
- **Title**: ${task.title || "(untitled)"}
- **Type**: ${task.type || "(unset)"}
- **Status**: ${task.status}
- **Next step**: ${statusNext[task.status] || "unknown"}
- **Task dir**: .wip/tasks/${task.id}/
- **Task file**: ${task.task.file}
- **Latest research**: ${latestResearch}
- **Latest plan**: ${latestPlan}
- **Latest review**: ${latestReview}
- **Execution**: started=${task.execute.started_at || "no"}, completed=${task.execute.completed_at || "no"}

Use \`/load-task ${task.id}\` to reload full context, or run the next workflow step.`)
    },
  }
}
