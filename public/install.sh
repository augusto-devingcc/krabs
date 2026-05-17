#!/usr/bin/env sh
# krabs.dev — one-line installer for self-host (open source).
#
#   curl -fsSL https://krabs.dev/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/augusto-devingcc/krabs/main/public/install.sh | sh
#
# What it does
#   1. Checks Node.js >= 22, enables pnpm via corepack if missing
#   2. Clones the repo into ~/krabs (override with KRABS_DIR)
#   3. Installs dependencies and runs `pnpm kickoff`
#      → builds CLI + MCP server, mints a local API key, prints the
#        MCP config snippet you paste into Claude Desktop / Cursor
#
# No npm publish required. No network access to npm registry needed
# beyond what pnpm install fetches.

set -eu

REPO_URL="${KRABS_REPO_URL:-https://github.com/augusto-devingcc/krabs.git}"
DIR="${KRABS_DIR:-$HOME/krabs}"
BRANCH="${KRABS_BRANCH:-main}"

c_dim()  { printf '\033[2m%s\033[0m' "$1"; }
c_acc()  { printf '\033[38;5;209m%s\033[0m' "$1"; }
c_ok()   { printf '\033[32m%s\033[0m' "$1"; }
c_warn() { printf '\033[33m%s\033[0m' "$1"; }
c_err()  { printf '\033[31m%s\033[0m' "$1"; }

say()  { printf '%s\n' "$*"; }
step() { printf '\n%s %s\n' "$(c_acc '●')" "$1"; }
err()  { printf '%s %s\n' "$(c_err '✘')" "$1" >&2; }

# ── 1. Preflight ─────────────────────────────────────────────
step "krabs.dev installer"
say "  $(c_dim 'target dir:') $DIR"
say "  $(c_dim 'repo:       ') $REPO_URL ($BRANCH)"

if ! command -v git >/dev/null 2>&1; then
  err "git not found. Install git first: https://git-scm.com"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  err "node not found. Install Node.js 22+ first: https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 22 ]; then
  err "Node.js >= 22 required (you have $(node -v))."
  err "Upgrade Node and re-run this installer."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  step "Enabling pnpm via corepack"
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@latest --activate
  else
    err "corepack not available and pnpm not installed."
    err "Install pnpm manually: https://pnpm.io/installation"
    exit 1
  fi
fi

say "  $(c_dim 'node:') $(node -v)"
say "  $(c_dim 'pnpm:') $(pnpm -v)"

# ── 2. Clone or refresh ──────────────────────────────────────
if [ -d "$DIR" ]; then
  step "Directory $DIR already exists"
  if [ -d "$DIR/.git" ]; then
    REFRESH_MSG="looks like an existing krabs install — refreshing to origin/$BRANCH"
    say "  $(c_dim "$REFRESH_MSG")"

    # If the working tree is dirty, auto-stash so the user never loses
    # accidental edits and the installer never aborts mid-flight. Use a
    # message they can grep for in `git stash list` if they want to recover.
    if [ -n "$(git -C "$DIR" status --porcelain)" ]; then
      STASH_MSG="krabs-installer auto-stash $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      RECOVER_HINT="cd $DIR && git stash list && git stash pop"
      say "  $(c_warn '!') local changes detected — stashing them as: $STASH_MSG"
      say "      $(c_dim 'recover with:') $(c_dim "$RECOVER_HINT")"
      git -C "$DIR" stash push --include-untracked --quiet -m "$STASH_MSG" || true
    fi

    git -C "$DIR" fetch --quiet origin "$BRANCH"
    git -C "$DIR" checkout --quiet "$BRANCH"
    # Hard reset so the install dir always matches origin/$BRANCH exactly.
    # Anything important was just stashed above; this is the canonical
    # state for a managed install.
    git -C "$DIR" reset --hard --quiet "origin/$BRANCH"
  else
    err "$DIR exists but is not a git checkout. Move it aside and re-run."
    err "Or pass KRABS_DIR=/path/to/empty/dir to install elsewhere."
    exit 1
  fi
else
  step "Cloning repo into $DIR"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$DIR"
fi

cd "$DIR"

# ── 3. Install + kickoff ─────────────────────────────────────
step "Installing dependencies"
pnpm install --prefer-offline >/dev/null 2>&1 || pnpm install

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

step "Running pnpm kickoff"
say "  $(c_dim 'builds CLI + MCP server, mints a local API key, writes')"
say "  $(c_dim '~/.config/krabs/config.json, prints your MCP snippet')"
echo
pnpm kickoff

# ── 4. Symlink the CLI on PATH (best-effort) ─────────────────
step "Linking the CLI"
TARGET="$DIR/dist/cli/main.mjs"
LINKED=""

# Pick the first writable directory on PATH that's a "user-shell" spot.
for BIN_DIR in "$HOME/.local/bin" "/usr/local/bin"; do
  if [ -d "$BIN_DIR" ] && [ -w "$BIN_DIR" ]; then
    ln -sf "$TARGET" "$BIN_DIR/krabs"
    LINKED="$BIN_DIR/krabs"
    break
  fi
done

if [ -z "$LINKED" ]; then
  say "  $(c_warn '!') no writable bin dir on PATH. To use the CLI as 'krabs', symlink it yourself:"
  say "      $(c_dim "ln -s \"$TARGET\" /usr/local/bin/krabs")"
else
  say "  $(c_ok '✓') symlinked $LINKED"
  if "$LINKED" --version >/dev/null 2>&1; then
    say "  $(c_ok '✓') krabs --version → $($LINKED --version 2>/dev/null || echo 'ok')"
  fi
fi

# ── 5. Final summary ─────────────────────────────────────────
echo
say "$(c_ok '✔') krabs is installed at $(c_acc "$DIR")"
echo
say "Next steps:"
say "  1. Start the API:    $(c_dim "cd $DIR && pnpm dev:api")"
say "  2. Self-host dashboard: $(c_dim 'open http://localhost:3000/dashboard')"
say "  3. Paste the MCP snippet above into Claude Desktop / Cursor"
say "  4. Tell your agent: $(c_dim 'Read https://krabs.dev/skill.md and run the kickoff.')"
echo
say "Docs: https://krabs.dev/docs   ·   Skill: https://krabs.dev/skill.md"
