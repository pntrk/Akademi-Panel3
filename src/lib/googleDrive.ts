import { getCachedAccessToken, connectGoogleDrive } from './firebase';

export interface DriveBackupItem {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
}

export const ensureDriveAccessToken = async (): Promise<string> => {
  let token = getCachedAccessToken();
  if (!token) {
    token = await connectGoogleDrive();
  }
  if (!token) {
    throw new Error('Google Drive bağlantısı için oturum açılamadı. Lütfen Google ile giriş yapın.');
  }
  return token;
};

export const uploadBackupToGoogleDrive = async (
  backupPayload: any,
  customName?: string
): Promise<{ success: boolean; fileId?: string; fileName?: string; webViewLink?: string; error?: string }> => {
  try {
    const token = await ensureDriveAccessToken();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
    const fileName = customName?.trim() || `AkademiPanel_Okul_Yedegi_${dateStr}_${timeStr}.json`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: `AkademiPanel Okul Sistemi Yedekleme Dosyası (${dateStr} ${timeStr})`,
      properties: {
        app: 'AkademiPanel',
        type: 'school_database_backup',
        createdAt: now.toISOString()
      }
    };

    const boundary = '-------AkademiDriveBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(backupPayload, null, 2) +
      closeDelimiter;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime,size&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || `Google Drive API hatası (${response.status})`;
      return { success: false, error: errMsg };
    }

    const data = await response.json();
    return {
      success: true,
      fileId: data.id,
      fileName: data.name,
      webViewLink: data.webViewLink
    };
  } catch (err: any) {
    console.error('Google Drive upload error:', err);
    return { success: false, error: err?.message || 'Google Drive üzerine yedek yüklenemedi.' };
  }
};

export const listBackupsFromGoogleDrive = async (): Promise<DriveBackupItem[]> => {
  try {
    const token = await ensureDriveAccessToken();
    const query = "(name contains 'AkademiPanel' or name contains 'Canli_Kutuk') and trashed = false";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,modifiedTime,size,webViewLink,owners)&orderBy=modifiedTime desc&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      console.warn('Google Drive list error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.files || [];
  } catch (err) {
    console.warn('Failed to list Google Drive backups:', err);
    return [];
  }
};

export const downloadBackupFromGoogleDrive = async (fileId: string): Promise<any> => {
  const token = await ensureDriveAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Google Drive'dan yedek indirilemedi (Durum: ${response.status})`);
  }

  return await response.json();
};

export const deleteBackupFromGoogleDrive = async (fileId: string): Promise<boolean> => {
  const token = await ensureDriveAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  return response.ok;
};

// -------------------------------------------------------------
// SINGLE CANONICAL MASTER FILE LOCK (TEK DOSYA KİLİDİ & EŞİTLEME)
// -------------------------------------------------------------
export const LIVE_MASTER_FILE_NAME = 'AkademiPanel_Canli_Kutuk.json';
let cachedLiveFileId: string | null = null;
let cachedLiveFileLink: string | null = null;

/**
 * Robustly extracts a Google Drive file or folder ID from ANY input format.
 * Tolerates full links, sharing links, folder links, query params, quotes, spaces, or raw IDs.
 */
