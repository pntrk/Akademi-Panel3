import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
const PORT = 3000;
const DEFAULT_CANONICAL_DRIVE_FILE_ID = '1g24DSyjP7u3OaIoUz3MGeVlS5HsqmrIg';

// Ephemeral in-memory broadcast payload (no disk persistence)
let teacherBroadcastCache: any = null;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'dynamic_google_drive',
    hasMemoryBroadcastCache: Boolean(teacherBroadcastCache),
    cachedPublishedDate: teacherBroadcastCache?.publishedDateFormatted || null,
    canonicalDriveFileId: DEFAULT_CANONICAL_DRIVE_FILE_ID,
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

// Handler to fetch dynamic master data directly from Google Drive
async function fetchMasterFromGoogleDrive(fileId: string, authHeader?: string): Promise<{ success: boolean; data?: any; raw?: any; error?: string }> {
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
          if (targetData && (Array.isArray(targetData.students) || Array.isArray(targetData.exams) || Array.isArray(targetData.examHalls) || Array.isArray(targetData.results))) {
            return { success: true, data: targetData, raw };
          }
        }
      }
    } catch (e) {
      // Continue trying next URL
    }
  }

  return { success: false, error: 'Google Drive kütük dosyasına erişilemedi.' };
}

// Teacher broadcast read endpoint (Reads directly from Google Drive, zero disk writes)
const handleTeacherDataRead = async (req: express.Request, res: express.Response) => {
  const fileId = (req.query.fileId as string) || teacherBroadcastCache?.data?.canonicalDriveFileId || DEFAULT_CANONICAL_DRIVE_FILE_ID;

  // Direct dynamic read from Google Drive
  try {
    const driveResult = await fetchMasterFromGoogleDrive(fileId, req.headers.authorization);
    if (driveResult.success && driveResult.data) {
      const targetData = driveResult.data;
      const raw = driveResult.raw || {};
      const fullFormatted = targetData.lastTeacherPublishedDate || raw.publishedDateFormatted || new Date().toISOString();
      const payload = {
        appName: 'AkademiPanel',
        fileType: 'teacher_public_broadcast',
        version: raw.version || 1,
        publishedAt: raw.publishedAt || new Date().toISOString(),
        publishedDateFormatted: fullFormatted,
        summary: {
          studentCount: targetData.students?.length || 0,
          examCount: targetData.exams?.length || 0,
          hallCount: targetData.examHalls?.length || 0
        },
        data: targetData
      };
      // Keep ephemeral in-memory copy only (NO disk writes)
      teacherBroadcastCache = payload;

      return res.json({
        success: true,
        source: 'google_drive_dynamic',
        publishedAt: payload.publishedAt,
        publishedDateFormatted: payload.publishedDateFormatted,
        version: payload.version,
        summary: payload.summary,
        data: targetData
      });
    }
  } catch (err: any) {
    console.warn('Direct Google Drive teacher fetch note:', err?.message || err);
  }

  // Fallback to in-memory broadcast if Drive download was temporarily unreachable
  if (teacherBroadcastCache && teacherBroadcastCache.data) {
    return res.json({
      success: true,
      source: 'memory_cache',
      publishedAt: teacherBroadcastCache.publishedAt,
      publishedDateFormatted: teacherBroadcastCache.publishedDateFormatted,
      version: teacherBroadcastCache.version,
      summary: teacherBroadcastCache.summary,
      data: teacherBroadcastCache.data
    });
  }

  return res.status(200).json({
    success: false,
    message: 'Google Drive kütük dosyası taranıyor veya henüz yayınlanan veri bulunmamaktadır.',
    data: null
  });
};

app.get('/api/teacher-data', handleTeacherDataRead);
app.get('/api/teacher-broadcast', handleTeacherDataRead);

// Google Drive Server-Side Proxy (Bypasses browser CORS & protects 0 Firebase Quota, NO disk writes)
app.get('/api/drive-proxy', async (req, res) => {
  const fileId = (req.query.fileId as string) || DEFAULT_CANONICAL_DRIVE_FILE_ID;

  try {
    const result = await fetchMasterFromGoogleDrive(fileId, req.headers.authorization);
    if (result.success && result.data) {
      const cleanData = result.data;
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
      // In-memory cache only (NO disk file writing)
      teacherBroadcastCache = payload;
      return res.json({ success: true, data: cleanData, raw: result.raw });
    }

    return res.status(502).json({ success: false, error: 'Google Drive kütük dosyasına erişilemedi veya dosya herkese açık değil.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Sunucu hatası' });
  }
});

// Admin publish endpoint to update in-memory teacher broadcast state (NO disk writes)
app.post('/api/teacher-broadcast/update', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.data) {
      return res.status(400).json({ success: false, error: 'Geçersiz veri paketi.' });
    }

    // In-memory update only - NO disk writes
    teacherBroadcastCache = payload;

    console.log(`Teacher broadcast in-memory cache updated at ${payload.publishedDateFormatted || new Date().toISOString()}`);
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
