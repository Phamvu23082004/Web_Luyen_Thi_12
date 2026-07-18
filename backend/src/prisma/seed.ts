import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

import { PrismaClient } from '../../generated/prisma/client';

// Standalone client for the seed — mirrors PrismaService: Prisma 7 requires the
// pg driver adapter, a bare `new PrismaClient()` will not connect.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Shared dev credential. bcrypt cost 10 — this library + cost is load-bearing
// for the login story (1.5), which must verify against this same hash (AD-10).
const SEED_PASSWORD = 'Password123!';
const BCRYPT_COST = 10;

interface TeacherSeed {
  email: string;
  name: string;
}

interface ClassSeed {
  id: string; // stable, explicitly-provided id so re-seeding upserts instead of duplicating
  name: string;
  teacherEmail: string;
}

interface StudentSeed {
  email: string;
  name: string;
  classIds: string[]; // classes this student is enrolled into
}

const TEACHERS: TeacherSeed[] = [
  { email: 'teacher.alpha@onthi12.local', name: 'Cô Nguyễn Alpha' },
  { email: 'teacher.beta@onthi12.local', name: 'Thầy Trần Beta' },
];

const CLASSES: ClassSeed[] = [
  {
    id: 'seed-class-12a1',
    name: 'Lớp 12A1',
    teacherEmail: 'teacher.alpha@onthi12.local',
  },
  {
    id: 'seed-class-12a2',
    name: 'Lớp 12A2',
    teacherEmail: 'teacher.alpha@onthi12.local',
  },
  {
    id: 'seed-class-12b1',
    name: 'Lớp 12B1',
    teacherEmail: 'teacher.beta@onthi12.local',
  },
];

const STUDENTS: StudentSeed[] = [
  {
    email: 'student1@onthi12.local',
    name: 'Học sinh Một',
    classIds: ['seed-class-12a1'],
  },
  {
    email: 'student2@onthi12.local',
    name: 'Học sinh Hai',
    classIds: ['seed-class-12a1'],
  },
  {
    email: 'student3@onthi12.local',
    name: 'Học sinh Ba',
    classIds: ['seed-class-12a1', 'seed-class-12a2'],
  },
  {
    email: 'student4@onthi12.local',
    name: 'Học sinh Bốn',
    classIds: ['seed-class-12a2'],
  },
  {
    email: 'student5@onthi12.local',
    name: 'Học sinh Năm',
    classIds: ['seed-class-12b1'],
  },
  {
    email: 'student6@onthi12.local',
    name: 'Học sinh Sáu',
    classIds: ['seed-class-12b1'],
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the seed script with NODE_ENV=production (seeds a known shared password).',
    );
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_COST);
  const knownClassIds = new Set(CLASSES.map((c) => c.id));

  // Teachers — upsert on the natural unique key (email). Syncs name on rerun
  // so a corrected seed value propagates to an already-seeded row.
  const teacherIdByEmail = new Map<string, string>();
  for (const t of TEACHERS) {
    const email = t.email.toLowerCase();
    const teacher = await prisma.user.upsert({
      where: { email },
      update: { name: t.name },
      create: { name: t.name, email, passwordHash, role: 'teacher' },
    });
    teacherIdByEmail.set(email, teacher.id);
  }

  // Classes — upsert on the stable seed id so re-running does not duplicate.
  for (const c of CLASSES) {
    const teacherId = teacherIdByEmail.get(c.teacherEmail.toLowerCase());
    if (teacherId === undefined) {
      throw new Error(
        `Seed misconfigured: no teacher for class ${c.id} (${c.teacherEmail})`,
      );
    }
    await prisma.class.upsert({
      where: { id: c.id },
      update: { name: c.name, teacherId },
      create: { id: c.id, name: c.name, teacherId },
    });
  }

  // Students — upsert on email, then enroll via class_students upsert on the
  // composite key so both the student rows and the enrollments are idempotent.
  for (const s of STUDENTS) {
    const email = s.email.toLowerCase();
    const student = await prisma.user.upsert({
      where: { email },
      update: { name: s.name },
      create: { name: s.name, email, passwordHash, role: 'student' },
    });
    for (const classId of s.classIds) {
      if (!knownClassIds.has(classId)) {
        throw new Error(
          `Seed misconfigured: unknown classId ${classId} for student ${s.email}`,
        );
      }
      await prisma.classStudent.upsert({
        where: { classId_studentId: { classId, studentId: student.id } },
        update: {},
        create: { classId, studentId: student.id },
      });
    }
  }

  const [userCount, classCount, enrollmentCount] = await Promise.all([
    prisma.user.count(),
    prisma.class.count(),
    prisma.classStudent.count(),
  ]);
  console.log(
    `Seed complete: ${userCount} users, ${classCount} classes, ${enrollmentCount} enrollments.`,
  );
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
