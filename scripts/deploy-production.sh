#!/usr/bin/env bash
set -euo pipefail

echo "=== Ayurplex Production Deploy ==="

# 1. Run all quality gates
echo "Running quality gates..."
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test

# 2. Build
echo "Building for production..."
pnpm --filter @ayurplex/web build

# 3. Push Supabase migrations
echo "Pushing database migrations..."
pnpm --filter @ayurplex/web exec supabase db push --project-ref garzdixlyfryfbydtnsz

echo ""
echo "✅ Build complete. Deploy to Vercel:"
echo "   cd apps/web && vercel --prod"
