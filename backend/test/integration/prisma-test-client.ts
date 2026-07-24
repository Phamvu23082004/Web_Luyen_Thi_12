import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * A PrismaClient against the throwaway container started in global-setup.ts.
 *
 * Constructed the same way PrismaService does (driver adapter is mandatory in
 * Prisma 7 — a bare `new PrismaClient()` will not connect), so specs exercise
 * the same client the application uses.
 */
export function createTestPrismaClient(): PrismaClient {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'TEST_DATABASE_URL is not set — integration specs must run via `npm run test:integration`, ' +
        'which starts the throwaway Postgres in test/integration/global-setup.ts.',
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Empties every table between specs, children first.
 *
 * Deliberately `deleteMany` per model rather than a raw `TRUNCATE ... CASCADE`:
 * Prisma 7's raw-query path performs a dynamic import that Jest's VM rejects
 * without `--experimental-vm-modules`, and the typed delegates avoid the whole
 * problem. Every parent-to-child relation still standing (RESTRICT or CASCADE)
 * needs children deleted first regardless — CASCADE just makes the parent-row
 * delete forgiving, not the order below optional — extend it as Epic 2+ tables
 * land.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  // Exam tables first: `questions`/`exam_classes` are children of `exams`
  // (ON DELETE CASCADE), and `exams`→`users` / `exam_classes`→`classes` are
  // ON DELETE RESTRICT, so these must go before `class`/`user` below (Story 2.1a).
  await prisma.question.deleteMany();
  await prisma.examClass.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();
}
