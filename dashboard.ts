#!/usr/bin/env bun
/**
 * opencode-workflow dashboard server
 * Zero-dependency local server using Bun.serve
 * Serves a task browser UI + JSON API for .wip/ workflow files
 *
 * Usage: bun run dashboard.ts [--port=3456] [--dir=/path/to/project]
 */

import { readFileSync, readdirSync, existsSync, statSync } from "fs"
import { join, resolve } from "path"

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function getArg(name: string, fallback: string): string {
  const arg = args.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split("=")[1] : fallback
}

/** Walk up from startDir looking for a directory containing .wip/ */
function findProjectRoot(startDir: string): string {
  let dir = resolve(startDir)
  while (dir !== "/") {
    if (existsSync(join(dir, ".wip"))) return dir
    dir = resolve(dir, "..")
  }
  return resolve(startDir) // fallback to startDir if .wip not found
}

const PORT = parseInt(getArg("port", "3456"))
const explicitDir = getArg("dir", "")
const PROJECT_DIR = explicitDir
  ? resolve(explicitDir)
  : findProjectRoot(process.cwd())
const WIP_DIR = join(PROJECT_DIR, ".wip")

// ─── Data helpers ────────────────────────────────────────────────────────────

interface TaskSummary {
  id: string
  title: string
  type: string
  status: string
  created_at: string
  updated_at: string
  research_count: number
  plan_count: number
  review_count: number
  has_commits: boolean
  execute_started: boolean
  execute_completed: boolean
}

function getActiveTaskId(): string | null {
  const p = join(WIP_DIR, ".active")
  if (!existsSync(p)) return null
  return readFileSync(p, "utf-8").trim() || null
}

function readTaskJson(id: string): any | null {
  const p = join(WIP_DIR, "tasks", id, "task.json")
  if (!existsSync(p)) return null
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8"))
    // Normalize: ensure id is set (fallback to directory name)
    if (!raw.id) raw.id = id
    return raw
  } catch (e) {
    console.error(`Failed to parse task.json for ${id}:`, e)
    return null
  }
}

function listTasks(): TaskSummary[] {
  const tasksDir = join(WIP_DIR, "tasks")
  if (!existsSync(tasksDir)) return []

  const dirs = readdirSync(tasksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())

  return dirs
    .map((d) => {
      const task = readTaskJson(d.name)
      if (!task) return null
      return {
        id: task.id || d.name,
        title: task.title || task.id || d.name || "(untitled)",
        type: task.type || "",
        status: task.status || "unknown",
        created_at: task.created_at || "",
        updated_at: task.updated_at || "",
        research_count: Array.isArray(task.research) ? task.research.length : 0,
        plan_count: Array.isArray(task.plans) ? task.plans.length : 0,
        review_count: Array.isArray(task.reviews) ? task.reviews.length : 0,
        has_commits: Array.isArray(task.commit?.drafts) ? task.commit.drafts.length > 0 : false,
        execute_started: !!task.execute?.started_at,
        execute_completed: !!task.execute?.completed_at,
      } as TaskSummary
    })
    .filter(Boolean) as TaskSummary[]
}

function readTaskFile(taskId: string, filename: string): string | null {
  const p = join(WIP_DIR, "tasks", taskId, filename)
  // Prevent path traversal
  if (!p.startsWith(join(WIP_DIR, "tasks", taskId))) return null
  if (!existsSync(p)) return null
  try {
    return readFileSync(p, "utf-8")
  } catch {
    return null
  }
}

function listTaskFiles(taskId: string): string[] {
  const dir = join(WIP_DIR, "tasks", taskId)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".json"))
}

// ─── API Router ──────────────────────────────────────────────────────────────

function handleAPI(pathname: string): Response {
  // GET /api/tasks — list all tasks
  if (pathname === "/api/tasks") {
    const active = getActiveTaskId()
    return Response.json({ tasks: listTasks(), active_task: active })
  }

  // GET /api/tasks/:id — full task JSON
  const taskMatch = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)$/)
  if (taskMatch) {
    const task = readTaskJson(taskMatch[1])
    if (!task) return Response.json({ error: "Not found" }, { status: 404 })
    const files = listTaskFiles(taskMatch[1])

    // Normalize task.task field — agent may write "task_file" instead of "task: { file }"
    if (!task.task && task.task_file) {
      task.task = { file: task.task_file, created_at: task.created_at || "" }
    }
    // Normalize commit field
    if (!task.commit) task.commit = { drafts: [], committed: false }
    if (task.commit.committed === undefined) task.commit.committed = false
    // Normalize readme field
    if (!task.readme) task.readme = { updated_at: null }

    return Response.json({ ...task, _files: files })
  }

  // GET /api/tasks/:id/files/:filename — read a specific file
  const fileMatch = pathname.match(
    /^\/api\/tasks\/([a-z0-9-]+)\/files\/(.+)$/
  )
  if (fileMatch) {
    const content = readTaskFile(fileMatch[1], fileMatch[2])
    if (content === null)
      return Response.json({ error: "Not found" }, { status: 404 })
    return Response.json({ filename: fileMatch[2], content })
  }

  return Response.json({ error: "Unknown endpoint" }, { status: 404 })
}

