import { PrismaClient } from '@prisma/client';
import { DEFAULT_GRADE_SCALE, scaleLetters } from '../src/calc/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Grade scale (source of truth for weights; adjustable by editing rows).
  let order = 0;
  for (const letter of scaleLetters(DEFAULT_GRADE_SCALE)) {
    const weight = DEFAULT_GRADE_SCALE[letter]!;
    await prisma.gradeScale.upsert({
      where: { letter },
      update: { weight, sortOrder: order },
      create: { letter, weight, sortOrder: order },
    });
    order += 1;
  }

  // Demo account so the app is runnable immediately (delete in production).
  const email = 'demo@ohmyipk.dev';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: 'Demo Mahasiswa',
        passwordHash: await bcrypt.hash('sandbox123', 10),
      },
    });
  }

  const hasPlan = await prisma.studyPlan.findFirst({ where: { userId: user.id } });
  if (!hasPlan) {
    await prisma.studyPlan.create({
      data: {
        userId: user.id,
        name: 'Rencana S1 — 144 SKS',
        totalCreditsTarget: 144,
        ipkTarget: 3.5,
        semesters: {
          create: [
            {
              term: 1,
              label: 'Semester 1',
              courses: {
                create: [
                  { name: 'Matematika Dasar', credits: 3, grade: 'A' },
                  { name: 'Fisika Dasar', credits: 4, grade: 'B+' },
                  { name: 'Kimia Dasar', credits: 3, grade: 'B' },
                  { name: 'Bahasa Indonesia', credits: 2, grade: 'A-' },
                  { name: 'Pemrograman Dasar', credits: 4, grade: null },
                  { name: 'Algoritma & Struktur Data', credits: 3, grade: null },
                ],
              },
            },
            {
              term: 2,
              label: 'Semester 2',
              ipsTarget: 3.6,
              courses: {
                create: [
                  { name: 'Struktur Data', credits: 3, grade: 'B+' },
                  { name: 'Kalkulus Lanjut', credits: 3, grade: null },
                  { name: 'Statistika', credits: 3, grade: null },
                  { name: 'Basis Data', credits: 3, grade: null },
                ],
              },
            },
          ],
        },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });