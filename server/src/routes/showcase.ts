import { Router } from 'express';
import prisma from '../db';

const router = Router();

router.get('/constructor/data', async (_req, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
  if (!site || !site.constructorJson) {
    return res.json({ data: null });
  }
  res.json({ data: JSON.parse(site.constructorJson) });
});

// Publish: save to both draft and published
router.put('/constructor', async (req, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
  if (!site) return res.status(404).json({ error: 'Сайт не найден' });
  const json = JSON.stringify(req.body);
  await prisma.showcaseSite.update({
    where: { id: site.id },
    data: {
      constructorJson: json,
      publishedJson: json,
      published: true,
      title: 'Экскурсии Максима Фурзикова',
      slug: 'maxim-furzikov',
    },
  });
  res.json({ data: { success: true } });
});

// Save draft only (does NOT update publishedJson)
router.put('/constructor/draft', async (req, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
  if (!site) return res.status(404).json({ error: 'Сайт не найден' });
  await prisma.showcaseSite.update({
    where: { id: site.id },
    data: {
      constructorJson: JSON.stringify(req.body),
      title: 'Экскурсии Максима Фурзикова',
      slug: 'maxim-furzikov',
    },
  });
  res.json({ data: { success: true } });
});

router.get('/:slug', async (req, res) => {
  let site = await prisma.showcaseSite.findUnique({
    where: { slug: req.params.slug },
  });
  if (!site && req.params.slug === 'maxim-furzikov') {
    const current = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
    if (current) {
      site = await prisma.showcaseSite.update({
        where: { id: current.id },
        data: { slug: 'maxim-furzikov', title: 'Экскурсии Максима Фурзикова' },
      });
    }
  }
  if (!site) return res.status(404).json({ error: 'Сайт не найден' });

  const publishedExcursions = await prisma.excursion.findMany({
    where: { status: 'published', authorId: site.authorId },
    include: {
      route: {
        include: { _count: { select: { points: true } } },
      },
    },
  });

  const excursionDetails = publishedExcursions.map((e) => {
    // Use publishedSnapshot if available
    if (e.publishedSnapshot) {
      const snap = JSON.parse(e.publishedSnapshot);
      return {
        id: snap.id,
        title: snap.title,
        description: snap.description,
        city: snap.city,
        duration: snap.route?.duration || 0,
        distance: snap.route?.distance || 0,
        transport: snap.route?.transport || 'walk',
        status: snap.status,
      };
    }
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      city: e.city,
      duration: e.route?.duration || 0,
      distance: e.route?.distance || 0,
      transport: e.route?.transport || 'walk',
      status: e.status,
    };
  });

  res.json({
    data: {
      id: site.id,
      authorId: site.authorId,
      slug: site.slug,
      title: site.title,
      description: site.description,
      theme: site.theme,
      published: site.published,
      createdAt: site.createdAt.toISOString(),
      excursionDetails,
      constructorData: site.published
        ? (site.publishedJson ? JSON.parse(site.publishedJson) : (site.constructorJson ? JSON.parse(site.constructorJson) : null))
        : null,
    },
  });
});

router.put('/', async (req, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
  if (!site) return res.status(404).json({ error: 'Сайт не найден' });
  const updated = await prisma.showcaseSite.update({
    where: { id: site.id },
    data: req.body,
  });
  res.json({ data: updated });
});

export default router;
