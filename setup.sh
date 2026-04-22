#!/usr/bin/env bash
set -euo pipefail

# opencode-workflow setup script (symlink mode)
# Creates symlinks from a local git clone into your project's .opencode/ directory.
# No npm/bun install required — works behind corporate proxies.
#
# Usage:
#   cd /path/to/your-project
#   /path/to/opencode-workflow/setup.sh
#
# Or with an explicit target:
#   /path/to/opencode-workflow/setup.sh /path/to/your-project

# Resolve the directory where this script lives (= the cloned repo)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Target project is the first argument, or the current directory
TARGET_DIR="${1:-.}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

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

echo "Setting up opencode-workflow (symlink mode)"
echo "  Source: ${SCRIPT_DIR}"
echo "  Target: ${TARGET_DIR}"
echo ""

# Create directories
mkdir -p "${TARGET_DIR}/.opencode/plugins"
mkdir -p "${TARGET_DIR}/.opencode/commands"
mkdir -p "${TARGET_DIR}/.opencode/agents"

# Symlink plugin
echo "  Linking plugin..."
ln -sf "${SCRIPT_DIR}/index.ts" "${TARGET_DIR}/.opencode/plugins/opencode-workflow.ts"

# Symlink dashboard server
echo "  Linking dashboard..."
ln -sf "${SCRIPT_DIR}/dashboard.ts" "${TARGET_DIR}/.opencode/plugins/opencode-workflow-dashboard.ts"

# Symlink agent
echo "  Linking agent: task-orchestrator..."
ln -sf "${SCRIPT_DIR}/agents/task-orchestrator.md" "${TARGET_DIR}/.opencode/agents/task-orchestrator.md"

# Symlink commands
for cmd in "${COMMANDS[@]}"; do
  echo "  Linking command: ${cmd}"
  ln -sf "${SCRIPT_DIR}/commands/${cmd}" "${TARGET_DIR}/.opencode/commands/${cmd}"
done

# Create .wip structure
echo "  Creating .wip/ directory structure..."
mkdir -p "${TARGET_DIR}/.wip/tasks"
mkdir -p "${TARGET_DIR}/.wip/archive"

echo ""
echo "opencode-workflow linked successfully!"
echo ""
echo "Notes:"
echo "  - Command changes (*.md) take effect on next command run."
echo "  - Plugin changes (index.ts, dashboard.ts) require restarting OpenCode."
echo "  - To uninstall, delete the symlinks in .opencode/ and the .wip/ directory."
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
