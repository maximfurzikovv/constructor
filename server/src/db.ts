import { PrismaClient } from '@prisma/client';
// Экземпляр клиента Prisma:
const prisma = new PrismaClient();
// Операции БД с повторными попытками:
export async function withDbRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown; // Последняя ошибка
  // Цикл попыток:
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }

  throw lastError;
}
// Экспорт по умолчанию:
export default prisma;
