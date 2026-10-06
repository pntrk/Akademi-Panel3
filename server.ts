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
app.get('/api/teacher-data', async (req, res) => {
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

  // If cache is empty in RAM, check query fileId or cached fileId to fetch directly from Google Drive (Server-side 0-quota fetch)
  const fileId = (req.query.fileId as string) || teacherBroadcastCache?.data?.canonicalDriveFileId;
  if (fileId) {
    try {
      const urls = [
        `https://drive.google.com/uc?export=download&id=${fileId}`,
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`
      ];
      for (const url of urls) {
        try {
          const driveRes = await fetch(url);
          if (driveRes.ok) {
            const raw = await driveRes.json();
            const targetData = raw.data || raw.appState || raw;
            if (targetData && (Array.isArray(targetData.students) || Array.isArray(targetData.exams))) {
              return res.json({
                success: true,
                publishedAt: raw.publishedAt || new Date().toISOString(),
                publishedDateFormatted: raw.publishedDateFormatted || raw.lastTeacherPublishedDate || 'Güncel',
                version: raw.version || 1,
                summary: raw.summary || {
                  studentCount: targetData.students?.length || 0,
                  examCount: targetData.exams?.length || 0
                },
                data: targetData
              });
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('Server fallback Google Drive fetch notice:', e);
    }
  }

  // If no broadcast cache is present yet, respond with empty payload
  return res.status(200).json({
    success: false,
    message: 'Henüz öğretmenler için yayınlanmış veri bulunmamaktadır.',
    data: null
  });
});

// Google Drive Server-Side Proxy (Bypasses browser CORS & protects 0 Firebase Quota)
app.get('/api/drive-proxy', async (req, res) => {
  const fileId = req.query.fileId as string;
  if (!fileId) {
    return res.status(400).json({ success: false, error: 'Dosya kimliği (fileId) belirtilmedi.' });
  }

  try {
    const urls = [
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`
    ];

    for (const url of urls) {
      try {
        const driveRes = await fetch(url);
        if (driveRes.ok) {
          const json = await driveRes.json();
          return res.json({ success: true, data: json });
        }
      } catch {}
    }

    return res.status(502).json({ success: false, error: 'Google Drive kütük dosyasına erişilemedi veya dosya herkese açık değil.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Sunucu hatası' });
  }
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