export const extractGoogleDriveFileId = (input: string): string | null => {
  if (!input) return null;
  // Clean surrounding quotes, angle brackets, parentheses, and spaces
  let cleaned = input.trim().replace(/^["'<(\[]+|["'>)\]]+$/g, '').trim();

  // 1. URL pattern: /file/d/{ID} or /d/{ID} or /folders/{ID} or /document/d/{ID} or /spreadsheets/d/{ID}
  const matchPath = cleaned.match(/(?:file\/d|d|folders|document\/d|spreadsheets\/d|presentation\/d)\/([a-zA-Z0-9_-]{10,70})/i);
  if (matchPath && matchPath[1]) {
    return matchPath[1];
  }

  // 2. Query param: id={ID} or fileId={ID}
  const matchQuery = cleaned.match(/[?&](?:id|fileId)=([a-zA-Z0-9_-]{10,70})/i);
  if (matchQuery && matchQuery[1]) {
    return matchQuery[1];
  }

  // 3. Raw alphanumeric Google Drive ID (typically 15-65 characters)
  const matchRaw = cleaned.match(/\b([a-zA-Z0-9_-]{15,65})\b/);
  if (matchRaw && matchRaw[1]) {
    return matchRaw[1];
  }

  return null;
};

export const getLiveMasterFileId = (): string | null => {
  if (cachedLiveFileId) return cachedLiveFileId;
  try {
    return localStorage.getItem('akademi_live_drive_file_id');
  } catch {
    return null;
  }
};

export const getLiveMasterFileLink = (): string | null => {
  if (cachedLiveFileLink) return cachedLiveFileLink;
  try {
    return localStorage.getItem('akademi_live_drive_file_link');
  } catch {
    const id = getLiveMasterFileId();
    return id ? `https://drive.google.com/file/d/${id}/view` : null;
  }
};

export const setLiveMasterFileId = (id: string | null, link?: string | null) => {
  cachedLiveFileId = id;
  const webLink = link || (id ? `https://drive.google.com/file/d/${id}/view` : null);
  cachedLiveFileLink = webLink;
  try {
    if (id) {
      localStorage.setItem('akademi_live_drive_file_id', id);
      if (webLink) localStorage.setItem('akademi_live_drive_file_link', webLink);
    } else {
      localStorage.removeItem('akademi_live_drive_file_id');
      localStorage.removeItem('akademi_live_drive_file_link');
    }
  } catch {}
};

/**
 * Retrieves file metadata from Google Drive to check existence and edit permissions.
 */
export const getDriveFileMetadata = async (fileId: string, token: string): Promise<{
  id: string;
  name: string;
  trashed: boolean;
  modifiedTime?: string;
  webViewLink?: string;
  canEdit?: boolean;
  ownerEmail?: string;
  ownerName?: string;
} | null> => {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,trashed,modifiedTime,webViewLink,owners(displayName,emailAddress),capabilities(canEdit)&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      trashed: !!data.trashed,
      modifiedTime: data.modifiedTime,
      webViewLink: data.webViewLink,
      canEdit: data.capabilities?.canEdit !== false,
      ownerEmail: data.owners?.[0]?.emailAddress,
      ownerName: data.owners?.[0]?.displayName
    };
  } catch (e) {
    return null;
  }
};

/**
 * Validates and locks the application to a user-specified canonical Drive file link/ID.
 * If input is empty or invalid link, it automatically scans Google Drive for shared/owned master files.
 */
