import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;
const CACHE_FILE = path.resolve('.teacher_broadcast_cache.json');

// Memory cache for teacher broadcast
let teacherBroadcastCache: any = null;

// Initialize cache from disk if available
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    teacherBroadcastCache = JSON.parse(raw);
    console.log('Teacher broadcast cache loaded from disk.');
  }
} catch (e) {
  console.warn('Could not read teacher broadcast cache from disk:', e);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasBroadcastCache: Boolean(teacherBroadcastCache),
    cachedPublishedDate: teacherBroadcastCache?.publishedDateFormatted || null,
    time: new Date().toISOString()
  });
});

// Teacher broadcast read endpoint (0 Firebase Quota)
app.get('/api/teacher-data', (_req, res) => {
  if (teacherBroadcastCache && teacherBroadcastCache.data) {
    return res.json({
      success: true,
      publishedAt: teacherBroadcastCache.publishedAt,
      publishedDateFormatted: teacherBroadcastCache.publishedDateFormatted,
      version: teacherBroadcastCache.version,
      summary: teacherBroadcastCache.summary,
      data: teacherBroadcastCache.data
    });
  }

  // If no broadcast cache is present yet, respond with empty payload
  return res.status(200).json({
    success: false,
    message: 'Henüz öğretmenler için yayınlanmış veri bulunmamaktadır.',
    data: null
  });
});

// Admin publish endpoint to update server broadcast cache
app.post('/api/teacher-broadcast/update', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.data) {
      return res.status(400).json({ success: false, error: 'Geçersiz veri paketi.' });
    }

    teacherBroadcastCache = payload;

    // Persist to disk asynchronously
    fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), (err) => {
      if (err) console.warn('Could not write cache file to disk:', err);
    });

    console.log(`Teacher broadcast cache updated at ${payload.publishedDateFormatted || new Date().toISOString()}`);
    return res.json({
      success: true,
      publishedDateFormatted: payload.publishedDateFormatted,
      version: payload.version
    });
  } catch (err: any) {
    console.error('teacher-broadcast update error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Sunucu hatası' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AkademiPanel Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
