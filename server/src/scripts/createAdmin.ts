import prisma from '../db';
import { hashPassword } from '../authSecurity';

function requireValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const email = requireValue('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = requireValue('BOOTSTRAP_ADMIN_PASSWORD');
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Администратор';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address');
  }
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters and include upper-case, lower-case and a number');
  }

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, role: 'admin', password: hashPassword(password) },
    create: { email, name, role: 'admin', password: hashPassword(password) },
    select: { id: true, email: true },
  });

  console.log(`Administrator ${admin.email} is ready (id: ${admin.id}).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
