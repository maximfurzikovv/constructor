import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import excursionsRoutes from './routes/excursions';
import pointsRoutes from './routes/points';
import mediaRoutes from './routes/media';
import showcaseRoutes from './routes/showcase';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/excursions', excursionsRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/showcase', showcaseRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
