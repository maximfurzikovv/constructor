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
      name: 'Максим Фурзиков',
      role: 'author',
    },
  });

  // Excursion 1: РљР»Р°СЃСЃРёС‡РµСЃРєРёР№ РџРµС‚РµСЂР±СѓСЂРі
  const exc1 = await prisma.excursion.create({
    data: {
      id: 'exc-1',
      title: 'Классический Петербург',
      description: 'РџРµС€РµС…РѕРґРЅР°СЏ СЌРєСЃРєСѓСЂСЃРёСЏ РїРѕ РіР»Р°РІРЅС‹Рј РґРѕСЃС‚РѕРїСЂРёРјРµС‡Р°С‚РµР»СЊРЅРѕСЃС‚СЏРј С†РµРЅС‚СЂР° РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРіР°: РѕС‚ Р”РІРѕСЂС†РѕРІРѕР№ РїР»РѕС‰Р°РґРё РґРѕ РСЃР°Р°РєРёРµРІСЃРєРѕРіРѕ СЃРѕР±РѕСЂР°.',
      authorId: user.id,
      status: 'published',
      city: 'РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі',
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
      { routeId: 'route-1', title: 'Р”РІРѕСЂС†РѕРІР°СЏ РїР»РѕС‰Р°РґСЊ', description: 'Р“Р»Р°РІРЅР°СЏ РїР»РѕС‰Р°РґСЊ РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРіР° СЃ РђР»РµРєСЃР°РЅРґСЂРѕРІСЃРєРѕР№ РєРѕР»РѕРЅРЅРѕР№ Рё Р—РёРјРЅРёРј РґРІРѕСЂС†РѕРј.', lat: 59.9390, lng: 30.3158, order: 0, duration: 15, radius: 50 },
      { routeId: 'route-1', title: 'РЎРїР°СЃ РЅР° РљСЂРѕРІРё', description: 'РҐСЂР°Рј Р’РѕСЃРєСЂРµСЃРµРЅРёСЏ РҐСЂРёСЃС‚РѕРІР°, РїРѕСЃС‚СЂРѕРµРЅРЅС‹Р№ РЅР° РјРµСЃС‚Рµ СЃРјРµСЂС‚РµР»СЊРЅРѕРіРѕ СЂР°РЅРµРЅРёСЏ РђР»РµРєСЃР°РЅРґСЂР° II.', lat: 59.9400, lng: 30.3289, order: 1, duration: 20, radius: 50 },
      { routeId: 'route-1', title: 'РњРёС…Р°Р№Р»РѕРІСЃРєРёР№ СЃР°Рґ', description: 'РћРґРёРЅ РёР· СЃС‚Р°СЂРµР№С€РёС… СЃР°РґРѕРІ РџРµС‚РµСЂР±СѓСЂРіР°.', lat: 59.9395, lng: 30.3320, order: 2, duration: 10, radius: 50 },
      { routeId: 'route-1', title: 'РљР°Р·Р°РЅСЃРєРёР№ СЃРѕР±РѕСЂ', description: 'РљР°С„РµРґСЂР°Р»СЊРЅС‹Р№ СЃРѕР±РѕСЂ, РїРѕСЃС‚СЂРѕРµРЅРЅС‹Р№ РїРѕ РїСЂРѕРµРєС‚Сѓ Р’РѕСЂРѕРЅРёС…РёРЅР°.', lat: 59.9343, lng: 30.3245, order: 3, duration: 15, radius: 50 },
      { routeId: 'route-1', title: 'РСЃР°Р°РєРёРµРІСЃРєРёР№ СЃРѕР±РѕСЂ', description: 'РљСЂСѓРїРЅРµР№С€РёР№ РїСЂР°РІРѕСЃР»Р°РІРЅС‹Р№ С…СЂР°Рј РџРµС‚РµСЂР±СѓСЂРіР°.', lat: 59.9340, lng: 30.3063, order: 4, duration: 20, radius: 50 },
    ],
  });

  // Excursion 2: Р’Р°СЃРёР»СЊРµРІСЃРєРёР№ РѕСЃС‚СЂРѕРІ
  const exc2 = await prisma.excursion.create({
    data: {
      id: 'exc-2',
      title: 'Васильевский остров',
      description: 'РџСЂРѕРіСѓР»РєР° РїРѕ Р’Р°СЃРёР»СЊРµРІСЃРєРѕРјСѓ РѕСЃС‚СЂРѕРІСѓ вЂ” РѕС‚ РЎС‚СЂРµР»РєРё РґРѕ РђРєР°РґРµРјРёРё С…СѓРґРѕР¶РµСЃС‚РІ.',
      authorId: user.id,
      status: 'draft',
      city: 'РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі',
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
      { routeId: 'route-2', title: 'РЎС‚СЂРµР»РєР° Р’Р°СЃРёР»СЊРµРІСЃРєРѕРіРѕ РѕСЃС‚СЂРѕРІР°', description: 'Р’РѕСЃС‚РѕС‡РЅР°СЏ РѕРєРѕРЅРµС‡РЅРѕСЃС‚СЊ РѕСЃС‚СЂРѕРІР° СЃ СЂРѕСЃС‚СЂР°Р»СЊРЅС‹РјРё РєРѕР»РѕРЅРЅР°РјРё.', lat: 59.9444, lng: 30.3064, order: 0, duration: 15, radius: 50 },
      { routeId: 'route-2', title: 'РљСѓРЅСЃС‚РєР°РјРµСЂР°', description: 'РџРµСЂРІС‹Р№ РјСѓР·РµР№ Р РѕСЃСЃРёРё, РѕСЃРЅРѕРІР°РЅРЅС‹Р№ РџРµС‚СЂРѕРј I.', lat: 59.9416, lng: 30.3045, order: 1, duration: 25, radius: 50 },
      { routeId: 'route-2', title: 'Р—РґР°РЅРёРµ Р”РІРµРЅР°РґС†Р°С‚Рё РєРѕР»Р»РµРіРёР№', description: 'Р—РґР°РЅРёРµ РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРіСЃРєРѕРіРѕ СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р°.', lat: 59.9412, lng: 30.2997, order: 2, duration: 10, radius: 50 },
      { routeId: 'route-2', title: 'РђРєР°РґРµРјРёСЏ С…СѓРґРѕР¶РµСЃС‚РІ', description: 'РРјРїРµСЂР°С‚РѕСЂСЃРєР°СЏ РђРєР°РґРµРјРёСЏ С…СѓРґРѕР¶РµСЃС‚РІ СЃРѕ СЃС„РёРЅРєСЃР°РјРё.', lat: 59.9366, lng: 30.2903, order: 3, duration: 15, radius: 50 },
    ],
  });

  // Excursion 3: РЎРµСЂРґС†Рµ РњРѕСЃРєРІС‹
  const exc3 = await prisma.excursion.create({
    data: {
      id: 'exc-3',
      title: 'Сердце Москвы',
      description: 'РњР°СЂС€СЂСѓС‚ РїРѕ РёСЃС‚РѕСЂРёС‡РµСЃРєРѕРјСѓ С†РµРЅС‚СЂСѓ РњРѕСЃРєРІС‹.',
      authorId: user.id,
      status: 'published',
      city: 'РњРѕСЃРєРІР°',
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
      { routeId: 'route-3', title: 'РљСЂР°СЃРЅР°СЏ РїР»РѕС‰Р°РґСЊ', description: 'Р“Р»Р°РІРЅР°СЏ РїР»РѕС‰Р°РґСЊ СЃС‚СЂР°РЅС‹.', lat: 55.7539, lng: 37.6208, order: 0, duration: 20, radius: 50 },
      { routeId: 'route-3', title: 'РђР»РµРєСЃР°РЅРґСЂРѕРІСЃРєРёР№ СЃР°Рґ', description: 'РџР°СЂРє Сѓ СЃС‚РµРЅ РљСЂРµРјР»СЏ.', lat: 55.7527, lng: 37.6134, order: 1, duration: 15, radius: 50 },
      { routeId: 'route-3', title: 'РҐСЂР°Рј РҐСЂРёСЃС‚Р° РЎРїР°СЃРёС‚РµР»СЏ', description: 'РљР°С„РµРґСЂР°Р»СЊРЅС‹Р№ СЃРѕР±РѕСЂ Р РџР¦.', lat: 55.7446, lng: 37.6054, order: 2, duration: 20, radius: 50 },
      { routeId: 'route-3', title: 'РџР°С‚СЂРёР°СЂС€РёР№ РјРѕСЃС‚', description: 'РџРµС€РµС…РѕРґРЅС‹Р№ РјРѕСЃС‚ С‡РµСЂРµР· РњРѕСЃРєРІСѓ-СЂРµРєСѓ.', lat: 55.7434, lng: 37.6088, order: 3, duration: 10, radius: 50 },
      { routeId: 'route-3', title: 'РўСЂРµС‚СЊСЏРєРѕРІСЃРєР°СЏ РіР°Р»РµСЂРµСЏ', description: 'РљСЂСѓРїРЅРµР№С€РёР№ РјСѓР·РµР№ СЂСѓСЃСЃРєРѕРіРѕ РёСЃРєСѓСЃСЃС‚РІР°.', lat: 55.7415, lng: 37.6208, order: 4, duration: 30, radius: 50 },
    ],
  });

  // Showcase site
  await prisma.showcaseSite.create({
    data: {
      id: 'site-1',
      authorId: user.id,
      slug: 'maxim-furzikov',
      title: 'Экскурсии Максима Фурзикова',
      description: 'РђРІС‚РѕСЂСЃРєРёРµ РїРµС€РµС…РѕРґРЅС‹Рµ СЌРєСЃРєСѓСЂСЃРёРё РїРѕ РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРіСѓ Рё РњРѕСЃРєРІРµ.',
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

