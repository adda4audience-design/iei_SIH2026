import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding IEI database...');

  // Admin user
  const adminHash = await bcrypt.hash('admin@IEI2026', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@iei.gov.in' },
    update: {},
    create: {
      email: 'admin@iei.gov.in',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user:', admin.email);

  // Officer users
  const officerHash = await bcrypt.hash('officer@IEI2026', 12);

  const officer1User = await prisma.user.upsert({
    where: { email: 'officer1@iei.gov.in' },
    update: {},
    create: {
      email: 'officer1@iei.gov.in',
      passwordHash: officerHash,
      role: 'OFFICER',
      officer: {
        create: {
          name: 'Rajesh Kumar',
          designation: 'Senior Review Officer',
          department: 'Technical Education Review',
          employeeId: 'OFF-001',
        },
      },
    },
  });

  const officer2User = await prisma.user.upsert({
    where: { email: 'officer2@iei.gov.in' },
    update: {},
    create: {
      email: 'officer2@iei.gov.in',
      passwordHash: officerHash,
      role: 'OFFICER',
      officer: {
        create: {
          name: 'Priya Sharma',
          designation: 'Document Verification Officer',
          department: 'Forensic Review Division',
          employeeId: 'OFF-002',
        },
      },
    },
  });

  console.log('✅ Officers created:', officer1User.email, officer2User.email);

  // Institute users
  const instituteHash = await bcrypt.hash('institute@IEI2026', 12);

  const inst1User = await prisma.user.upsert({
    where: { email: 'admin@techuniversity.ac.in' },
    update: {},
    create: {
      email: 'admin@techuniversity.ac.in',
      passwordHash: instituteHash,
      role: 'INSTITUTE',
      institute: {
        create: {
          name: 'National Institute of Technology',
          code: 'NIT-KAR-001',
          type: 'Engineering',
          address: '1, NIT Campus, Surathkal',
          city: 'Mangaluru',
          state: 'Karnataka',
          pincode: '575025',
          contactName: 'Dr. Anand Rao',
          contactPhone: '9876543210',
          isVerified: true,
        },
      },
    },
    include: { institute: true },
  });

  const inst2User = await prisma.user.upsert({
    where: { email: 'registrar@globaltech.edu.in' },
    update: {},
    create: {
      email: 'registrar@globaltech.edu.in',
      passwordHash: instituteHash,
      role: 'INSTITUTE',
      institute: {
        create: {
          name: 'Global Technology Institute',
          code: 'GTI-MH-042',
          type: 'Engineering',
          address: '42, Techpark Road, Baner',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411045',
          contactName: 'Ms. Deepa Kulkarni',
          contactPhone: '9123456780',
          isVerified: false,
        },
      },
    },
    include: { institute: true },
  });

  console.log('✅ Institutes created:', inst1User.email, inst2User.email);

  // Sample applications with findings
  const institute1 = await prisma.institute.findUnique({ where: { userId: inst1User.id } });
  const institute2 = await prisma.institute.findUnique({ where: { userId: inst2User.id } });
  const officer1 = await prisma.officer.findUnique({ where: { userId: officer1User.id } });

  if (institute1 && institute2 && officer1) {
    // Application 1 - Under review with contradiction
    const app1 = await prisma.application.upsert({
      where: { applicationNumber: 'SEED-APP-001' },
      update: {},
      create: {
        applicationNumber: 'SEED-APP-001',
        instituteId: institute1.id,
        assignedOfficerId: officer1.id,
        title: 'Annual Compliance Report 2026-27',
        description: 'Submission of annual compliance documents including intake capacity and faculty details',
        status: 'UNDER_REVIEW',
        submittedAt: new Date('2026-10-01'),
        reviewStartedAt: new Date('2026-10-05'),
      },
    });

    // Sample finding for app1
    await prisma.finding.upsert({
      where: { id: 'seed-finding-001' },
      update: {},
      create: {
        id: 'seed-finding-001',
        applicationId: app1.id,
        type: 'CONTRADICTION',
        severity: 'HIGH',
        title: 'Contradiction detected: approved_intake',
        description: 'Different values found for "approved_intake" across submitted documents. Prior approval states 90, new application states 120. An amendment document may explain this change — please verify.',
        evidence: {
          field: 'approved_intake',
          values: [
            { document: '2024_AICTE_Approval.pdf', value: '90', documentId: 'doc-placeholder' },
            { document: 'New_Application_2026.pdf', value: '120', documentId: 'doc-placeholder-2' },
          ],
          note: 'Check if a valid amendment exists. Verify through DTE API if available.',
        },
      },
    });

    // Application 2 - Draft
    await prisma.application.upsert({
      where: { applicationNumber: 'SEED-APP-002' },
      update: {},
      create: {
        applicationNumber: 'SEED-APP-002',
        instituteId: institute2.id,
        title: 'New Programme Approval - Data Science B.Tech',
        description: 'Application for new programme introduction under expansion scheme',
        status: 'SUBMITTED',
        submittedAt: new Date('2026-10-15'),
      },
    });

    // Application 3 - Approved
    await prisma.application.upsert({
      where: { applicationNumber: 'SEED-APP-003' },
      update: {},
      create: {
        applicationNumber: 'SEED-APP-003',
        instituteId: institute1.id,
        assignedOfficerId: officer1.id,
        title: 'Infrastructure Verification 2025',
        description: 'Annual infrastructure verification submission',
        status: 'APPROVED',
        submittedAt: new Date('2025-08-01'),
        reviewStartedAt: new Date('2025-08-10'),
        resolvedAt: new Date('2025-09-01'),
        officerNotes: 'All documents verified. Infrastructure meets required standards.',
      },
    });

    console.log('✅ Sample applications and findings created');
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────');
  console.log('Login credentials:');
  console.log('');
  console.log('ADMIN:');
  console.log('  Email:    admin@iei.gov.in');
  console.log('  Password: admin@IEI2026');
  console.log('  Role:     ADMIN');
  console.log('');
  console.log('OFFICERS:');
  console.log('  Email:    officer1@iei.gov.in');
  console.log('  Email:    officer2@iei.gov.in');
  console.log('  Password: officer@IEI2026');
  console.log('  Role:     OFFICER');
  console.log('');
  console.log('INSTITUTES:');
  console.log('  Email:    admin@techuniversity.ac.in');
  console.log('  Email:    registrar@globaltech.edu.in');
  console.log('  Password: institute@IEI2026');
  console.log('  Role:     INSTITUTE');
  console.log('─────────────────────────────────────');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
