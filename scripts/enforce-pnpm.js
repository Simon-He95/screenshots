#!/usr/bin/env node

const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent.includes('pnpm')) {
  console.error('\nThis repository now uses pnpm for dependency management.');
  console.error('Please run `corepack enable` and `corepack use pnpm@7.33.6`, or install pnpm@7 manually.\n');
  process.exit(1);
}
