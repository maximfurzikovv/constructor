import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db';

const router = Router();

// Old local uploads remain readable, but new demo uploads are DB-backed.
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.get('/', async (req, res) => {
  const { excursionId } = req.query;
  const media = await prisma.media.findMany({
    where: excursionId ? { excursionId: excursionId as string } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: media });
});

router.get('/:id', async (req, res) => {
  const item = await prisma.media.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Media not found' });
  res.json({ data: item });
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  if (!req.body.excursionId) return res.status(400).json({ error: 'excursionId is required' });

  const url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  const type = req.file.mimetype.startsWith('image/')
    ? 'image'
    : req.file.mimetype.startsWith('audio/')
      ? 'audio'
      : 'video';

  const item = await prisma.media.create({
    data: {
      excursionId: req.body.excursionId,
      pointId: req.body.pointId || null,
      type,
      url,
      title: req.body.title || req.file.originalname,
      description: req.body.description || null,
    },
  });
  res.status(201).json({ data: item });
});

router.post('/', async (req, res) => {
  const item = await prisma.media.create({
    data: {
      excursionId: req.body.excursionId,
      pointId: req.body.pointId || null,
      type: req.body.type || 'image',
      url: req.body.url || '',
      title: req.body.title || 'Untitled',
      description: req.body.description,
    },
  });
  res.status(201).json({ data: item });
});

router.put('/:id', async (req, res) => {
  try {
    const item = await prisma.media.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        description: req.body.description,
        pointId: req.body.pointId === undefined ? undefined : req.body.pointId || null,
      },
    });
    res.json({ data: item });
  } catch {
    res.status(500).json({ error: 'Failed to update media' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await prisma.media.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Media not found' });

    if (item.url.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(item.url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.media.delete({ where: { id: req.params.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

export default router;
