#!/bin/sh
set -e

REPO="ojowwalker77/runmd"
INSTALL_DIR="$HOME/.runmd"

# Check for bun
if ! command -v bun >/dev/null 2>&1; then
  echo "runmd requires Bun. Install it first:"
  echo "  curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

# Get latest release tag
LATEST=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')

if [ -z "$LATEST" ]; then
  echo "Could not fetch latest release. Installing from main branch..."
  ARCHIVE_URL="https://github.com/$REPO/archive/refs/heads/main.tar.gz"
  STRIP_DIR="runmd-main"
else
  echo "Installing runmd $LATEST..."
  ARCHIVE_URL="https://github.com/$REPO/archive/refs/tags/$LATEST.tar.gz"
  STRIP_DIR="runmd-${LATEST#v}"
fi

# Download and extract
TMP=$(mktemp -d)
curl -sL "$ARCHIVE_URL" | tar xz -C "$TMP"

# Install
rm -rf "$INSTALL_DIR"
mv "$TMP/$STRIP_DIR" "$INSTALL_DIR"
rm -rf "$TMP"

cd "$INSTALL_DIR" && bun install --production --silent

# Link binary
LINK_DIR="$HOME/.local/bin"
mkdir -p "$LINK_DIR"
ln -sf "$INSTALL_DIR/bin/runmd.ts" "$LINK_DIR/runmd"
chmod +x "$INSTALL_DIR/bin/runmd.ts"

echo "Installed runmd to $INSTALL_DIR"

# Check PATH
case ":$PATH:" in
  *":$LINK_DIR:"*) ;;
  *) echo "Add $LINK_DIR to your PATH if not already:"; echo "  export PATH=\"$LINK_DIR:\$PATH\"" ;;
esac