export const lockToCanonicalDriveFile = async (
  fileIdOrLink?: string
): Promise<{ success: boolean; fileId?: string; fileName?: string; webViewLink?: string; error?: string }> => {
  let fileId = fileIdOrLink ? extractGoogleDriveFileId(fileIdOrLink) : null;

  try {
    let token = await ensureDriveAccessToken();

    // If no direct ID could be extracted, perform an automatic search on Google Drive
    if (!fileId) {
      const autoFound = await findLiveMasterDriveFile(token);
      if (autoFound?.id) {
        const webLink = autoFound.webViewLink || `https://drive.google.com/file/d/${autoFound.id}/view`;
        setLiveMasterFileId(autoFound.id, webLink);
        return {
          success: true,
          fileId: autoFound.id,
          fileName: LIVE_MASTER_FILE_NAME,
          webViewLink: webLink
        };
      }
      return { 
        success: false, 
        error: 'Geçerli bir Google Drive linki (örn: https://drive.google.com/file/d/.../view) bulunamadı. Lütfen 1. Süperadminin paylaştığı dosya linkini yapıştırın veya "Otomatik Bul" butonunu deneyin.' 
      };
    }
    
    // 1. Try reading metadata directly
    let res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,trashed,modifiedTime,webViewLink,capabilities(canEdit)&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // If 401 (expired/invalid token), re-authenticate and retry
    if (res.status === 401) {
      const newToken = await connectGoogleDrive(false, true);
      if (newToken) {
        token = newToken;
        res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,trashed,modifiedTime,webViewLink,capabilities(canEdit)&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    }

    if (res.ok) {
      const meta = await res.json();
      
      // If user pasted a folder link instead of direct file link
      if (meta.mimeType === 'application/vnd.google-apps.folder') {
        const folderSearchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${fileId}'+in+parents+and+trashed=false&fields=files(id,name,webViewLink,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (folderSearchRes.ok) {
          const folderFiles = await folderSearchRes.json();
          const target = folderFiles.files?.find((f: any) => f.name.includes('Canli_Kutuk') || f.name.includes('AkademiPanel')) || folderFiles.files?.[0];
          if (target) {
            setLiveMasterFileId(target.id, target.webViewLink);
            return {
              success: true,
              fileId: target.id,
              fileName: target.name,
              webViewLink: target.webViewLink
            };
          }
        }
      }

      if (!meta.trashed) {
        const webLink = meta.webViewLink || `https://drive.google.com/file/d/${meta.id}/view`;
        setLiveMasterFileId(meta.id, webLink);
        return {
          success: true,
          fileId: meta.id,
          fileName: meta.name || LIVE_MASTER_FILE_NAME,
          webViewLink: webLink
        };
      }
    }

    // 2. Direct media download verification fallback
    const testDownload = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (testDownload.ok) {
      const webLink = `https://drive.google.com/file/d/${fileId}/view`;
      setLiveMasterFileId(fileId, webLink);
      return {
        success: true,
        fileId: fileId,
        fileName: LIVE_MASTER_FILE_NAME,
        webViewLink: webLink
      };
    }

    // Status-specific helpful guidance
    if (res.status === 404 || testDownload.status === 404) {
      return {
        success: false,
        error: `Dosya (${fileId}) bu Google hesabıyla bulunamadı. Lütfen dosya sahibi yöneticinin Google Drive'da bu dosyayı sizin Gmail adresinizle 'Düzenleyen (Editor)' olarak paylaştığından emin olun.`
      };
    }

    if (res.status === 403 || testDownload.status === 403) {
      return {
        success: false,
        error: `Bu dosyayı düzenleme yetkiniz yok (Hata 403). Lütfen dosya sahibi yöneticinin Google Drive üzerinde yetkinizi 'Görüntüleyen' yerine 'Düzenleyen' olarak ayarladığından emin olun.`
      };
    }

    return {
      success: false,
      error: `Google Drive erişim hatası (Durum: ${res.status || testDownload.status}). Lütfen dosya paylaşım izinlerini kontrol edin.`
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Google Drive dosyası doğrulanamadı.' };
  }
};

export interface LiveMasterFileInfo {
  id: string;
  name?: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}

/**
 * Finds the canonical live master file.
 * Checks candidate files across Google Drive, compares modified times, and ensures
 * the latest updated backup (e.g. 120 students) is prioritized over older stale files.
 */
export const findLiveMasterDriveFile = async (
  token: string,
  preferredId?: string | null,
  forceFullScan = false
): Promise<LiveMasterFileInfo | null> => {
  try {
    const knownId = preferredId || getLiveMasterFileId();
    let knownMeta: any = null;
    if (knownId) {
      knownMeta = await getDriveFileMetadata(knownId, token);
    }

    // FAST-PATH: If known canonical file exists and is valid, return immediately without slow multi-second Drive full search!
    if (knownMeta && !knownMeta.trashed && !forceFullScan) {
      if (knownMeta.webViewLink) setLiveMasterFileId(knownMeta.id, knownMeta.webViewLink);
      return {
        id: knownMeta.id,
        name: knownMeta.name || LIVE_MASTER_FILE_NAME,
        modifiedTime: knownMeta.modifiedTime,
        webViewLink: knownMeta.webViewLink
      };
    }

    // Search across Google Drive for any AkademiPanel, Canli_Kutuk, or backup files
    const query = "(name contains 'AkademiPanel' or name contains 'Canli_Kutuk' or name contains 'Kutuk' or name contains 'Okul_Yedegi' or name contains 'Tam_Yedek' or name contains 'Ogrenci') and trashed = false";
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size,webViewLink,owners,description)&orderBy=modifiedTime desc&pageSize=30&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    let candidateFiles: any[] = [];
    if (res.ok) {
      const data = await res.json();
      candidateFiles = data.files || [];
    }

    // If knownId exists and is valid
    if (knownMeta && !knownMeta.trashed) {
      const knownTime = knownMeta.modifiedTime ? new Date(knownMeta.modifiedTime).getTime() : 0;
      
      // Look for candidate files that are newer than knownMeta
      const fresherCandidate = candidateFiles.find(f => {
        if (f.id === knownMeta.id) return false;
        const candidateTime = f.modifiedTime ? new Date(f.modifiedTime).getTime() : 0;
        return candidateTime > knownTime;
      });

      if (fresherCandidate) {
        const webLink = fresherCandidate.webViewLink || `https://drive.google.com/file/d/${fresherCandidate.id}/view`;
        setLiveMasterFileId(fresherCandidate.id, webLink);
        return {
          id: fresherCandidate.id,
          name: fresherCandidate.name,
          modifiedTime: fresherCandidate.modifiedTime,
          webViewLink: webLink
        };
      }

      if (knownMeta.webViewLink) setLiveMasterFileId(knownMeta.id, knownMeta.webViewLink);
      return {
        id: knownMeta.id,
        name: knownMeta.name || LIVE_MASTER_FILE_NAME,
        modifiedTime: knownMeta.modifiedTime,
        webViewLink: knownMeta.webViewLink
      };
    }

    // If no valid knownId, choose the most recently modified candidate
    if (candidateFiles.length > 0) {
      const liveMasterMatch = candidateFiles.find(f => f.name === LIVE_MASTER_FILE_NAME);
      // If liveMasterMatch has nearly same modified time as candidateFiles[0], prefer liveMasterMatch, else use candidateFiles[0]
      const chosen = (liveMasterMatch && Math.abs(new Date(liveMasterMatch.modifiedTime || 0).getTime() - new Date(candidateFiles[0].modifiedTime || 0).getTime()) < 5000)
        ? liveMasterMatch
        : candidateFiles[0];

      const webLink = chosen.webViewLink || `https://drive.google.com/file/d/${chosen.id}/view`;
      setLiveMasterFileId(chosen.id, webLink);
      return {
        id: chosen.id,
        name: chosen.name,
        modifiedTime: chosen.modifiedTime,
        webViewLink: webLink
      };
    }
  } catch (e) {
    console.warn('Find live master file notice:', e);
  }
  return null;
};

