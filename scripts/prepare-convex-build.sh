#!/usr/bin/env bash
set -euo pipefail

# Convex code generation needs an isolated local deployment in clean CI/Vercel
# builds. The production Auth0 provider configuration is restored immediately
# after code generation and is never replaced in the deployed source.
export CONVEX_AGENT_MODE=anonymous
# Vercel sets VERCEL=1, which makes Convex require a cloud deploy key. This
# build step only needs an isolated local deployment for generated bindings.
export VERCEL=""
pnpm exec convex init

auth_config_backup="$(mktemp)"
cp convex/auth.config.ts "$auth_config_backup"
restore_auth_config() {
  cp "$auth_config_backup" convex/auth.config.ts
  rm -f "$auth_config_backup"
}
trap restore_auth_config EXIT

cat > convex/auth.config.ts <<'EOF'
import { AuthConfig } from "convex/server";

export default {
  providers: [],
} satisfies AuthConfig;
EOF

pnpm exec convex dev --once
