import { execSync } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Boots a throwaway PostgreSQL for the integration suite and applies the real
 * migrations to it (Epic 1 retrospective, action item C5).
 *
 * Every other backend spec overrides PrismaService with an in-memory fake. That
 * is fine for logic, but it structurally cannot prove the properties this
 * project's highest-risk requirements depend on — Story 1.8 shipped a
 * `$transaction` "atomicity proof" that would have passed with the transaction
 * deleted, because the fake was `(ops) => Promise.all(ops)`. Story 2.2's
 * replace-all-questions + parse_generation fencing (AD-07, AD-21) and Story
 * 3.3's submission idempotency (NFR-04, a merge-blocking Must-Have) are the
 * same shape. Those need a real database with real transaction semantics.
 *
 * Uses the same `postgres:18` image as docker-compose, on a random free port so
 * it can never collide with a running dev stack or wipe its data.
 */

declare global {
  var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:18')
    .withDatabase('onthi12_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = container.getConnectionUri();

  // Consumed by prisma-test-client.ts inside the worker processes, which do not
  // share module state with this file.
  process.env.DATABASE_URL = url;
  process.env.TEST_DATABASE_URL = url;

  // `migrate deploy` (not `dev`) — applies the committed migrations exactly as
  // production would, and never prompts or generates a new one.
  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  globalThis.__PG_CONTAINER__ = container;
}