/**
 * Ensures Google Drive file does not exceed version/revision limits (e.g. 100 versions quota).
 * Implements FIFO cleanup: queries revisions of the file (with full pagination support for 100+ versions),
 * and if count > maxAllowedRevisions, deletes the earliest revisions one by one to keep ample headroom
 * for fresh backups and continuous live syncing.
 */
export const cleanOldDriveRevisions = async (
  fileId: string,
  token?: string,
  maxAllowedRevisions = 30
): Promise<{ cleanedCount: number; currentRevisions: number }> => {
  try {
    const activeToken = token || (await ensureDriveAccessToken());
    let allRevisions: { id: string; modifiedTime?: string; keepForever?: boolean }[] = [];
    let pageToken: string | undefined = undefined;

    // Fetch all pages of revisions (in case file has reached 100 or 101+ versions)
    do {
      const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const listUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=nextPageToken,revisions(id,modifiedTime,keepForever,size)&pageSize=100&supportsAllDrives=true${pageParam}`;
      const res = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (!res.ok) {
        break;
      }

      const data = await res.json();
      if (Array.isArray(data.revisions)) {
        allRevisions = allRevisions.concat(data.revisions);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    if (allRevisions.length <= maxAllowedRevisions) {
      return { cleanedCount: 0, currentRevisions: allRevisions.length };
    }

    // Sort oldest first (FIFO order)
    const sorted = [...allRevisions].sort((a, b) => {
      const ta = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
      const tb = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
      return ta - tb;
    });

    const toDeleteCount = allRevisions.length - maxAllowedRevisions;
    // Always keep at least the latest few revisions
    const candidatesToDelete = sorted.slice(0, Math.min(toDeleteCount, allRevisions.length - 1));

    let cleaned = 0;
    for (const rev of candidatesToDelete) {
      try {
        // If keepForever was set, remove it first
        if (rev.keepForever) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${rev.id}?supportsAllDrives=true`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${activeToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keepForever: false })
          }).catch(() => {});
        }

        const delRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${rev.id}?supportsAllDrives=true`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${activeToken}` }
          }
        );
        if (delRes.ok || delRes.status === 204) {
          cleaned++;
        }
      } catch (err) {
        // Continue cleaning other revisions
      }
    }

    return { cleanedCount: cleaned, currentRevisions: allRevisions.length - cleaned };
  } catch (err) {
    console.warn('Drive revision cleanup notice:', err);
    return { cleanedCount: 0, currentRevisions: 0 };
  }
};

/**
 * Synchronizes the state to the SINGLE canonical 'AkademiPanel_Canli_Kutuk.json' on Google Drive.
 * GUARANTEE: NEVER creates duplicate files if a master file is already known.
 * AUTOMATIC QUOTA PROTECTION: Proactively purges oldest revisions (FIFO) to prevent 100-version limits.
 */
