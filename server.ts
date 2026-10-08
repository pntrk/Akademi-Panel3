import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;
const CACHE_FILE = path.resolve('.teacher_broadcast_cache.json');
const DEFAULT_CANONICAL_DRIVE_FILE_ID = '1g24DSyjP7u3OaIoUz3MGeVlS5HsqmrIg';

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

// Helper to unwrap nested school state
function unwrapServerSchoolPayload(raw: any): any {
  if (!raw || typeof raw !== 'object') return null;
  let curr = raw;
  if (curr.success && curr.data) curr = curr.data;
  if (curr && curr.data && (Array.isArray(curr.data.students) || Array.isArray(curr.data.exams) || Array.isArray(curr.data.examHalls))) {
    return curr.data;
  }
  if (curr && curr.appState && (Array.isArray(curr.appState.students) || Array.isArray(curr.appState.exams) || Array.isArray(curr.appState.examHalls))) {
    return curr.appState;
  }
  if (Array.isArray(curr.students) || Array.isArray(curr.exams) || Array.isArray(curr.examHalls)) {
    return curr;
  }
  if (curr && typeof curr === 'object' && curr.data && typeof curr.data === 'object') {
    const deeper = curr.data;
    if (deeper.data && (Array.isArray(deeper.data.students) || Array.isArray(deeper.data.exams) || Array.isArray(deeper.data.examHalls))) {
      return deeper.data;
    }
  }
  return curr.data || curr.appState || curr;
}

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

  // If cache is empty in RAM, check query fileId or default canonical Drive file ID
  const fileId = (req.query.fileId as string) || teacherBroadcastCache?.data?.canonicalDriveFileId || DEFAULT_CANONICAL_DRIVE_FILE_ID;
  if (fileId) {
    try {
      const authHeader = req.headers.authorization;
      const isValidAuth = authHeader && !authHeader.includes('undefined') && !authHeader.includes('null') && authHeader.trim().length > 10;
      const headers = isValidAuth ? { Authorization: authHeader } : undefined;
      const urls = [
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
        `https://drive.google.com/uc?export=download&id=${fileId}`
      ];
      for (const url of urls) {
        try {
          const driveRes = await fetch(url, headers ? { headers } : undefined);
          if (driveRes.ok) {
            const text = await driveRes.text();
            let raw: any = null;
            try { raw = JSON.parse(text); } catch {}
            if (raw) {
              const targetData = unwrapServerSchoolPayload(raw);
              if (targetData && (Array.isArray(targetData.students) || Array.isArray(targetData.exams) || Array.isArray(targetData.examHalls))) {
                const now = new Date();
                const fullFormatted = targetData.lastTeacherPublishedDate || raw.publishedDateFormatted || 'Güncel';
                const payload = {
                  appName: 'AkademiPanel',
                  fileType: 'teacher_public_broadcast',
                  version: raw.version || 1,
                  publishedAt: raw.publishedAt || now.toISOString(),
                  publishedDateFormatted: fullFormatted,
                  summary: {
                    studentCount: targetData.students?.length || 0,
                    examCount: targetData.exams?.length || 0,
                    hallCount: targetData.examHalls?.length || 0
                  },
                  data: targetData
                };
                teacherBroadcastCache = payload;
                fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), () => {});
                return res.json({
                  success: true,
                  publishedAt: payload.publishedAt,
                  publishedDateFormatted: payload.publishedDateFormatted,
                  version: payload.version,
                  summary: payload.summary,
                  data: targetData
                });
              }
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('Server fallback Google Drive fetch notice:', e);
    }
  }

  return res.status(200).json({
    success: false,
    message: 'Henüz öğretmenler için yayınlanmış veri bulunmamaktadır.',
    data: null
  });
});

// Google Drive Server-Side Proxy (Bypasses browser CORS & protects 0 Firebase Quota)
app.get('/api/drive-proxy', async (req, res) => {
  const fileId = (req.query.fileId as string) || DEFAULT_CANONICAL_DRIVE_FILE_ID;

  try {
    const authHeader = req.headers.authorization;
    const isValidAuth = authHeader && !authHeader.includes('undefined') && !authHeader.includes('null') && authHeader.trim().length > 10;
    const headers = isValidAuth ? { Authorization: authHeader } : undefined;
    const urls = [
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
      `https://drive.google.com/uc?export=download&id=${fileId}`
    ];

    for (const url of urls) {
      try {
        const driveRes = await fetch(url, headers ? { headers } : undefined);
        if (driveRes.ok) {
          const text = await driveRes.text();
          let json: any = null;
          try { json = JSON.parse(text); } catch {}
          if (json) {
            const cleanData = unwrapServerSchoolPayload(json);
            if (cleanData && (Array.isArray(cleanData.students) || Array.isArray(cleanData.exams) || Array.isArray(cleanData.examHalls))) {
              // Update RAM cache
              const payload = {
                appName: 'AkademiPanel',
                fileType: 'teacher_public_broadcast',
                publishedAt: new Date().toISOString(),
                publishedDateFormatted: cleanData.lastTeacherPublishedDate || 'Güncel',
                summary: {
                  studentCount: cleanData.students?.length || 0,
                  examCount: cleanData.exams?.length || 0,
                  hallCount: cleanData.examHalls?.length || 0
                },
                data: cleanData
              };
              teacherBroadcastCache = payload;
              fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), () => {});
              return res.json({ success: true, data: cleanData, raw: json });
            }
          }
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
