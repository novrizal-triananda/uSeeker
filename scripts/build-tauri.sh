#!/bin/bash
# uSeeker — Tauri Desktop Build Script
# Builds the desktop app for the current platform.
#
# Prerequisites (Linux):
#   sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
#
# Prerequisites (macOS):
#   xcode-select --install
#
# Prerequisites (Windows):
#   Visual Studio Build Tools + WebView2
#
# Usage:
#   ./scripts/build-tauri.sh          # Build release
#   ./scripts/build-tauri.sh dev      # Run in dev mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "🔧 uSeeker Tauri Build"
echo "========================"

# Check Rust
if ! command -v cargo &>/dev/null; then
  echo "❌ Cargo not found. Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi

echo "✅ Rust $(rustc --version | cut -d' ' -f2)"

# Check Node
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found"
  exit 1
fi

echo "✅ Node $(node --version)"

# Install frontend deps
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Build frontend
echo ""
echo "🔨 Building frontend..."
pnpm build

# Check for Tauri CLI
if ! pnpm tauri --version &>/dev/null; then
  echo "📦 Installing Tauri CLI..."
  pnpm add -D @tauri-apps/cli
fi

# Run Tauri build or dev
if [ "${1:-}" = "dev" ]; then
  echo ""
  echo "🚀 Starting Tauri dev mode..."
  pnpm tauri:dev
else
  echo ""
  echo "🏗️  Building Tauri desktop app..."
  pnpm tauri:build

  echo ""
  echo "✅ Build complete!"
  echo "   Output: src-tauri/target/release/bundle/"
  ls -la src-tauri/target/release/bundle/ 2>/dev/null || true
fi