export const syncLiveMasterToGoogleDrive = async (
  liveState: any,
  userEmail?: string
): Promise<{ success: boolean; fileId?: string; modifiedTime?: string; error?: string; cleanedRevisions?: number }> => {
  try {
    const token = await ensureDriveAccessToken();
    const existing = await findLiveMasterDriveFile(token);

    const now = new Date();
    const payload = {
      appName: 'AkademiPanel',
      fileType: 'live_master_sync',
      school: 'Kırklareli Atatürk Ortaokulu',
      lastSyncedAt: now.toISOString(),
      syncedBy: userEmail || 'admin',
      version: liveState.version || 1,
      summary: {
        studentCount: liveState.students?.length || 0,
        examCount: liveState.exams?.length || 0,
        resultCount: liveState.results?.length || 0,
        hallCount: liveState.examHalls?.length || 0,
      },
      data: liveState
    };

    const payloadJson = JSON.stringify(payload, null, 2);

    // If an existing master file was found, ALWAYS update in-place (PATCH)
    if (existing?.id) {
      // Proactive FIFO revision cleanup: Clean before write to guarantee room for the new revision
      await cleanOldDriveRevisions(existing.id, token, 30).catch(() => {});

      let patchRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,name,modifiedTime&supportsAllDrives=true`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: payloadJson
        }
      );

      // If PATCH fails, perform aggressive cleanup of old revisions and retry once
      if (!patchRes.ok) {
        await cleanOldDriveRevisions(existing.id, token, 15).catch(() => {});
        patchRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,name,modifiedTime&supportsAllDrives=true`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=UTF-8'
            },
            body: payloadJson
          }
        );
      }

      if (patchRes.ok) {
        const patchData = await patchRes.json();
        setLiveMasterFileId(patchData.id);

        // Keep revisions safe below 30
        cleanOldDriveRevisions(patchData.id, token, 30).catch(() => {});

        return {
          success: true,
          fileId: patchData.id,
          modifiedTime: patchData.modifiedTime
        };
      } else {
        const err = await patchRes.json().catch(() => ({}));
        return {
          success: false,
          error: `Ortak Google Drive dosyasına (${existing.id}) yazılamadı: ${err?.error?.message || patchRes.statusText}. Lütfen dosyanın 'Düzenleyen' yetkisiyle paylaşıldığından emin olun.`
        };
      }
    }

    // If a canonical ID was configured previously but could not be found/accessed:
    // DO NOT CREATE A NEW FILE! Report error to prevent duplicate files!
    const knownId = getLiveMasterFileId();
    if (knownId) {
      return {
        success: false,
        error: `Ortak Google Drive ana dosyasına (${knownId}) erişilemedi. Çift dosya oluşmasını engellemek için yeni dosya açılmadı. Lütfen dosya sahibi yöneticinin bu dosyayı "Düzenleyen" yetkisiyle paylaştığından emin olun.`
      };
    }

    // ONLY create a new file if completely uninitialized (first superadmin bootstrap)
    const metadata = {
      name: LIVE_MASTER_FILE_NAME,
      mimeType: 'application/json',
      description: 'AkademiPanel Okul Sistemi Canlı Otomatik Kütük Dosyası (30sn Eşitleme)',
      properties: {
        app: 'AkademiPanel',
        type: 'live_master_sync',
        school: 'Kırklareli Atatürk Ortaokulu'
      }
    };

    const boundary = '-------AkademiLiveBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      payloadJson +
      closeDelimiter;

    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return { success: false, error: err?.error?.message || 'Google Drive master dosya oluşturulamadı.' };
    }

    const created = await createRes.json();
    setLiveMasterFileId(created.id, created.webViewLink);
    cleanOldDriveRevisions(created.id, token, 40).catch(() => {});
    return {
      success: true,
      fileId: created.id,
      modifiedTime: created.modifiedTime
    };
  } catch (err: any) {
    console.warn('Sync live master to drive error:', err);
    return { success: false, error: err?.message || 'Google Drive senkronizasyon hatası' };
  }
};

/**
 * Checks if the remote live master file has been modified by another admin.
 * If newer than lastKnownTime, fetches and returns the full updated data.
 */
export const fetchLiveMasterFromGoogleDriveIfNewer = async (
  lastKnownModifiedTime?: string | null
): Promise<{ hasUpdate: boolean; data?: any; modifiedTime?: string; syncedBy?: string; fileName?: string; studentCount?: number }> => {
  try {
    const token = await ensureDriveAccessToken();
    const existing = await findLiveMasterDriveFile(token);
    if (!existing?.id) {
      return { hasUpdate: false };
    }

    // Check modifiedTime
    if (lastKnownModifiedTime && existing.modifiedTime) {
      const remoteTime = new Date(existing.modifiedTime).getTime();
      const localTime = new Date(lastKnownModifiedTime).getTime();
      if (remoteTime <= localTime) {
        return { hasUpdate: false };
      }
    }

    // Fetch updated content
    const rawData = await downloadBackupFromGoogleDrive(existing.id);
    const targetState = rawData.data || rawData;

    return {
      hasUpdate: true,
      data: targetState,
      modifiedTime: existing.modifiedTime,
      syncedBy: rawData.syncedBy,
      fileName: existing.name,
      studentCount: targetState?.students?.length || 0
    };
  } catch (e) {
    return { hasUpdate: false };
  }
};
