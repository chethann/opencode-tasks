#!/usr/bin/env bash
set -euo pipefail

# opencode-workflow global install script (macOS)
# Installs plugin, commands, and agent into ~/.config/opencode/
# so the workflow is available in every project.

REPO_URL="https://raw.githubusercontent.com/chethann/opencode-tasks/main"

GLOBAL_DIR="${HOME}/.config/opencode"

COMMANDS=(
  "task.md"
  "switch.md"
  "research.md"
  "plan.md"
  "execute.md"
  "commit.md"
  "review.md"
  "readme.md"
  "load-task.md"
  "dashboard.md"
)

echo "Installing opencode-workflow globally to ${GLOBAL_DIR} ..."

# Create directories
mkdir -p "${GLOBAL_DIR}/plugins"
mkdir -p "${GLOBAL_DIR}/commands"
mkdir -p "${GLOBAL_DIR}/agents"

# Download plugin
echo "  Downloading plugin..."
curl -fsSL "${REPO_URL}/index.ts" -o "${GLOBAL_DIR}/plugins/opencode-workflow.ts"

# Download agent
echo "  Downloading agent: task-orchestrator..."
curl -fsSL "${REPO_URL}/agents/task-orchestrator.md" -o "${GLOBAL_DIR}/agents/task-orchestrator.md"

# Download dashboard server
echo "  Downloading dashboard..."
curl -fsSL "${REPO_URL}/dashboard.ts" -o "${GLOBAL_DIR}/plugins/opencode-workflow-dashboard.ts"

# Download commands
for cmd in "${COMMANDS[@]}"; do
  echo "  Downloading command: ${cmd}"
  curl -fsSL "${REPO_URL}/commands/${cmd}" -o "${GLOBAL_DIR}/commands/${cmd}"
done

echo ""
echo "opencode-workflow installed globally!"
echo ""
echo "The workflow commands and agent are now available in every project."
echo ""
echo "Available commands:"
echo "  /dashboard — Open the workflow dashboard in your browser"
echo "  /load-task — Load a task's full context into current session"
echo "  /task      — Create a new task interactively"
echo "  /switch    — Switch active task"
echo "  /research  — Analyze codebase for the active task"
echo "  /plan      — Generate implementation plan"
echo "  /execute   — Implement the plan"
echo "  /commit    — Draft a commit message"
echo "  /review    — Validate the implementation"
echo "  /readme    — Generate/update README"
echo ""
echo "Start by running: /task"
