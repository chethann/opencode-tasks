#!/usr/bin/env bash
set -euo pipefail

# opencode-workflow install script
# Copies plugin + commands into your project's .opencode/ directory

REPO_URL="https://raw.githubusercontent.com/chethann/opencode-tasks/main"

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

echo "Installing opencode-workflow..."

# Create directories
mkdir -p .opencode/plugins
mkdir -p .opencode/commands
mkdir -p .opencode/agents

# Download plugin
echo "  Downloading plugin..."
curl -fsSL "${REPO_URL}/index.ts" -o .opencode/plugins/opencode-workflow.ts

# Download agent
echo "  Downloading agent: task-orchestrator..."
curl -fsSL "${REPO_URL}/agents/task-orchestrator.md" -o .opencode/agents/task-orchestrator.md

# Download dashboard server
echo "  Downloading dashboard..."
curl -fsSL "${REPO_URL}/dashboard.ts" -o .opencode/plugins/opencode-workflow-dashboard.ts

# Download commands
for cmd in "${COMMANDS[@]}"; do
  echo "  Downloading command: ${cmd}"
  curl -fsSL "${REPO_URL}/commands/${cmd}" -o ".opencode/commands/${cmd}"
done

# Create .wip structure
echo "  Creating .wip/ directory structure..."
mkdir -p .wip/tasks
mkdir -p .wip/archive

echo ""
echo "opencode-workflow installed successfully!"
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
