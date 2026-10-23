import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/authSecurity';

const prisma = new PrismaClient();

function requireSeedValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for demo seed`);
  return value;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production');
  }
  if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Set ALLOW_DEMO_SEED=true explicitly to load demo data outside tests');
  }

  const demoEmail = requireSeedValue('DEMO_USER_EMAIL').toLowerCase();
  const demoPassword = requireSeedValue('DEMO_USER_PASSWORD');

  // Тестовый администратор создается только в изолированной тестовой среде.
  if (process.env.NODE_ENV === 'test') {
    const adminEmail = requireSeedValue('TEST_ADMIN_EMAIL').toLowerCase();
    const adminPassword = requireSeedValue('TEST_ADMIN_PASSWORD');
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { name: 'Test Administrator', role: 'admin', password: hashPassword(adminPassword) },
      create: { email: adminEmail, name: 'Test Administrator', role: 'admin', password: hashPassword(adminPassword) },
    });
  }

  // Проверяем, есть ли уже демонстрационный автор.
  const existingDemoUser = await prisma.user.findUnique({ where: { id: 'user-1' } });
  if (existingDemoUser) {
    // Обновляем демо-автора.
    await prisma.user.updateMany({ where: { id: 'user-1' }, data: { email: demoEmail, name: 'Максим Фурзиков', role: 'guide', password: hashPassword(demoPassword) } });
    // Обновляем демо-экскурсии.
    await prisma.excursion.updateMany({ where: { id: 'exc-1' }, data: { title: 'Классический Петербург', description: 'Пешеходная экскурсия по главным достопримечательностям центра Санкт-Петербурга: от Дворцовой площади до Исаакиевского собора.', city: 'Санкт-Петербург' } });
    await prisma.excursion.updateMany({ where: { id: 'exc-2' }, data: { title: 'Васильевский остров', description: 'Прогулка по Васильевскому острову от Стрелки до Академии художеств.', city: 'Санкт-Петербург' } });
    await prisma.excursion.updateMany({ where: { id: 'exc-3' }, data: { title: 'Сердце Москвы', description: 'Маршрут по историческому центру Москвы.', city: 'Москва' } });
    // Обновляем демо-точки первого маршрута.
    await prisma.point.updateMany({ where: { routeId: 'route-1', order: 0 }, data: { title: 'Дворцовая площадь', description: 'Главная площадь Санкт-Петербурга с Александровской колонной и Зимним дворцом.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-1', order: 1 }, data: { title: 'Спас на Крови', description: 'Храм Воскресения Христова, построенный на месте смертельного ранения Александра II.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-1', order: 2 }, data: { title: 'Михайловский сад', description: 'Один из старейших садов Петербурга рядом с Русским музеем.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-1', order: 3 }, data: { title: 'Казанский собор', description: 'Кафедральный собор, построенный по проекту Андрея Воронихина.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-1', order: 4 }, data: { title: 'Исаакиевский собор', description: 'Крупнейший православный храм Петербурга и одна из главных городских доминант.' } });
    // Обновляем демо-точки второго маршрута.
    await prisma.point.updateMany({ where: { routeId: 'route-2', order: 0 }, data: { title: 'Стрелка Васильевского острова', description: 'Восточная оконечность острова с ростральными колоннами.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-2', order: 1 }, data: { title: 'Кунсткамера', description: 'Первый музей России, основанный Петром I.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-2', order: 2 }, data: { title: 'Здание Двенадцати коллегий', description: 'Историческое здание Санкт-Петербургского университета.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-2', order: 3 }, data: { title: 'Академия художеств', description: 'Императорская Академия художеств со знаменитыми сфинксами на набережной.' } });
    // Обновляем демо-точки третьего маршрута.
    await prisma.point.updateMany({ where: { routeId: 'route-3', order: 0 }, data: { title: 'Красная площадь', description: 'Главная площадь страны и один из символов Москвы.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-3', order: 1 }, data: { title: 'Александровский сад', description: 'Парк у стен Кремля.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-3', order: 2 }, data: { title: 'Храм Христа Спасителя', description: 'Кафедральный собор Русской православной церкви.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-3', order: 3 }, data: { title: 'Патриарший мост', description: 'Пешеходный мост через Москву-реку.' } });
    await prisma.point.updateMany({ where: { routeId: 'route-3', order: 4 }, data: { title: 'Третьяковская галерея', description: 'Крупнейший музей русского искусства.' } });
    // Обновляем сайт-витрину автора.
    await prisma.showcaseSite.updateMany({ where: { id: 'site-1' }, data: { title: 'Экскурсии Максима Фурзикова', description: 'Авторские пешеходные экскурсии по Санкт-Петербургу и Москве.' } });
    console.log('Database already seeded, skipping.');
    return;
  }

  // Создаем демонстрационного автора.
  const demoPasswordHash = hashPassword(demoPassword); // Хэш пароля из окружения
  const user = await prisma.user.create({
    data: {
      id: 'user-1',
      email: demoEmail,
      password: demoPasswordHash,
      name: 'Максим Фурзиков',
      role: 'guide',
    },
  });

  // Экскурсия 1: классический маршрут по Петербургу.
  await prisma.excursion.create({
    data: {
      id: 'exc-1',
      title: 'Классический Петербург',
      description: 'Пешеходная экскурсия по главным достопримечательностям центра Санкт-Петербурга: от Дворцовой площади до Исаакиевского собора.',
      authorId: user.id,
      status: 'published',
      city: 'Санкт-Петербург',
      route: {
        create: {
          id: 'route-1',
          duration: 90,
          distance: 3200,
          transport: 'walk',
          routeJson: JSON.stringify({
            type: 'LineString',
            coordinates: [
              [30.3158, 59.9390], [30.3289, 59.9400], [30.3320, 59.9395],
              [30.3245, 59.9343], [30.3063, 59.9340],
            ],
          }),
        },
      },
    },
  });

  // Точки первого маршрута.
  await prisma.point.createMany({
    data: [
      { routeId: 'route-1', title: 'Дворцовая площадь', description: 'Главная площадь Санкт-Петербурга с Александровской колонной и Зимним дворцом.', lat: 59.9390, lng: 30.3158, order: 0, duration: 15, radius: 50 },
      { routeId: 'route-1', title: 'Спас на Крови', description: 'Храм Воскресения Христова, построенный на месте смертельного ранения Александра II.', lat: 59.9400, lng: 30.3289, order: 1, duration: 20, radius: 50 },
      { routeId: 'route-1', title: 'Михайловский сад', description: 'Один из старейших садов Петербурга рядом с Русским музеем.', lat: 59.9395, lng: 30.3320, order: 2, duration: 10, radius: 50 },
      { routeId: 'route-1', title: 'Казанский собор', description: 'Кафедральный собор, построенный по проекту Андрея Воронихина.', lat: 59.9343, lng: 30.3245, order: 3, duration: 15, radius: 50 },
      { routeId: 'route-1', title: 'Исаакиевский собор', description: 'Крупнейший православный храм Петербурга и одна из главных городских доминант.', lat: 59.9340, lng: 30.3063, order: 4, duration: 20, radius: 50 },
    ],
  });

  // Экскурсия 2: Васильевский остров.
  await prisma.excursion.create({
    data: {
      id: 'exc-2',
      title: 'Васильевский остров',
      description: 'Прогулка по Васильевскому острову от Стрелки до Академии художеств.',
      authorId: user.id,
      status: 'draft',
      city: 'Санкт-Петербург',
      route: {
        create: {
          id: 'route-2',
          duration: 70,
          distance: 2100,
          transport: 'walk',
          routeJson: JSON.stringify({
            type: 'LineString',
            coordinates: [
              [30.3064, 59.9444], [30.3045, 59.9416], [30.2997, 59.9412], [30.2903, 59.9366],
            ],
          }),
        },
      },
    },
  });

  // Точки второго маршрута.
  await prisma.point.createMany({
    data: [
      { routeId: 'route-2', title: 'Стрелка Васильевского острова', description: 'Восточная оконечность острова с ростральными колоннами.', lat: 59.9444, lng: 30.3064, order: 0, duration: 15, radius: 50 },
      { routeId: 'route-2', title: 'Кунсткамера', description: 'Первый музей России, основанный Петром I.', lat: 59.9416, lng: 30.3045, order: 1, duration: 25, radius: 50 },
      { routeId: 'route-2', title: 'Здание Двенадцати коллегий', description: 'Историческое здание Санкт-Петербургского университета.', lat: 59.9412, lng: 30.2997, order: 2, duration: 10, radius: 50 },
      { routeId: 'route-2', title: 'Академия художеств', description: 'Императорская Академия художеств со знаменитыми сфинксами на набережной.', lat: 59.9366, lng: 30.2903, order: 3, duration: 15, radius: 50 },
    ],
  });

  // Экскурсия 3: центр Москвы.
  await prisma.excursion.create({
    data: {
      id: 'exc-3',
      title: 'Сердце Москвы',
      description: 'Маршрут по историческому центру Москвы.',
      authorId: user.id,
      status: 'published',
      city: 'Москва',
      route: {
        create: {
          id: 'route-3',
          duration: 120,
          distance: 4500,
          transport: 'walk',
          routeJson: JSON.stringify({
            type: 'LineString',
            coordinates: [
              [37.6208, 55.7539], [37.6134, 55.7527], [37.6054, 55.7446],
              [37.6088, 55.7434], [37.6208, 55.7415],
            ],
          }),
        },
      },
    },
  });

  // Точки третьего маршрута.
  await prisma.point.createMany({
    data: [
      { routeId: 'route-3', title: 'Красная площадь', description: 'Главная площадь страны и один из символов Москвы.', lat: 55.7539, lng: 37.6208, order: 0, duration: 20, radius: 50 },
      { routeId: 'route-3', title: 'Александровский сад', description: 'Парк у стен Кремля.', lat: 55.7527, lng: 37.6134, order: 1, duration: 15, radius: 50 },
      { routeId: 'route-3', title: 'Храм Христа Спасителя', description: 'Кафедральный собор Русской православной церкви.', lat: 55.7446, lng: 37.6054, order: 2, duration: 20, radius: 50 },
      { routeId: 'route-3', title: 'Патриарший мост', description: 'Пешеходный мост через Москву-реку.', lat: 55.7434, lng: 37.6088, order: 3, duration: 10, radius: 50 },
      { routeId: 'route-3', title: 'Третьяковская галерея', description: 'Крупнейший музей русского искусства.', lat: 55.7415, lng: 37.6208, order: 4, duration: 30, radius: 50 },
    ],
  });

  // Сайт-витрина автора.
  await prisma.showcaseSite.create({
    data: {
      id: 'site-1',
      authorId: user.id,
      slug: 'maxim-furzikov',
      title: 'Экскурсии Максима Фурзикова',
      description: 'Авторские пешеходные экскурсии по Санкт-Петербургу и Москве.',
      theme: 'light',
      published: true,
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