// ─── HTML Dashboard ──────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>opencode-workflow dashboard</title>
<style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --surface2: #1c2128;
    --border: #30363d;
    --text: #e6edf3;
    --text-muted: #7d8590;
    --accent: #58a6ff;
    --green: #3fb950;
    --yellow: #d29922;
    --orange: #db6d28;
    --red: #f85149;
    --purple: #bc8cff;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
  }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }

  /* Header */
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 0; border-bottom: 1px solid var(--border); margin-bottom: 24px;
  }
  header h1 { font-size: 20px; font-weight: 600; }
  header h1 span { color: var(--accent); }
  .active-badge {
    font-size: 13px; color: var(--text-muted); background: var(--surface);
    padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border);
  }
  .active-badge strong { color: var(--accent); }

  /* Task list */
  .task-grid { display: flex; flex-direction: column; gap: 8px; }
  .task-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 16px 20px; cursor: pointer; transition: border-color 0.15s, background 0.15s;
    display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;
  }
  .task-card:hover { border-color: var(--accent); background: var(--surface2); }
  .task-card.active { border-left: 3px solid var(--accent); }
  .task-card .title { font-weight: 600; font-size: 15px; }
  .task-card .meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
  .task-card .meta span { margin-right: 12px; }

  /* Status badges */
  .status {
    font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;
    text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;
  }
  .status-drafting { background: #30363d; color: var(--text-muted); }
  .status-researching { background: #1f2d40; color: var(--accent); }
  .status-planning { background: #2d2200; color: var(--yellow); }
  .status-executing { background: #2d1600; color: var(--orange); }
  .status-committed { background: #1a0030; color: var(--purple); }
  .status-in-review { background: #0d2d0d; color: var(--green); }
  .status-done { background: #0d2d0d; color: var(--green); border: 1px solid var(--green); }

  /* Type badges */
  .type-badge {
    font-size: 11px; padding: 2px 8px; border-radius: 4px;
    background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
  }

  /* Detail panel */
  .detail-panel {
    display: none; margin-top: 24px;
  }
  .detail-panel.visible { display: block; }
  .detail-header {
    display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
  }
  .detail-header h2 { font-size: 22px; font-weight: 600; flex: 1; }
  .back-btn {
    background: none; border: 1px solid var(--border); color: var(--text-muted);
    padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;
  }
  .back-btn:hover { border-color: var(--accent); color: var(--text); }

  /* Progress bar */
  .progress-bar {
    display: flex; gap: 4px; margin-bottom: 24px;
  }
  .progress-step {
    flex: 1; height: 6px; border-radius: 3px; background: var(--surface2);
  }
  .progress-step.complete { background: var(--green); }
  .progress-step.current { background: var(--accent); animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

  /* Metadata grid */
  .meta-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px; margin-bottom: 24px;
  }
  .meta-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px 16px;
  }
  .meta-card .label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .meta-card .value { font-size: 15px; font-weight: 500; }

  /* Files list */
  .files-section { margin-top: 24px; }
  .files-section h3 { font-size: 15px; margin-bottom: 12px; color: var(--text-muted); }
  .file-list { display: flex; flex-direction: column; gap: 6px; }
  .file-item {
    background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
    padding: 10px 16px; cursor: pointer; transition: border-color 0.15s;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px; font-family: "SF Mono", "Fira Code", monospace;
  }
  .file-item:hover { border-color: var(--accent); }
  .file-item .file-type {
    font-size: 10px; color: var(--text-muted); text-transform: uppercase;
    background: var(--surface2); padding: 2px 8px; border-radius: 4px;
  }

  /* File viewer modal */
  .modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    z-index: 100; justify-content: center; align-items: center; padding: 24px;
  }
  .modal-overlay.visible { display: flex; }
  .modal {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    width: 100%; max-width: 900px; max-height: 85vh; display: flex; flex-direction: column;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
  }
  .modal-header h3 { font-size: 14px; font-family: monospace; }
  .modal-close {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 20px; padding: 4px 8px;
  }
  .modal-close:hover { color: var(--text); }
  .modal-body {
    padding: 20px; overflow-y: auto; flex: 1;
  }
  .modal-body pre {
    font-family: "SF Mono", "Fira Code", monospace; font-size: 13px;
    line-height: 1.6; white-space: pre-wrap; word-break: break-word;
  }

  /* Actions */
  .actions {
    display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px;
    padding-top: 20px; border-top: 1px solid var(--border);
  }
  .action-btn {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px;
    transition: all 0.15s; display: flex; align-items: center; gap: 6px;
  }
  .action-btn:hover { border-color: var(--accent); background: var(--surface); }
  .action-btn.primary { background: #1f6feb; border-color: #1f6feb; }
  .action-btn.primary:hover { background: #388bfd; }
  .action-btn .kbd {
    font-size: 10px; background: var(--bg); padding: 2px 6px; border-radius: 3px;
    font-family: monospace;
  }

  /* Empty state */
  .empty {
    text-align: center; padding: 60px 20px; color: var(--text-muted);
  }
  .empty h3 { font-size: 18px; margin-bottom: 8px; color: var(--text); }

  /* Responsive */
  @media (max-width: 640px) {
    .meta-grid { grid-template-columns: 1fr 1fr; }
    .task-card { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1><span>opencode</span>-workflow</h1>
    <div class="active-badge" id="active-badge">loading...</div>
  </header>

  <!-- Task List View -->
  <div id="list-view">
    <div class="task-grid" id="task-list"></div>
  </div>

  <!-- Task Detail View -->
  <div class="detail-panel" id="detail-view">
    <div class="detail-header">
      <button class="back-btn" onclick="showList()">&larr; All tasks</button>
      <h2 id="detail-title"></h2>
      <span class="status" id="detail-status"></span>
    </div>
    <div class="progress-bar" id="progress-bar"></div>
    <div class="meta-grid" id="meta-grid"></div>
    <div class="files-section">
      <h3>Workflow Files</h3>
      <div class="file-list" id="file-list"></div>
    </div>
    <div class="actions" id="actions"></div>
  </div>

  <!-- File Viewer Modal -->
  <div class="modal-overlay" id="modal" onclick="closeModal(event)">
    <div class="modal">
      <div class="modal-header">
        <h3 id="modal-filename"></h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <pre id="modal-content"></pre>
      </div>
    </div>
  </div>
</div>

<script>
const STEPS = ['drafting','researching','planning','executing','committed','in-review','done'];
const STEP_COMMANDS = {
  drafting: '/research',
  researching: '/plan',
  planning: '/execute',
  executing: '/commit',
  committed: '/review',
  'in-review': '/readme',
  done: null
};

let currentTasks = [];
let activeTask = null;

async function fetchTasks() {
  const res = await fetch('/api/tasks');
  const data = await res.json();
  currentTasks = data.tasks;
  activeTask = data.active_task;
  renderTaskList();
}

function renderTaskList() {
  const el = document.getElementById('task-list');
  const badge = document.getElementById('active-badge');

  badge.innerHTML = activeTask
    ? 'Active: <strong>' + activeTask + '</strong>'
    : 'No active task';

  if (currentTasks.length === 0) {
    el.innerHTML = '<div class="empty"><h3>No tasks yet</h3><p>Run /task in OpenCode to create your first task.</p></div>';
    return;
  }

  // Sort: active first, then by updated_at desc
  const sorted = [...currentTasks].sort((a, b) => {
    if (a.id === activeTask) return -1;
    if (b.id === activeTask) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  el.innerHTML = sorted.map(t => {
    const isActive = t.id === activeTask;
    return \`<div class="task-card \${isActive ? 'active' : ''}" onclick="showDetail('\${t.id}')">
      <div>
        <div class="title">
          \${t.type ? '<span class="type-badge">' + t.type + '</span> ' : ''}
          \${t.title || t.id}
        </div>
        <div class="meta">
          <span>\${t.id}</span>
          <span>\${t.research_count} research</span>
          <span>\${t.plan_count} plan(s)</span>
          <span>\${t.review_count} review(s)</span>
          <span>\${timeAgo(t.updated_at)}</span>
        </div>
      </div>
      <span class="status status-\${t.status}">\${t.status}</span>
    </div>\`;
  }).join('');
}

async function showDetail(id) {
  const res = await fetch('/api/tasks/' + id);
  const task = await res.json();

  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').classList.add('visible');

  // Title
  document.getElementById('detail-title').textContent = task.title || task.id;
  const statusEl = document.getElementById('detail-status');
  statusEl.textContent = task.status;
  statusEl.className = 'status status-' + task.status;

  // Progress bar
  const currentIdx = STEPS.indexOf(task.status);
  document.getElementById('progress-bar').innerHTML = STEPS.map((s, i) => {
    let cls = 'progress-step';
    if (i < currentIdx) cls += ' complete';
    else if (i === currentIdx) cls += ' current';
    return '<div class="' + cls + '" title="' + s + '"></div>';
  }).join('');

  // Metadata
  const grid = document.getElementById('meta-grid');
  const metas = [
    { label: 'Task ID', value: task.id },
    { label: 'Type', value: task.type || '—' },
    { label: 'Status', value: task.status },
    { label: 'Created', value: formatDate(task.created_at) },
    { label: 'Updated', value: formatDate(task.updated_at) },
    { label: 'Research', value: (task.research?.length || 0) + ' iteration(s)' },
    { label: 'Plans', value: (task.plans?.length || 0) + ' iteration(s)' },
    { label: 'Reviews', value: (task.reviews?.length || 0) + ' iteration(s)' },
    { label: 'Execution', value: task.execute?.completed_at ? 'Completed' : task.execute?.started_at ? 'In progress' : 'Not started' },
    { label: 'Committed', value: task.commit?.committed ? 'Yes' : task.commit?.drafts?.length ? task.commit.drafts.length + ' draft(s)' : 'No' },
  ];
  grid.innerHTML = metas.map(m =>
    '<div class="meta-card"><div class="label">' + m.label + '</div><div class="value">' + m.value + '</div></div>'
  ).join('');

  // Files
  const fileList = document.getElementById('file-list');
  const files = task._files || [];
  fileList.innerHTML = files.map(f => {
    let type = 'file';
    if (f === 'task.json') type = 'metadata';
    else if (f === 'task.md') type = 'description';
    else if (f.startsWith('research')) type = 'research';
    else if (f.startsWith('plan')) type = 'plan';
    else if (f.startsWith('review')) type = 'review';
    return '<div class="file-item" onclick="viewFile(\\'' + task.id + '\\', \\'' + f + '\\')">' +
      '<span>' + f + '</span>' +
      '<span class="file-type">' + type + '</span>' +
    '</div>';
  }).join('');

  // Actions
  const actions = document.getElementById('actions');
  const nextCmd = STEP_COMMANDS[task.status];
  let html = '';
  if (nextCmd) {
    html += '<button class="action-btn primary" onclick="copyCommand(\\'' + nextCmd + (nextCmd === '/research' || nextCmd === '/plan' || nextCmd === '/execute' ? '' : '') + '\\')">' +
      'Next: <span class="kbd">' + nextCmd + '</span></button>';
  }
  html += '<button class="action-btn" onclick="copyCommand(\\'/load-task ' + task.id + '\\')">Load context <span class="kbd">/load-task</span></button>';
  html += '<button class="action-btn" onclick="copyCommand(\\'/switch ' + task.id + '\\')">Set active <span class="kbd">/switch</span></button>';
  actions.innerHTML = html;
}

function showList() {
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('detail-view').classList.remove('visible');
  fetchTasks();
}

async function viewFile(taskId, filename) {
  const res = await fetch('/api/tasks/' + taskId + '/files/' + encodeURIComponent(filename));
  const data = await res.json();
  document.getElementById('modal-filename').textContent = filename;
  document.getElementById('modal-content').textContent = data.content || 'Empty file';
  document.getElementById('modal').classList.add('visible');
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modal').classList.remove('visible');
}

function copyCommand(cmd) {
  navigator.clipboard.writeText(cmd).then(() => {
    const toast = document.createElement('div');
    toast.textContent = 'Copied: ' + cmd;
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1f6feb;color:white;padding:10px 20px;border-radius:8px;font-size:13px;z-index:200;animation:fadeout 2s forwards';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('modal').classList.contains('visible')) {
      closeModal();
    } else if (document.getElementById('detail-view').classList.contains('visible')) {
      showList();
    }
  }
});

// Auto-refresh every 5 seconds
fetchTasks();
setInterval(fetchTasks, 5000);
</script>

<style>
@keyframes fadeout { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
</style>
</body>
</html>`

// ─── Server ──────────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url)
    const pathname = url.pathname

    // API routes
    if (pathname.startsWith("/api/")) {
      const response = handleAPI(pathname)
      response.headers.set("Access-Control-Allow-Origin", "*")
      return response
    }

    // Serve HTML dashboard
    return new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  },
})

console.log(`\n  opencode-workflow dashboard`)
console.log(`  Project: ${PROJECT_DIR}`)
console.log(`  WIP dir: ${WIP_DIR}`)
console.log(`\n  http://localhost:${PORT}\n`)

// Auto-open browser
const opener =
  process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
    ? "start"
    : "xdg-open"

Bun.spawn([opener, `http://localhost:${PORT}`], { stdout: "ignore", stderr: "ignore" })
