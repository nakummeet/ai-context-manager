import * as fs from 'fs';
import * as path from 'path';

/** Categorized tech stack detection result */
export interface TechStack {
  languages: string[];
  frontend: string[];
  backend: string[];
  database: string[];
  testing: string[];
  devTools: string[];
  other: string[];
}

/** Maps dependency name (regex or string) to a display label */
interface DepMapping {
  pattern: RegExp | string;
  label: string;
}

const FRONTEND_DEPS: DepMapping[] = [
  { pattern: 'react', label: 'React' },
  { pattern: 'vue', label: 'Vue.js' },
  { pattern: '@angular/core', label: 'Angular' },
  { pattern: 'svelte', label: 'Svelte' },
  { pattern: 'next', label: 'Next.js' },
  { pattern: 'nuxt', label: 'Nuxt' },
  { pattern: 'astro', label: 'Astro' },
  { pattern: '@remix-run/react', label: 'Remix' },
  { pattern: 'gatsby', label: 'Gatsby' },
  { pattern: 'tailwindcss', label: 'Tailwind CSS' },
  { pattern: '@mui/material', label: 'Material UI' },
  { pattern: 'antd', label: 'Ant Design' },
  { pattern: '@chakra-ui/react', label: 'Chakra UI' },
  { pattern: /^@radix-ui\//, label: 'shadcn/ui (Radix)' },
  { pattern: 'solid-js', label: 'SolidJS' },
  { pattern: 'qwik', label: 'Qwik' },
];

const BACKEND_DEPS: DepMapping[] = [
  { pattern: 'express', label: 'Express.js' },
  { pattern: 'fastify', label: 'Fastify' },
  { pattern: '@nestjs/core', label: 'NestJS' },
  { pattern: 'koa', label: 'Koa' },
  { pattern: 'hono', label: 'Hono' },
  { pattern: '@hapi/hapi', label: 'Hapi' },
  { pattern: 'elysia', label: 'Elysia' },
];

const DATABASE_DEPS: DepMapping[] = [
  { pattern: 'mongoose', label: 'MongoDB (Mongoose)' },
  { pattern: 'mongodb', label: 'MongoDB' },
  { pattern: 'pg', label: 'PostgreSQL (pg)' },
  { pattern: 'mysql2', label: 'MySQL' },
  { pattern: 'mysql', label: 'MySQL' },
  { pattern: 'better-sqlite3', label: 'SQLite' },
  { pattern: 'sqlite3', label: 'SQLite' },
  { pattern: '@prisma/client', label: 'Prisma' },
  { pattern: 'typeorm', label: 'TypeORM' },
  { pattern: 'sequelize', label: 'Sequelize' },
  { pattern: 'drizzle-orm', label: 'Drizzle ORM' },
  { pattern: 'redis', label: 'Redis' },
  { pattern: 'ioredis', label: 'Redis (ioredis)' },
  { pattern: 'supabase', label: 'Supabase' },
];

const TESTING_DEPS: DepMapping[] = [
  { pattern: 'jest', label: 'Jest' },
  { pattern: 'vitest', label: 'Vitest' },
  { pattern: 'mocha', label: 'Mocha' },
  { pattern: 'cypress', label: 'Cypress' },
  { pattern: '@playwright/test', label: 'Playwright' },
  { pattern: '@testing-library/react', label: 'React Testing Library' },
  { pattern: 'chai', label: 'Chai' },
  { pattern: 'supertest', label: 'Supertest' },
];

const DEVTOOL_DEPS: DepMapping[] = [
  { pattern: 'typescript', label: 'TypeScript' },
  { pattern: 'eslint', label: 'ESLint' },
  { pattern: 'prettier', label: 'Prettier' },
  { pattern: 'vite', label: 'Vite' },
  { pattern: 'webpack', label: 'Webpack' },
  { pattern: 'esbuild', label: 'esbuild' },
  { pattern: 'turbo', label: 'Turborepo' },
  { pattern: 'nx', label: 'Nx' },
  { pattern: '@swc/core', label: 'SWC' },
  { pattern: 'rollup', label: 'Rollup' },
  { pattern: 'parcel', label: 'Parcel' },
];

const OTHER_DEPS: DepMapping[] = [
  { pattern: 'graphql', label: 'GraphQL' },
  { pattern: '@trpc/server', label: 'tRPC' },
  { pattern: 'zustand', label: 'Zustand' },
  { pattern: 'redux', label: 'Redux' },
  { pattern: '@reduxjs/toolkit', label: 'Redux Toolkit' },
  { pattern: 'socket.io', label: 'Socket.io' },
  { pattern: 'zod', label: 'Zod' },
  { pattern: 'axios', label: 'Axios' },
  { pattern: 'jsonwebtoken', label: 'JWT' },
  { pattern: 'stripe', label: 'Stripe' },
  { pattern: 'openai', label: 'OpenAI SDK' },
  { pattern: '@anthropic-ai/sdk', label: 'Anthropic SDK' },
];

/**
 * Check if a dependency name matches a mapping pattern.
 */
function matchesDep(depName: string, pattern: RegExp | string): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(depName);
  }
  return depName === pattern || depName.includes(pattern);
}

