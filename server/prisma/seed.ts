import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check if data already exists
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      id: 'user-1',
      email: 'guide@example.com',
      password: 'password123',
      name: 'Алексей Петров',
      role: 'author',
    },
  });

  // Excursion 1: Классический Петербург
  const exc1 = await prisma.excursion.create({
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

  await prisma.point.createMany({
    data: [
      { routeId: 'route-1', title: 'Дворцовая площадь', description: 'Главная площадь Санкт-Петербурга с Александровской колонной и Зимним дворцом.', lat: 59.9390, lng: 30.3158, order: 0, duration: 15, radius: 50 },
      { routeId: 'route-1', title: 'Спас на Крови', description: 'Храм Воскресения Христова, построенный на месте смертельного ранения Александра II.', lat: 59.9400, lng: 30.3289, order: 1, duration: 20, radius: 50 },
      { routeId: 'route-1', title: 'Михайловский сад', description: 'Один из старейших садов Петербурга.', lat: 59.9395, lng: 30.3320, order: 2, duration: 10, radius: 50 },
      { routeId: 'route-1', title: 'Казанский собор', description: 'Кафедральный собор, построенный по проекту Воронихина.', lat: 59.9343, lng: 30.3245, order: 3, duration: 15, radius: 50 },
      { routeId: 'route-1', title: 'Исаакиевский собор', description: 'Крупнейший православный храм Петербурга.', lat: 59.9340, lng: 30.3063, order: 4, duration: 20, radius: 50 },
    ],
  });

  // Excursion 2: Васильевский остров
  const exc2 = await prisma.excursion.create({
    data: {
      id: 'exc-2',
      title: 'Васильевский остров',
      description: 'Прогулка по Васильевскому острову — от Стрелки до Академии художеств.',
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

  await prisma.point.createMany({
    data: [
      { routeId: 'route-2', title: 'Стрелка Васильевского острова', description: 'Восточная оконечность острова с ростральными колоннами.', lat: 59.9444, lng: 30.3064, order: 0, duration: 15, radius: 50 },
      { routeId: 'route-2', title: 'Кунсткамера', description: 'Первый музей России, основанный Петром I.', lat: 59.9416, lng: 30.3045, order: 1, duration: 25, radius: 50 },
      { routeId: 'route-2', title: 'Здание Двенадцати коллегий', description: 'Здание Санкт-Петербургского университета.', lat: 59.9412, lng: 30.2997, order: 2, duration: 10, radius: 50 },
      { routeId: 'route-2', title: 'Академия художеств', description: 'Императорская Академия художеств со сфинксами.', lat: 59.9366, lng: 30.2903, order: 3, duration: 15, radius: 50 },
    ],
  });

  // Excursion 3: Сердце Москвы
  const exc3 = await prisma.excursion.create({
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

  await prisma.point.createMany({
    data: [
      { routeId: 'route-3', title: 'Красная площадь', description: 'Главная площадь страны.', lat: 55.7539, lng: 37.6208, order: 0, duration: 20, radius: 50 },
      { routeId: 'route-3', title: 'Александровский сад', description: 'Парк у стен Кремля.', lat: 55.7527, lng: 37.6134, order: 1, duration: 15, radius: 50 },
      { routeId: 'route-3', title: 'Храм Христа Спасителя', description: 'Кафедральный собор РПЦ.', lat: 55.7446, lng: 37.6054, order: 2, duration: 20, radius: 50 },
      { routeId: 'route-3', title: 'Патриарший мост', description: 'Пешеходный мост через Москву-реку.', lat: 55.7434, lng: 37.6088, order: 3, duration: 10, radius: 50 },
      { routeId: 'route-3', title: 'Третьяковская галерея', description: 'Крупнейший музей русского искусства.', lat: 55.7415, lng: 37.6208, order: 4, duration: 30, radius: 50 },
    ],
  });

  // Showcase site
  await prisma.showcaseSite.create({
    data: {
      id: 'site-1',
      authorId: user.id,
      slug: 'aleksey-petrov',
      title: 'Экскурсии Алексея Петрова',
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
