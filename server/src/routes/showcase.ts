import { Router } from 'express';
import prisma from '../db';

const router = Router();

function normalizeSlug(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

router.get('/constructor/data', async (_req, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
  if (!site || !site.constructorJson) {
    return res.json({ data: null });
  }
  const data = JSON.parse(site.constructorJson);
  res.json({ data: { ...data, siteSlug: data.siteSlug || site.slug } });
});

router.put('/constructor', async (req, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const slug = normalizeSlug(req.body.siteSlug, site.slug);
  const payload = { ...req.body, siteSlug: slug };
  const json = JSON.stringify(payload);

  await prisma.showcaseSite.update({
    where: { id: site.id },
    data: {
      constructorJson: json,
      publishedJson: json,
      published: true,
      slug,
    },
  });

  res.json({ data: { success: true, slug } });
});

router.put('/constructor/draft', async (req, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const slug = normalizeSlug(req.body.siteSlug, site.slug);
  const payload = { ...req.body, siteSlug: slug };

  await prisma.showcaseSite.update({
    where: { id: site.id },
    data: {
      constructorJson: JSON.stringify(payload),
      slug,
    },
  });

  res.json({ data: { success: true, slug } });
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

  if (!site) return res.status(404).json({ error: 'Site not found' });

  const publishedExcursions = await prisma.excursion.findMany({
    where: { status: 'published', authorId: site.authorId },
    include: {
      route: {
        include: { _count: { select: { points: true } } },
      },
    },
  });

  const excursionDetails = publishedExcursions.map((e) => {
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

  const constructorData = site.published
    ? (site.publishedJson ? JSON.parse(site.publishedJson) : (site.constructorJson ? JSON.parse(site.constructorJson) : null))
    : null;

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
      constructorData: constructorData ? { ...constructorData, siteSlug: constructorData.siteSlug || site.slug } : null,
    },
  });
});

router.put('/', async (req, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
  if (!site) return res.status(404).json({ error: 'Site not found' });
  const updated = await prisma.showcaseSite.update({
    where: { id: site.id },
    data: req.body,
  });
  res.json({ data: updated });
});

export default router;