/**
 * Detect technologies from a list of dependency names.
 */
function detectFrom(deps: string[], mappings: DepMapping[]): string[] {
  const found = new Set<string>();
  for (const dep of deps) {
    for (const mapping of mappings) {
      if (matchesDep(dep, mapping.pattern)) {
        found.add(mapping.label);
        break;
      }
    }
  }
  return Array.from(found);
}

/**
 * Detect languages from file existence in the workspace root.
 */
function detectLanguages(rootPath: string, deps: string[]): string[] {
  const languages: string[] = [];

  // TypeScript: tsconfig.json or typescript in deps
  if (
    fs.existsSync(path.join(rootPath, 'tsconfig.json')) ||
    deps.includes('typescript')
  ) {
    languages.push('TypeScript');
  } else {
    // Check for JS
    if (fs.existsSync(path.join(rootPath, 'package.json'))) {
      languages.push('JavaScript');
    }
  }

  // Python
  if (
    fs.existsSync(path.join(rootPath, 'requirements.txt')) ||
    fs.existsSync(path.join(rootPath, 'pyproject.toml')) ||
    fs.existsSync(path.join(rootPath, 'setup.py'))
  ) {
    languages.push('Python');
  }

  // Go
  if (fs.existsSync(path.join(rootPath, 'go.mod'))) {
    languages.push('Go');
  }

  // Rust
  if (fs.existsSync(path.join(rootPath, 'Cargo.toml'))) {
    languages.push('Rust');
  }

  // Java
  if (
    fs.existsSync(path.join(rootPath, 'pom.xml')) ||
    fs.existsSync(path.join(rootPath, 'build.gradle'))
  ) {
    languages.push('Java');
  }

  // Ruby
  if (fs.existsSync(path.join(rootPath, 'Gemfile'))) {
    languages.push('Ruby');
  }

  // PHP
  if (fs.existsSync(path.join(rootPath, 'composer.json'))) {
    languages.push('PHP');
  }

  return languages;
}

/**
 * Detect Docker usage from file existence.
 */
function detectDocker(rootPath: string): boolean {
  return (
    fs.existsSync(path.join(rootPath, 'Dockerfile')) ||
    fs.existsSync(path.join(rootPath, 'docker-compose.yml')) ||
    fs.existsSync(path.join(rootPath, 'docker-compose.yaml'))
  );
}

/**
 * Auto-detect the full tech stack from the workspace root.
 * @param rootPath - Absolute path to the workspace root
 * @returns TechStack object with categorized technologies
 */
export function detectTechStack(rootPath: string): TechStack | null {
  const pkgPath = path.join(rootPath, 'package.json');

  let allDeps: string[] = [];
  let packageData: Record<string, unknown> = {};

  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      packageData = JSON.parse(raw) as Record<string, unknown>;

      const deps = Object.keys((packageData.dependencies as Record<string, string>) ?? {});
      const devDeps = Object.keys((packageData.devDependencies as Record<string, string>) ?? {});
      const peerDeps = Object.keys((packageData.peerDependencies as Record<string, string>) ?? {});
      allDeps = [...deps, ...devDeps, ...peerDeps];
    } catch {
      // package.json parse error — continue with empty deps
    }
  }

  const languages = detectLanguages(rootPath, allDeps);
  const frontend = detectFrom(allDeps, FRONTEND_DEPS);
  const backend = detectFrom(allDeps, BACKEND_DEPS);
  const database = detectFrom(allDeps, DATABASE_DEPS);
  const testing = detectFrom(allDeps, TESTING_DEPS);
  const devTools = detectFrom(allDeps, DEVTOOL_DEPS);
  const other = detectFrom(allDeps, OTHER_DEPS);

  if (detectDocker(rootPath)) {
    other.push('Docker');
  }

  return { languages, frontend, backend, database, testing, devTools, other };
}

/**
 * Read npm scripts from package.json.
 * @param rootPath - Workspace root path
 * @returns Record of script name → command, or empty object
 */
export function getNpmScripts(rootPath: string): Record<string, string> {
  const pkgPath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};

  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    return (pkg.scripts as Record<string, string>) ?? {};
  } catch {
    return {};
  }
}

/**
 * Get the project name from package.json or the folder name.
 * @param rootPath - Workspace root path
 */
export function getProjectName(rootPath: string): string {
  const pkgPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      if (typeof pkg.name === 'string' && pkg.name.trim()) {
        return pkg.name.trim();
      }
    } catch {
      // fall through
    }
  }
  return path.basename(rootPath);
}

/**
 * Read environment variable keys from .env.example or .env.sample.
 * NEVER reads values — only returns key names.
 * @param rootPath - Workspace root path
 */
export function getEnvKeys(rootPath: string): string[] {
  const candidates = ['.env.example', '.env.sample', '.env.template'];
  for (const fname of candidates) {
    const envPath = path.join(rootPath, fname);
    if (!fs.existsSync(envPath)) continue;
    try {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      const keys: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          keys.push(trimmed.substring(0, eqIndex).trim());
        }
      }
      return keys;
    } catch {
      // continue to next candidate
    }
  }
  return [];
}
