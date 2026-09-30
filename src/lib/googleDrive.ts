import { getCachedAccessToken, connectGoogleDrive } from './firebase';

export interface DriveBackupItem {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  webViewLink?: string;
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

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime,size', {
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
    const query = "name contains 'AkademiPanel' and trashed = false";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,size,webViewLink)&orderBy=createdTime desc&pageSize=30&supportsAllDrives=true&includeItemsFromAllDrives=true`;

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
// LIVE MASTER FILE SYNC (CANLI KÜTÜK - 30 SANİYEDE BİR GÜNCELLEME)
// -------------------------------------------------------------
export const LIVE_MASTER_FILE_NAME = 'AkademiPanel_Canli_Kutuk.json';
let cachedLiveFileId: string | null = null;

export const getLiveMasterFileId = (): string | null => {
  if (cachedLiveFileId) return cachedLiveFileId;
  try {
    return localStorage.getItem('akademi_live_drive_file_id');
  } catch {
    return null;
  }
};

export const setLiveMasterFileId = (id: string | null) => {
  cachedLiveFileId = id;
  try {
    if (id) {
      localStorage.setItem('akademi_live_drive_file_id', id);
    } else {
      localStorage.removeItem('akademi_live_drive_file_id');
    }
  } catch {}
};

/**
 * Finds the canonical live master file in the user's Drive or shared Drive.
 */
export const findLiveMasterDriveFile = async (token: string): Promise<{ id: string; modifiedTime?: string } | null> => {
  try {
    const knownId = getLiveMasterFileId();
    if (knownId) {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${knownId}?fields=id,name,trashed,modifiedTime&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (checkRes.ok) {
        const fileData = await checkRes.json();
        if (!fileData.trashed) {
          return { id: fileData.id, modifiedTime: fileData.modifiedTime };
        }
      }
    }

    const query = `(name = '${LIVE_MASTER_FILE_NAME}' or name contains 'AkademiPanel_Canli_Kutuk') and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        const found = data.files[0];
        setLiveMasterFileId(found.id);
        return { id: found.id, modifiedTime: found.modifiedTime };
      }
    }
  } catch (e) {
    console.warn('Find live master file notice:', e);
  }
  return null;
};

/**
 * Synchronizes the state to the single canonical 'AkademiPanel_Canli_Kutuk.json' on Google Drive.
 * Updates in-place if existing (PATCH), or creates a new file if not (POST).
 */
export const syncLiveMasterToGoogleDrive = async (
  liveState: any,
  userEmail?: string
): Promise<{ success: boolean; fileId?: string; modifiedTime?: string; error?: string }> => {
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

    if (existing?.id) {
      // Update existing master file in-place (PATCH)
      const patchRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,name,modifiedTime`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: payloadJson
        }
      );

      if (patchRes.ok) {
        const patchData = await patchRes.json();
        setLiveMasterFileId(patchData.id);
        return {
          success: true,
          fileId: patchData.id,
          modifiedTime: patchData.modifiedTime
        };
      }
    }

    // If no existing master file, create it with multipart POST
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
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink',
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
    setLiveMasterFileId(created.id);
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
): Promise<{ hasUpdate: boolean; data?: any; modifiedTime?: string; syncedBy?: string }> => {
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
      syncedBy: rawData.syncedBy
    };
  } catch (e) {
    return { hasUpdate: false };
  }
};

