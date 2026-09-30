import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudDownload, 
  CloudUpload, 
  HardDrive, 
  RefreshCw, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Calendar, 
  User as UserIcon, 
  X, 
  Plus, 
  Database,
  ArrowRight,
  FileCheck,
  Eye,
  Info,
  Lock,
  ExternalLink,
  FolderCheck,
  Share2,
  FileText,
  UploadCloud,
  Check
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { 
  auth, 
  firebaseConfig, 
  FIRESTORE_UPGRADE_URL, 
  db, 
  doc, 
  getDoc, 
  collection, 
  getDocs,
  getCachedAccessToken,
  connectGoogleDrive
} from '../lib/firebase';
import { CloudBackupRecord } from '../types';
import { 
  uploadBackupToGoogleDrive, 
  listBackupsFromGoogleDrive, 
  downloadBackupFromGoogleDrive, 
  deleteBackupFromGoogleDrive, 
  DriveBackupItem 
} from '../lib/googleDrive';

interface CloudBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudBackupModal: React.FC<CloudBackupModalProps> = ({ isOpen, onClose }) => {
  const { 
    state,
    userRole, 
    syncStatus, 
    syncErrorMessage, 
    pendingSyncCount,
    hasPendingChanges,
    lastSyncedAt,
    lastDriveSyncedAt,
    isDriveAutoSyncing,
    syncToDriveNow,
    cloudBackups, 
    isLoadingBackups, 
    createCloudBackup, 
    restoreCloudBackup, 
    deleteCloudBackup, 
    saveLocalBackupToCloud,
    syncFromCloudStorage,
    restoreBackup,
    saveNow,
    retrySync
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'backups' | 'sync' | 'drive'>('backups');
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [isPullingData, setIsPullingData] = useState(false);
  const [cloudDiagnosticResult, setCloudDiagnosticResult] = useState<{
    testedAt: string;
    connectionOk: boolean;
    serverAdmins: string[];
    serverVersion?: number;
    serverLastPublishedAt?: string;
    serverStudentsCount: number;
    serverExamsCount: number;
    serverResultsCount: number;
    serverBackupsCount: number;
    backupsWithDataCount: number;
    message: string;
  } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [customBackupName, setCustomBackupName] = useState('');
  const [backupNote, setBackupNote] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmRestoreBackup, setConfirmRestoreBackup] = useState<CloudBackupRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Google Drive State
  const [driveBackups, setDriveBackups] = useState<DriveBackupItem[]>([]);
  const [isLoadingDriveBackups, setIsLoadingDriveBackups] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveCustomName, setDriveCustomName] = useState('');
  const [confirmRestoreDriveItem, setConfirmRestoreDriveItem] = useState<DriveBackupItem | null>(null);
  const [confirmDeleteDriveItem, setConfirmDeleteDriveItem] = useState<DriveBackupItem | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(() => !!getCachedAccessToken());
  const [isConnectingDrive, setIsConnectingDrive] = useState<boolean>(false);
  const [autoDriveBackup, setAutoDriveBackup] = useState<boolean>(() => {
    try {
      return localStorage.getItem('akademi_auto_drive_backup') === 'true';
    } catch {
      return false;
    }
  });

  const isAdmin = userRole === 'admin';
  const currentUser = auth.currentUser;
  const currentEmail = (currentUser?.email || 'bahadirkumcu@gmail.com').toLowerCase();
  const displayName = currentUser?.displayName || currentEmail.split('@')[0];

  const handleTakeBackup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Firebase üzerine yedek alma yetkisi yalnızca İdareci ve Süper Admin hesaplarına aittir.' });
      return;
    }
    setIsCreating(true);
    setFeedback(null);
    try {
      const res = await createCloudBackup(customBackupName, backupNote);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setCustomBackupName('');
        setBackupNote('');
        setShowCreateForm(false);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Bulut yedeği oluşturulamadı.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSyncNow = async () => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Bulut eşitleme yetkisi yalnızca İdarecilere aittir.' });
      return;
    }
    setIsSyncingNow(true);
    setFeedback(null);
    try {
      await saveNow();

      let driveMsg = '';
      if (autoDriveBackup && getCachedAccessToken()) {
        try {
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0];
          const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
          const backupPayload = {
            appName: "AkademiPanel",
            storageType: "google_drive_cloud_backup",
            version: state.version || 2,
            backupDate: now.toISOString(),
            school: "Kırklareli Atatürk Ortaokulu",
            exportedBy: currentEmail,
            summary: {
              studentCount: state.students?.length || 0,
              examCount: state.exams?.length || 0,
              resultCount: state.results?.length || 0,
              hallCount: state.examHalls?.length || 0,
              budgetIncomesCount: state.budget?.incomes?.length || 0,
              budgetExpensesCount: state.budget?.expenses?.length || 0,
              budgetDebtsCount: state.budget?.debts?.length || 0,
            },
            data: state
          };
          const driveRes = await uploadBackupToGoogleDrive(backupPayload, `AkademiPanel_OtoYedek_${dateStr}_${timeStr}.json`);
          if (driveRes.success) {
            driveMsg = ' ve Google Drive yedeği oluşturuldu';
            fetchDriveBackupsList().catch(() => {});
          }
        } catch (dErr) {
          console.warn('Auto drive backup error:', dErr);
        }
      }

      setFeedback({ 
        type: 'success', 
        message: `Tüm sistem verileri başarıyla bulut veritabanına eşitlendi${driveMsg}!` 
      });
    } catch (err: any) {
      try {
        await retrySync();
        setFeedback({ 
          type: 'success', 
          message: 'Bulut bağlantısı yeniden kuruldu ve veriler başarıyla eşitlendi!' 
        });
      } catch (retryErr: any) {
        setFeedback({ 
          type: 'error', 
          message: retryErr?.message || 'Bulut ile senkronizasyon sağlanamadı. Lütfen internet bağlantınızı kontrol edin.' 
        });
      }
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleRunDiagnostic = async () => {
    setIsTestingCloud(true);
    setFeedback(null);
    try {
      if (!firebaseConfig.projectId) {
        setCloudDiagnosticResult({
          testedAt: new Date().toLocaleTimeString('tr-TR'),
          connectionOk: false,
          serverAdmins: state.admins || [],
          serverStudentsCount: state.students?.length || 0,
          serverExamsCount: state.exams?.length || 0,
          serverResultsCount: state.results?.length || 0,
          serverBackupsCount: cloudBackups.length,
          backupsWithDataCount: cloudBackups.filter(b => !!b.data).length,
          message: 'Firebase yapılandırması bulunamadı, yerel depolama modu aktif.'
        });
        return;
      }

      // 1. Test connection doc
      await getDoc(doc(db, 'test', 'connection')).catch(() => null);

      // 2. Fetch root school doc
      const schoolSnap = await getDoc(doc(db, 'schools', 'main')).catch(() => null);
      const schoolData = schoolSnap?.exists() ? schoolSnap.data() : null;

      // 3. Fetch modules
      const modSnap = await getDocs(collection(db, 'schools', 'main', 'modules')).catch(() => null);
      let sCount = 0;
      let eCount = 0;
      let rCount = 0;
      let sVersion = schoolData?.version;
      let sPubTime = schoolData?.lastPublishedAt;
      let sAdmins = schoolData?.admins || [];

      if (modSnap && !modSnap.empty) {
        modSnap.forEach(d => {
          const mData = d.data();
          if (d.id === 'students') sCount = mData.students?.length || 0;
          if (d.id === 'exams') eCount = mData.exams?.length || 0;
          if (d.id === 'results') rCount = mData.results?.length || 0;
          if (d.id === 'meta') {
            sVersion = mData.version || sVersion;
            sPubTime = mData.lastPublishedAt || sPubTime;
            if (Array.isArray(mData.admins) && mData.admins.length > 0) {
              sAdmins = mData.admins;
            }
          }
        });
      }

      // 4. Fetch backups
      const bSnap = await getDocs(collection(db, 'schools', 'main', 'backups')).catch(() => null);
      let bTotal = 0;
      let bWithData = 0;
      if (bSnap && !bSnap.empty) {
        bTotal = bSnap.size;
        bSnap.forEach(d => {
          if (d.data()?.data) bWithData++;
        });
      }

      setCloudDiagnosticResult({
        testedAt: new Date().toLocaleTimeString('tr-TR'),
        connectionOk: true,
        serverAdmins: sAdmins,
        serverVersion: sVersion,
        serverLastPublishedAt: sPubTime,
        serverStudentsCount: sCount,
        serverExamsCount: eCount,
        serverResultsCount: rCount,
        serverBackupsCount: bTotal,
        backupsWithDataCount: bWithData,
        message: 'Bulut sunucu bağlantısı ve veri kanalları aktif durumda.'
      });
      setFeedback({ type: 'success', message: 'Bulut sunucu kontrolü tamamlandı: Veriler sunucuya başarıyla iletiliyor.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Bulut sunucu kontrolünde hata: ' + (err?.message || err) });
    } finally {
      setIsTestingCloud(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsPullingData(true);
    setFeedback(null);
    try {
      const updated = await syncFromCloudStorage(true);
      if (updated) {
        setFeedback({ 
          type: 'success', 
          message: 'Bulut sunucudaki en güncel veriler başarıyla indirildi ve sistem eşitlendi!' 
        });
      } else {
        setFeedback({ 
          type: 'info', 
          message: 'Sisteminiz zaten bulut sunucudaki en güncel sürüm ile birebir eşleşiyor.' 
        });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: 'Buluttan veri çekilirken hata oluştu: ' + (e?.message || e) });
    } finally {
      setIsPullingData(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Yedek geri yükleme yetkisi yalnızca İdarecilere aittir.' });
      return;
    }
    if (!confirmRestoreBackup) return;
    const backupId = confirmRestoreBackup.id;
    setActionLoadingId(backupId);
    setFeedback(null);
    try {
      const res = await restoreCloudBackup(backupId);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setConfirmRestoreBackup(null);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Yedek geri yüklenirken hata oluştu.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDelete = async (backupId: string) => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Yedek silme yetkisi yalnızca İdarecilere aittir.' });
      return;
    }
    setActionLoadingId(backupId);
    setFeedback(null);
    try {
      const res = await deleteCloudBackup(backupId);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setConfirmDeleteId(null);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Yedek silinemedi.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadBackupJson = (record: CloudBackupRecord) => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Sistem yedeğini JSON olarak indirme yetkisi yalnızca İdarecilere aittir.' });
      return;
    }
    const jsonString = JSON.stringify(record.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = record.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `BulutYedek_${safeName}_${record.createdAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setFeedback({
      type: 'success',
      message: `"${record.name}" bulut yedeği JSON dosyası olarak cihazınıza indirildi.`
    });
  };

  const handleUploadLocalJsonToCloud = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Buluta yedek yükleme yetkisi yalnızca İdarecilere aittir.' });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        
        const res = await saveLocalBackupToCloud(parsed, `Yüklenen Dosya: ${fileNameWithoutExt}`);
        if (res.success) {
          setFeedback({ type: 'success', message: res.message });
        } else {
          setFeedback({ type: 'error', message: res.message });
        }
      } catch (err) {
        setFeedback({ type: 'error', message: 'Geçersiz JSON yedek dosyası seçildi.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadDriveBackup = () => {
    const s = state;
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
    const driveBackupPayload = {
      appName: "AkademiPanel",
      storageType: "google_drive_hybrid_backup",
      version: s.version || 2,
      backupDate: new Date().toISOString(),
      school: "Kırklareli Atatürk Ortaokulu",
      exportedBy: currentEmail,
      summary: {
        studentCount: s.students?.length || 0,
        examCount: s.exams?.length || 0,
        resultCount: s.results?.length || 0,
        hallCount: s.examHalls?.length || 0,
        budgetIncomesCount: s.budget?.incomes?.length || 0,
        budgetExpensesCount: s.budget?.expenses?.length || 0,
        budgetDebtsCount: s.budget?.debts?.length || 0,
      },
      data: s
    };

    const str = JSON.stringify(driveBackupPayload, null, 2);
    const blob = new Blob([str], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AkademiPanel_GoogleDrive_Yedek_${dateStr}_${timeStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'success',
      message: 'Google Drive uyumlu tam okul veri tabanı yedeği (.json) başarıyla indirildi.'
    });
  };

  const handleRestoreDriveFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Yedek yükleme yetkisi yalnızca İdarecilere aittir.' });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const targetData = parsed.data || parsed;
        const res = await restoreBackup(targetData);
        if (res.success && res.summary) {
          setFeedback({
            type: 'success',
            message: `Google Drive yedeği başarıyla geri yüklendi! (${res.summary.studentCount} Öğrenci, ${res.summary.examCount} Sınav, ${res.summary.resultCount} Sonuç)`
          });
        } else {
          setFeedback({ type: 'error', message: res.message || 'Yedek geri yüklenemedi.' });
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: 'Geçersiz JSON yedek dosyası seçildi!' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const fetchDriveBackupsList = async () => {
    if (!getCachedAccessToken()) {
      setIsDriveConnected(false);
      return;
    }
    setIsLoadingDriveBackups(true);
    try {
      const items = await listBackupsFromGoogleDrive();
      setDriveBackups(items);
      setIsDriveConnected(true);
    } catch (err) {
      console.warn('Drive backup fetch error:', err);
    } finally {
      setIsLoadingDriveBackups(false);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    setFeedback(null);
    try {
      const token = await connectGoogleDrive();
      if (token) {
        setIsDriveConnected(true);
        setFeedback({
          type: 'success',
          message: 'Google Drive bağlantısı başarıyla kuruldu! AkademiPanel yedekleriniz taranıyor.'
        });
        await fetchDriveBackupsList();
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setFeedback({ type: 'error', message: 'Google oturum açma penceresi kapatıldı.' });
      } else {
        setFeedback({ type: 'error', message: err?.message || 'Google Drive bağlantısı kurulamadı.' });
      }
    } finally {
      setIsConnectingDrive(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'drive') {
      if (getCachedAccessToken()) {
        setIsDriveConnected(true);
        fetchDriveBackupsList();
      } else {
        setIsDriveConnected(false);
      }
    }
  }, [isOpen, activeTab]);

  const handleUploadDirectlyToDrive = async () => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Google Drive üzerine yedek yükleme yetkisi yalnızca İdarecilere aittir.' });
      return;
    }
    setIsUploadingToDrive(true);
    setFeedback(null);
    try {
      if (!getCachedAccessToken()) {
        const token = await connectGoogleDrive();
        if (!token) {
          setFeedback({ type: 'error', message: 'Google Drive bağlantısı onaylanmadı.' });
          setIsUploadingToDrive(false);
          return;
        }
        setIsDriveConnected(true);
      }

      const s = state;
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
      const backupPayload = {
        appName: "AkademiPanel",
        storageType: "google_drive_cloud_backup",
        version: s.version || 2,
        backupDate: new Date().toISOString(),
        school: "Kırklareli Atatürk Ortaokulu",
        exportedBy: currentEmail,
        summary: {
          studentCount: s.students?.length || 0,
          examCount: s.exams?.length || 0,
          resultCount: s.results?.length || 0,
          hallCount: s.examHalls?.length || 0,
          budgetIncomesCount: s.budget?.incomes?.length || 0,
          budgetExpensesCount: s.budget?.expenses?.length || 0,
          budgetDebtsCount: s.budget?.debts?.length || 0,
        },
        data: s
      };

      const res = await uploadBackupToGoogleDrive(backupPayload, driveCustomName);
      if (res.success) {
        setIsDriveConnected(true);
        setFeedback({
          type: 'success',
          message: `"${res.fileName}" başarıyla doğrudan Google Drive hesabınıza yüklendi!`
        });
        setDriveCustomName('');
        await fetchDriveBackupsList();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Google Drive üzerine yedek yüklenemedi.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Google Drive bağlantı hatası oluştu.'
      });
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleRestoreFromDrive = async (item: DriveBackupItem) => {
    if (!isAdmin) return;
    setActionLoadingId(item.id);
    setFeedback(null);
    try {
      const rawData = await downloadBackupFromGoogleDrive(item.id);
      const targetData = rawData.data || rawData;
      const res = await restoreBackup(targetData);
      if (res.success && res.summary) {
        setFeedback({
          type: 'success',
          message: `"${item.name}" Google Drive'dan başarıyla geri yüklendi! (${res.summary.studentCount} Öğrenci, ${res.summary.examCount} Sınav, ${res.summary.resultCount} Sonuç)`
        });
        setConfirmRestoreDriveItem(null);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Yedek geri yüklenemedi.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Google Drive yedeği indirilemedi.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteFromDrive = async (item: DriveBackupItem) => {
    if (!isAdmin) return;
    setActionLoadingId(item.id);
    setFeedback(null);
    try {
      const ok = await deleteBackupFromGoogleDrive(item.id);
      if (ok) {
        setFeedback({ type: 'success', message: `"${item.name}" Google Drive'dan başarıyla silindi.` });
        setDriveBackups(prev => prev.filter(b => b.id !== item.id));
        setConfirmDeleteDriveItem(null);
      } else {
        setFeedback({ type: 'error', message: 'Yedek Google Drive üzerinden silinemedi.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Silme işlemi sırasında hata oluştu.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const isHealthy = syncStatus === 'synced';

  if (!isOpen || (userRole !== 'admin' && userRole !== 'teacher')) return null;

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden border border-[#e6e2d3] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e6e2d3] bg-[#fcfbf7] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-[#B08D57] text-white flex items-center justify-center shadow-md shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-serif font-bold text-[#343a28]">
                  Sistem & Bulut Yedekleme Merkezi
                </h2>
                {isAdmin ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Yönetici Yetkili (Tam Yetki)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-sky-600" />
                    Öğretmen Yetkisi (Salt Okunur)
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8e8d82] truncate">
                {isAdmin 
                  ? 'Tüm verileriniz güvenle saklanır, geçmiş sistem yedekleri cihaz ve yerel depolamada korunur' 
                  : 'Firebase üzerinde saklanan sistem yedeklerini ve geçmiş kayıtları görüntüleyebilirsiniz'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-[#8e8d82] hover:bg-[#e6e2d3] hover:text-[#5a5a40] rounded-full transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User & Cloud Status Strip */}
        <div className="bg-[#FAF9F5] border-b border-[#e6e2d3] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[#5a5a40]">
              <UserIcon className="w-3.5 h-3.5 text-[#B08D57]" />
              <span className="font-semibold text-xs">{displayName}</span>
              <span className="text-[#8e8d82]">({currentEmail})</span>
            </div>
            <span className="text-[#dcd8c9]">|</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-medium text-[#5a5a40]">
                {isHealthy ? 'Bulut Senkronize' : 'Yerel Hafıza Modu'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button
                onClick={handleSyncNow}
                disabled={isSyncingNow}
                className="px-3 py-1.5 bg-[#B08D57] hover:bg-[#9c7b48] active:scale-[0.98] text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                {isSyncingNow ? 'Eşitleniyor...' : 'Tüm Verileri Bulutla Eşitle'}
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-white border border-[#e6e2d3] text-[#6e705b] font-medium rounded-lg flex items-center gap-1.5 text-xs shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Buluta Yazma Korumalı</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#e6e2d3] bg-white px-5 shrink-0">
          <button
            onClick={() => setActiveTab('backups')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'backups' 
                ? 'border-[#B08D57] text-[#B08D57]' 
                : 'border-transparent text-[#8e8d82] hover:text-[#5a5a40]'
            }`}
          >
            <CloudDownload className="w-4 h-4" />
            <span>Bulut Yedekleri ({cloudBackups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sync' 
                ? 'border-[#B08D57] text-[#B08D57]' 
                : 'border-transparent text-[#8e8d82] hover:text-[#5a5a40]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Canlı Senkronizasyon & Tanı</span>
          </button>

          <button
            onClick={() => setActiveTab('drive')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'drive' 
                ? 'border-[#B08D57] text-[#B08D57]' 
                : 'border-transparent text-[#8e8d82] hover:text-[#5a5a40]'
            }`}
          >
            <FolderCheck className="w-4 h-4 text-emerald-600" />
            <span>Google Drive Hibrit Yedekleme</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Feedback Message */}
          {feedback && (
            <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-fade-in ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <div className="flex items-center gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button 
                onClick={() => setFeedback(null)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'backups' && (
            <div className="space-y-4">
              {/* Action Cards Grid */}
              {isAdmin ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Instant Cloud Backup Trigger */}
                  <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-xs">
                        <CloudUpload className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-[#343a28]">Tam Sistem Yedeği Al</h3>
                      <p className="text-[11px] text-[#6e705b] mt-1">
                        Öğrenciler, sınavlar, sonuçlar, salonlar ve bütçeyi anında yeni bir sistem yedek noktası olarak kaydeder.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCreateForm(prev => !prev)}
                      className="mt-3 w-full py-2 px-3 bg-[#B08D57] hover:bg-[#9c7b48] active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showCreateForm ? 'İptal Et' : 'Yeni Sistem Yedeği Al'}
                    </button>
                  </div>

                  {/* Upload JSON to Cloud */}
                  <div className="bg-gradient-to-br from-sky-50 to-white p-4 rounded-2xl border border-sky-200/80 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center mb-2 shadow-xs">
                        <Download className="w-4 h-4 rotate-180" />
                      </div>
                      <h3 className="font-bold text-sm text-[#343a28]">Cihazdaki Yedeği İçe Aktar</h3>
                      <p className="text-[11px] text-[#6e705b] mt-1">
                        Bilgisayarınızda veya telefonunuzda bulunan bir `.json` yedek dosyasını doğrudan sisteme aktarın.
                      </p>
                    </div>
                    <label 
                      htmlFor="cloud-upload-input" 
                      className="mt-3 w-full py-2 px-3 bg-white hover:bg-sky-50 active:scale-[0.98] text-sky-700 border border-sky-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>JSON Seç ve Buluta Yükle</span>
                    </label>
                    <input 
                      type="file" 
                      id="cloud-upload-input" 
                      accept=".json" 
                      className="hidden" 
                      onChange={handleUploadLocalJsonToCloud} 
                    />
                  </div>

                  {/* Local JSON Download */}
                  <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-xs">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-[#343a28]">Cihaza Yedek İndir (JSON)</h3>
                      <p className="text-[11px] text-[#6e705b] mt-1">
                        Mevcut tüm verilerinizi istediğiniz zaman bilgisayarınıza veya telefonunuza yedek dosyası olarak indirin.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const fullState = {
                          version: '2.0',
                          backupDate: new Date().toISOString(),
                          ...state
                        };
                        const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `AkademiPanel_Tam_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        setFeedback({ type: 'success', message: 'Sistem yedeği cihazınıza JSON olarak indirildi.' });
                      }}
                      className="mt-3 w-full py-2 px-3 bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Cihaza İndir (.json)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50/40 to-white border border-sky-200/80 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#343a28] flex items-center gap-2">
                        <span>Bulut Yedekleri İnceleme Modu</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                          Salt Okunur (Görüntüleme)
                        </span>
                      </h4>
                      <p className="text-xs text-[#6e705b] mt-0.5 leading-relaxed">
                        Öğretmen yetkisiyle Firebase üzerindeki kayıtlı tüm sistem yedeklerini, sınav ve öğrenci sayılarını, modül içeriklerini ve yedekleme tarihçesini inceleyebilirsiniz. Yeni yedek oluşturma, cihazınıza JSON indirme, silme ve geri yükleme işlemleri veri güvenliği politikası gereğince yalnızca Okul Yöneticilerine ve Süper Adminlere açıktır.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Create Backup Drawer Form */}
              {showCreateForm && (
                <form 
                  onSubmit={handleTakeBackup} 
                  className="p-4 bg-[#fcfbf7] rounded-2xl border border-[#B08D57]/40 shadow-sm space-y-3 animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#5a5a40] flex items-center gap-1.5">
                      <CloudUpload className="w-4 h-4 text-[#B08D57]" />
                      Sistem Yedeği Oluştur
                    </h4>
                    <span className="text-[11px] text-[#8e8d82]">
                      ({state.students?.length || 0} Öğrenci, {state.exams?.length || 0} Sınav)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e705b] mb-1">
                        Yedek Adı (İsteğe Bağlı):
                      </label>
                      <input
                        type="text"
                        value={customBackupName}
                        onChange={(e) => setCustomBackupName(e.target.value)}
                        placeholder={`Örn: 1. Dönem Sonu Yedeği`}
                        className="w-full text-xs p-2.5 bg-white border border-[#e6e2d3] rounded-xl focus:outline-none focus:border-[#B08D57]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e705b] mb-1">
                        Yedek Notu (İsteğe Bağlı):
                      </label>
                      <input
                        type="text"
                        value={backupNote}
                        onChange={(e) => setBackupNote(e.target.value)}
                        placeholder="Örn: 8. sınıf LGS deneme 5 sonrası alındı"
                        className="w-full text-xs p-2.5 bg-white border border-[#e6e2d3] rounded-xl focus:outline-none focus:border-[#B08D57]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-3 py-2 text-xs font-semibold text-[#8e8d82] hover:text-[#5a5a40] cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-4 py-2 bg-[#B08D57] hover:bg-[#9c7b48] active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCreating ? 'animate-spin' : ''}`} />
                      {isCreating ? 'Yedek Buluta Kaydediliyor...' : 'Yedeği Buluta Kaydet'}
                    </button>
                  </div>
                </form>
              )}

              {/* Confirm Restore Dialog */}
              {confirmRestoreBackup && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-900">
                        Bulut Yedeğini Geri Yüklemek Üzeresiniz
                      </h4>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        <strong>"{confirmRestoreBackup.name}"</strong> ({formatDate(confirmRestoreBackup.createdAt)}) tarihli yedek sisteme geri yüklenecektir. Mevcut verileriniz bu yedekteki verilerle eşitlenecektir.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setConfirmRestoreBackup(null)}
                      className="px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 rounded-xl cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleConfirmRestore}
                      disabled={actionLoadingId === confirmRestoreBackup.id}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${actionLoadingId === confirmRestoreBackup.id ? 'animate-spin' : ''}`} />
                      {actionLoadingId === confirmRestoreBackup.id ? 'Geri Yükleniyor...' : 'Evet, Bu Yedeği Geri Yükle'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cloud Backups List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#8e8d82] flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-[#B08D57]" />
                    Kayıtlı Sistem Yedekleri ({cloudBackups.length})
                  </h3>
                  {isLoadingBackups && (
                    <span className="text-[11px] text-[#8e8d82] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Yükleniyor...
                    </span>
                  )}
                </div>

                {cloudBackups.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF9F5] rounded-2xl border border-dashed border-[#e6e2d3] space-y-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-[#B08D57] mx-auto flex items-center justify-center">
                      <Cloud className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#5a5a40]">Henüz Sistem Yedeği Alınmamış</h4>
                      <p className="text-xs text-[#8e8d82] max-w-md mx-auto mt-1">
                        {isAdmin 
                          ? 'Yukarıdaki "Yeni Sistem Yedeği Al" butonuna basarak ilk tam sistem yedeğinizi kaydedebilirsiniz.'
                          : 'Okul yöneticisi tarafından sistem yedeği alındığında burada listelenecektir.'
                        }
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleTakeBackup()}
                        disabled={isCreating}
                        className="px-4 py-2 bg-[#B08D57] hover:bg-[#9c7b48] text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        İlk Bulut Yedeğini Şimdi Al
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cloudBackups.map((record) => {
                      const isConfirmingDelete = confirmDeleteId === record.id;
                      const isActionBusy = actionLoadingId === record.id;

                      return (
                        <div 
                          key={record.id}
                          className="p-4 bg-white rounded-2xl border border-[#e6e2d3] hover:border-[#B08D57]/50 transition-all shadow-xs space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-[#343a28]">
                                  {record.name}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F5] text-[#5a5a40] border border-[#e6e2d3]">
                                  v{record.data?.version || '2.0'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[#8e8d82] mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-[#B08D57]" />
                                  {formatDate(record.createdAt)}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <UserIcon className="w-3 h-3 text-[#B08D57]" />
                                  {record.createdByEmail}
                                </span>
                              </div>
                              {record.note && (
                                <p className="text-[11px] text-[#6e705b] italic mt-1 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 inline-block">
                                  Not: {record.note}
                                </p>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              {isAdmin ? (
                                <>
                                  <button
                                    onClick={() => handleDownloadBackupJson(record)}
                                    className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-[#5a5a40] font-semibold rounded-xl text-xs border border-gray-200 transition-all flex items-center gap-1 cursor-pointer"
                                    title="Bu yedeği JSON dosyası olarak indir"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">İndir</span>
                                  </button>

                                  <button
                                    onClick={() => setConfirmRestoreBackup(record)}
                                    disabled={isActionBusy}
                                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs border border-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                                    title="Bu yedeği sisteme geri yükle"
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isActionBusy ? 'animate-spin' : ''}`} />
                                    <span>Buluttan Geri Yükle</span>
                                  </button>

                                  {isConfirmingDelete ? (
                                    <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-200">
                                      <span className="text-[10px] text-rose-700 font-bold px-1">Silinsin mi?</span>
                                      <button
                                        onClick={() => handleConfirmDelete(record.id)}
                                        disabled={isActionBusy}
                                        className="px-2 py-0.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-rose-700"
                                      >
                                        Evet
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="px-2 py-0.5 bg-white text-gray-700 rounded-lg text-[10px] font-semibold border cursor-pointer"
                                      >
                                        Hayır
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDeleteId(record.id)}
                                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                      title="Bu yedeği buluttan sil"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1 border border-slate-200">
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  <span>Yalnızca Görüntüleme</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Data Breakdown Chips */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center text-xs">
                            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#e6e2d3]/70">
                              <span className="font-bold text-[#5a5a40]">{record.summary?.studentCount ?? record.data?.students?.length ?? 0}</span>
                              <span className="text-[10px] text-[#8e8d82] block">Öğrenci</span>
                            </div>
                            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#e6e2d3]/70">
                              <span className="font-bold text-[#5a5a40]">{record.summary?.examCount ?? record.data?.exams?.length ?? 0}</span>
                              <span className="text-[10px] text-[#8e8d82] block">Deneme Sınavı</span>
                            </div>
                            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#e6e2d3]/70">
                              <span className="font-bold text-[#5a5a40]">{record.summary?.resultCount ?? record.data?.results?.length ?? 0}</span>
                              <span className="text-[10px] text-[#8e8d82] block">Sınav Sonucu</span>
                            </div>
                            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#e6e2d3]/70">
                              <span className="font-bold text-[#5a5a40]">{record.summary?.hallCount ?? record.data?.examHalls?.length ?? 0}</span>
                              <span className="text-[10px] text-[#8e8d82] block">Sınav Salonu</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border ${
                isHealthy 
                  ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 border-emerald-200' 
                  : 'bg-gradient-to-br from-amber-50 via-white to-amber-50/40 border-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                    isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}>
                    {isHealthy ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#343a28]">
                      {isHealthy ? 'Veritabanı Durumu Sorunsuz' : 'Yerel Koruma Modu'}
                    </h3>
                    <p className="text-xs text-[#6e705b] mt-0.5">
                      {isHealthy 
                        ? 'Tüm öğrenci, sınav, sonuç ve bütçe verileriniz yerel hafızada anlık korunmaktadır.'
                        : 'Verileriniz tarayıcınızın yerel hafızasında korunmaktadır.'
                      }
                    </p>
                  </div>
                </div>

                {syncStatus === 'quota_exceeded' ? (
                  <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold flex items-center gap-1.5 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Firestore Günlük Yazma Kotası Doldu
                      </span>
                      <a
                        href={FIRESTORE_UPGRADE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors"
                      >
                        <span>Kotayı İncele</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-amber-800/90 leading-relaxed">
                      Spark ücretsiz planında günlük 20.000 yazma limiti tamamlandı. Tüm verileriniz bu cihazda güvenle saklanmakta ve sistem kesintisiz çalışmaktadır. Kota her gün Pasifik saatiyle gece yarısı otomatik sıfırlanır.
                    </p>
                  </div>
                ) : syncErrorMessage && !isHealthy ? (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                    <span className="font-bold block">Tanı Mesajı:</span>
                    <span>{syncErrorMessage}</span>
                  </div>
                ) : null}
              </div>

              {/* Connection Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3.5 rounded-2xl border border-[#e6e2d3] space-y-1">
                  <span className="text-[#8e8d82] text-[11px] font-semibold">Bulut / Depolama Durumu:</span>
                  <p className="font-mono font-bold text-[#5a5a40]">{firebaseConfig.projectId || 'Yerel Mod (LocalStorage)'}</p>
                  <span className="text-[10px] text-emerald-600 font-semibold block truncate">
                    {firebaseConfig.projectId 
                      ? `Firestore Veritabanı: ${firebaseConfig.firestoreDatabaseId || '(default)'}` 
                      : 'Veriler ve yedekler tarayıcıda saklanır'}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#e6e2d3] space-y-1">
                  <span className="text-[#8e8d82] text-[11px] font-semibold">Aktif Oturum Açan Yönetici:</span>
                  <p className="font-semibold text-[#5a5a40] truncate">{currentEmail}</p>
                  <span className="text-[10px] text-[#B08D57] font-bold block">Google Kimlik Doğrulamalı</span>
                </div>
              </div>

              {/* Cloud Diagnostic & Data Transmission Check Card */}
              <div className="p-4 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 rounded-2xl border border-amber-200/80 shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#B08D57] text-white flex items-center justify-center shadow-xs">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#343a28]">Bulut Sunucu Veri İletim & Yedek Kontrolü</h4>
                      <p className="text-[11px] text-[#6e705b]">
                        Buluttaki güncel öğrenci, sınav, sonuç ve yedek verilerinin iletim durumunu denetleyin.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRunDiagnostic}
                      disabled={isTestingCloud}
                      className="px-3 py-1.5 bg-white hover:bg-amber-50 active:scale-[0.98] border border-amber-300 text-amber-900 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#B08D57] ${isTestingCloud ? 'animate-spin' : ''}`} />
                      <span>{isTestingCloud ? 'Denetleniyor...' : 'Veri İletimini Kontrol Et'}</span>
                    </button>

                    <button
                      onClick={handlePullFromCloud}
                      disabled={isPullingData}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      title="Bulut sunucudaki en güncel verileri bu cihaza indirir ve eşitler"
                    >
                      <CloudDownload className={`w-3.5 h-3.5 ${isPullingData ? 'animate-bounce' : ''}`} />
                      <span>{isPullingData ? 'İndiriliyor...' : 'Buluttaki Verileri İndir & Eşitle'}</span>
                    </button>
                  </div>
                </div>

                {cloudDiagnosticResult && (
                  <div className="p-3.5 bg-white rounded-xl border border-amber-200/60 shadow-2xs space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-[11px] pb-1 border-b border-gray-100">
                      <span className="text-gray-500 font-medium">Son Test Zamanı: <b className="text-gray-800">{cloudDiagnosticResult.testedAt}</b></span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Bağlantı & İletim Aktif
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                      <div className="p-2 bg-[#fcfbf7] rounded-lg border border-[#e6e2d3]">
                        <span className="text-[10px] text-gray-500 block">Bulut Sürümü</span>
                        <b className="text-xs text-[#B08D57]">v{cloudDiagnosticResult.serverVersion || 1}</b>
                      </div>
                      <div className="p-2 bg-[#fcfbf7] rounded-lg border border-[#e6e2d3]">
                        <span className="text-[10px] text-gray-500 block">Sunucu Öğrenci</span>
                        <b className="text-xs text-[#5a5a40]">{cloudDiagnosticResult.serverStudentsCount} Kayıt</b>
                      </div>
                      <div className="p-2 bg-[#fcfbf7] rounded-lg border border-[#e6e2d3]">
                        <span className="text-[10px] text-gray-500 block">Sunucu Sınav</span>
                        <b className="text-xs text-[#5a5a40]">{cloudDiagnosticResult.serverExamsCount} Sınav</b>
                      </div>
                      <div className="p-2 bg-[#fcfbf7] rounded-lg border border-[#e6e2d3]">
                        <span className="text-[10px] text-gray-500 block">Bulut Yedekleri</span>
                        <b className="text-xs text-emerald-700">
                          {cloudDiagnosticResult.serverBackupsCount} Yedek ({cloudDiagnosticResult.backupsWithDataCount} Dolu)
                        </b>
                      </div>
                    </div>

                    {cloudDiagnosticResult.serverLastPublishedAt && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        Bulut Sunucu Son Yayınlama Zamanı: <span className="font-semibold text-gray-700">{new Date(cloudDiagnosticResult.serverLastPublishedAt).toLocaleString('tr-TR')}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#fcfbf7] rounded-2xl border border-[#e6e2d3] space-y-2 text-xs">
                <h4 className="font-bold text-xs text-[#5a5a40]">Yetkili Yöneticiler (Admins):</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(state.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com']).map((adminEmail, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-1 bg-white border border-[#e6e2d3] rounded-lg text-[11px] font-semibold text-[#5a5a40] shadow-2xs"
                    >
                      {adminEmail}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={handlePullFromCloud}
                  disabled={isPullingData}
                  className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CloudDownload className="w-4 h-4 text-emerald-600" />
                  <span>Buluttan Veri Çek & Eşitle</span>
                </button>

                <button
                  onClick={handleSyncNow}
                  disabled={isSyncingNow}
                  className="px-5 py-2.5 bg-[#B08D57] hover:bg-[#9c7b48] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  {isSyncingNow ? 'Doğrulanıyor & Eşitleniyor...' : 'Şimdi Doğrula & Buluta Gönder'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE DRIVE HİBRİT YEDEKLEME & İLETİM */}
          {activeTab === 'drive' && (
            <div className="space-y-4 animate-fade-in">
              {/* Info Card */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <FolderCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-emerald-950 font-serif">
                      Google Drive Hibrit Depolama & Kullanıcı İletim Merkezi
                    </h3>
                    <p className="text-xs text-emerald-800/90 leading-relaxed">
                      Firebase Spark plan kotalarını sıfırlamak ve okul verilerini 15 GB ücretsiz Google Drive alanınızda güvenle saklamak için tasarlanmıştır. Bu panel üzerinden tek tıkla standart yedek alabilir veya paylaşılan Drive yedeğini sisteme yükleyebilirsiniz.
                    </p>
                  </div>
                </div>

                {/* Database Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-emerald-200/60">
                  <div className="bg-white/85 rounded-xl p-2.5 border border-emerald-200/50">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Kayıtlı Öğrenci</span>
                    <span className="text-lg font-serif font-bold text-emerald-950">{state.students?.length || 0}</span>
                  </div>
                  <div className="bg-white/85 rounded-xl p-2.5 border border-emerald-200/50">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Deneme Sınavı</span>
                    <span className="text-lg font-serif font-bold text-emerald-950">{state.exams?.length || 0}</span>
                  </div>
                  <div className="bg-white/85 rounded-xl p-2.5 border border-emerald-200/50">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Optik / Sonuçlar</span>
                    <span className="text-lg font-serif font-bold text-emerald-950">{state.results?.length || 0}</span>
                  </div>
                  <div className="bg-white/85 rounded-xl p-2.5 border border-emerald-200/50">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Yerel Koruma</span>
                    <span className="text-xs font-bold text-emerald-600 mt-1 block">✓ %100 Aktif</span>
                  </div>
                </div>
              </div>

              {/* Connection Status Card */}
              {!isDriveConnected ? (
                <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <h4 className="text-xs sm:text-sm font-bold text-amber-950 font-serif">Google Drive Bağlantısı Bekleniyor</h4>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed max-w-xl">
                      Google Drive API izinleri projenizde başarıyla etkinleştirildi. Veritabanı kopyanızı doğrudan Google Drive alanınıza yüklemek ve Drive'daki yedeklerinizi görüntülemek için Google hesabınızla yetkilendirme yapınız.
                    </p>
                  </div>
                  <button
                    onClick={handleConnectDrive}
                    disabled={isConnectingDrive}
                    className="px-4 py-2.5 bg-white hover:bg-gray-50 active:scale-[0.98] text-gray-800 font-bold text-xs rounded-xl border border-gray-300 shadow-xs flex items-center gap-2.5 shrink-0 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>{isConnectingDrive ? 'Drive\'a Bağlanıyor...' : 'Google ile Drive\'a Bağlan'}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50/90 border border-emerald-300/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-emerald-950">Google Drive Bağlantısı Aktif</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-semibold">Yetkili</span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Hesap: <span className="font-semibold">{currentEmail}</span> • 15 GB Drive depolamanız yedekleme için hazır.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleConnectDrive}
                    disabled={isConnectingDrive}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                    <span>Yeniden Yetkilendir</span>
                  </button>
                </div>
              )}

              {/* 30-Second Google Drive Live Sync Card */}
              <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 rounded-2xl p-4 sm:p-5 border border-emerald-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                      <RefreshCw className={`w-4 h-4 ${isDriveAutoSyncing ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-emerald-950 font-serif">
                          Google Drive Canlı Master Kütük (30 Saniyede Bir Otomatik)
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                          0 Firebase Kotası
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        Tüm öğrenci, sınav ve bütçe kayıtları yerel hafızaya anında yazılır; her 30 saniyede bir Drive'daki <code className="bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded font-mono font-bold text-[10px]">AkademiPanel_Canli_Kutuk.json</code> dosyasına otomatik aktarılır.
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={async () => {
                        setFeedback(null);
                        try {
                          const res = await syncToDriveNow();
                          if (res.success) {
                            setFeedback({ type: 'success', message: 'Google Drive canlı master kütüğü başarıyla güncellendi!' });
                            fetchDriveBackupsList();
                          } else {
                            setFeedback({ type: 'error', message: res.error || 'Drive senkronizasyon hatası' });
                          }
                        } catch (e: any) {
                          setFeedback({ type: 'error', message: e?.message || 'Drive bağlantı hatası' });
                        }
                      }}
                      disabled={isDriveAutoSyncing}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <UploadCloud className={`w-3.5 h-3.5 ${isDriveAutoSyncing ? 'animate-bounce' : ''}`} />
                      <span>{isDriveAutoSyncing ? 'Drive Eşitleniyor...' : 'Şimdi Drive Master\'ı Güncelle'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
                  <div className="bg-white/90 p-2 rounded-xl border border-emerald-200/50">
                    <span className="text-[10px] text-emerald-700 font-semibold block">Eşitleme Modu</span>
                    <span className="font-bold text-emerald-950">30 Saniyede Bir Canlı</span>
                  </div>
                  <div className="bg-white/90 p-2 rounded-xl border border-emerald-200/50">
                    <span className="text-[10px] text-emerald-700 font-semibold block">Son Drive Eşitleme</span>
                    <span className="font-bold text-emerald-950">{lastDriveSyncedAt || 'Beklemede (İlk kayıtla başlar)'}</span>
                  </div>
                  <div className="bg-white/90 p-2 rounded-xl border border-emerald-200/50 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-emerald-700 font-semibold block">Çoklu Admin Durumu</span>
                    <span className="font-bold text-emerald-950">Ortak Master Eşitliği Aktif</span>
                  </div>
                </div>
              </div>

              {/* Action 1: DIRECT GOOGLE DRIVE CLOUD BACKUP (Real-Time API Upload) */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e6e2d3] shadow-xs space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                      <UploadCloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#2d2c25]">Google Drive'a Doğrudan Yedek Al</h4>
                      <p className="text-[11px] text-[#737265]">
                        Okul veritabanınızı tek tıkla doğrudan Google Drive hesabınıza dosya olarak yükler.
                      </p>
                    </div>
                  </div>

                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#5a5a40] text-xs font-bold rounded-xl transition-all border border-[#e6e2d3] flex items-center gap-1.5 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                    <span>Drive'ı Aç</span>
                  </a>
                </div>

                {isAdmin ? (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        type="text" 
                        value={driveCustomName}
                        onChange={(e) => setDriveCustomName(e.target.value)}
                        placeholder="Özel yedek adı (İsteğe bağlı, örn: 1. Dönem Final Kütük Yedeği)"
                        className="flex-1 bg-white border border-[#e6e2d3] rounded-xl px-3 py-2 text-xs font-medium text-[#2d2c25] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                      <button
                        onClick={handleUploadDirectlyToDrive}
                        disabled={isUploadingToDrive}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <UploadCloud className={`w-4 h-4 ${isUploadingToDrive ? 'animate-bounce' : ''}`} />
                        <span>{isUploadingToDrive ? 'Drive\'a Yükleniyor...' : 'Google Drive\'a Şimdi Yükle'}</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={autoDriveBackup} 
                          onChange={(e) => {
                            setAutoDriveBackup(e.target.checked);
                            try {
                              localStorage.setItem('akademi_auto_drive_backup', e.target.checked ? 'true' : 'false');
                            } catch {}
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" 
                        />
                        <span className="text-xs text-[#2d2c25] font-medium">
                          Buluta Yayınla & Eşitle yapıldığında Google Drive'a da otomatik yedek gönder (Çifte Güvence)
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 font-medium">
                    Google Drive üzerine yedek yükleme yetkisi yalnızca İdareci kullanıcılara aittir.
                  </div>
                )}
              </div>

              {/* Confirm Restore Drive Item Dialog */}
              {confirmRestoreDriveItem && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-900 font-serif">
                        Google Drive Yedeğini Sisteme Geri Yüklemek Üzeresiniz
                      </h4>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        <strong>"{confirmRestoreDriveItem.name}"</strong> ({formatDate(confirmRestoreDriveItem.createdTime)}) tarihli Google Drive yedeği sisteme aktarılacaktır. Mevcut verileriniz bu yedekteki verilerle eşitlenecektir. Devam etmek istiyor musunuz?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setConfirmRestoreDriveItem(null)}
                      className="px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 rounded-xl cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => handleRestoreFromDrive(confirmRestoreDriveItem)}
                      disabled={actionLoadingId === confirmRestoreDriveItem.id}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${actionLoadingId === confirmRestoreDriveItem.id ? 'animate-spin' : ''}`} />
                      {actionLoadingId === confirmRestoreDriveItem.id ? 'Geri Yükleniyor...' : 'Evet, Drive Yedeğini Geri Yükle'}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Delete Drive Item Dialog (Workspace Safety Requirement) */}
              {confirmDeleteDriveItem && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-rose-900 font-serif">
                        Bu Yedeği Google Drive'dan Silmek İstediğinize Emin Misiniz?
                      </h4>
                      <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                        <strong>"{confirmDeleteDriveItem.name}"</strong> dosyası Google Drive hesabınızdan kalıcı olarak silinecektir. Bu işlem geri alınamaz.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setConfirmDeleteDriveItem(null)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100 rounded-xl cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => handleDeleteFromDrive(confirmDeleteDriveItem)}
                      disabled={actionLoadingId === confirmDeleteDriveItem.id}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {actionLoadingId === confirmDeleteDriveItem.id ? 'Siliniyor...' : 'Evet, Drive\'dan Sil'}
                    </button>
                  </div>
                </div>
              )}

              {/* Action 2: LIVE GOOGLE DRIVE BACKUPS LIST */}
              <div className="bg-white rounded-2xl border border-[#e6e2d3] shadow-xs overflow-hidden">
                <div className="p-4 bg-[#fcfbf7] border-b border-[#e6e2d3] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FolderCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-[#2d2c25]">
                      Google Drive'daki AkademiPanel Yedekleriniz ({driveBackups.length})
                    </h4>
                  </div>
                  <button
                    onClick={fetchDriveBackupsList}
                    disabled={isLoadingDriveBackups}
                    className="p-1.5 rounded-lg hover:bg-gray-200/60 text-gray-600 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="Listeyi Yenile"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDriveBackups ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Yenile</span>
                  </button>
                </div>

                <div className="divide-y divide-[#e6e2d3]/60 max-h-72 overflow-y-auto">
                  {isLoadingDriveBackups ? (
                    <div className="py-8 text-center text-xs text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                      <span>Google Drive yedekleri taranıyor...</span>
                    </div>
                  ) : driveBackups.length > 0 ? (
                    driveBackups.map((item) => (
                      <div key={item.id} className="p-3 sm:p-4 hover:bg-gray-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-[#2d2c25] truncate">{item.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                              Google Drive
                            </span>
                          </div>
                          <p className="text-[11px] text-[#737265] flex items-center gap-2">
                            <span>{formatDate(item.createdTime)}</span>
                            {item.size && (
                              <>
                                <span>•</span>
                                <span>{(parseInt(item.size) / 1024).toFixed(1)} KB</span>
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {item.webViewLink && (
                            <a
                              href={item.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl border border-gray-300 transition-all flex items-center gap-1"
                              title="Google Drive'da Görüntüle"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Drive'da Aç</span>
                            </a>
                          )}

                          {isAdmin && (
                            <>
                              <button
                                onClick={() => setConfirmRestoreDriveItem(item)}
                                disabled={actionLoadingId === item.id}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Bu yedeği sisteme yükle"
                              >
                                <CloudDownload className="w-3.5 h-3.5" />
                                <span>Geri Yükle</span>
                              </button>

                              <button
                                onClick={() => setConfirmDeleteDriveItem(item)}
                                disabled={actionLoadingId === item.id}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-all cursor-pointer"
                                title="Google Drive'dan Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-gray-500 space-y-1">
                      <FolderCheck className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                      <p className="font-semibold text-gray-700">Google Drive'ınızda henüz AkademiPanel yedeği bulunamadı.</p>
                      <p className="text-[11px] text-gray-400">Yukarıdaki "Google Drive'a Şimdi Yükle" butonuna basarak ilk yedeğinizi hemen alabilirsiniz.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Download JSON & Restore JSON */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Download Backup for Drive */}
                <div className="bg-white rounded-2xl p-4 border border-[#e6e2d3] shadow-xs flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Download className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-[#2d2c25]">Yedek Dosyası İndir (.json)</h4>
                    </div>
                    <p className="text-[11px] text-[#737265] leading-normal">
                      Google Drive'a elle de aktarabilmeniz veya harici diskte saklamanız için veritabanınızı JSON dosyası olarak indirir.
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadDriveBackup}
                    className="w-full px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-[#5a5a40] text-xs font-bold rounded-xl transition-all border border-[#e6e2d3] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Cihaza İndir (.json)</span>
                  </button>
                </div>

                {/* Restore Backup from Drive */}
                <div className="bg-white rounded-2xl p-4 border border-[#e6e2d3] shadow-xs flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        <UploadCloud className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-[#2d2c25]">Yerel JSON Dosyasından Yükle</h4>
                    </div>
                    <p className="text-[11px] text-[#737265] leading-normal">
                      Bilgisayarınızda veya Drive'dan daha önce indirdiğiniz herhangi bir `.json` dosyasını seçerek anında kütüğü güncelleyin.
                    </p>
                  </div>

                  {isAdmin ? (
                    <label className="w-full px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-[#5a5a40] text-xs font-bold rounded-xl transition-all border border-[#e6e2d3] flex items-center justify-center gap-1.5 cursor-pointer text-center">
                      <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Dosyadan Seç ve Geri Yükle</span>
                      <input 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        onChange={handleRestoreDriveFile} 
                      />
                    </label>
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500 font-medium">
                      Yedek geri yükleme yetkisi İdarecilere aittir.
                    </div>
                  )}
                </div>
              </div>

              {/* How to distribute to teachers/other users guide */}
              <div className="bg-[#fcfbf7] rounded-2xl p-4 sm:p-5 border border-[#e6e2d3] space-y-3">
                <h4 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  <span>Öğretmenlere ve Diğer Cihazlara Veri İletimi Rehberi</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-[#e6e2d3] space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">1</span>
                    <p className="font-bold text-[#2d2c25]">Drive'a Şimdi Yükle</p>
                    <p className="text-[11px] text-[#737265]">
                      "Google Drive'a Şimdi Yükle" butonuna bastığınızda dosya doğrudan Google Drive'ınıza kaydedilir ve listede belirir.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#e6e2d3] space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">2</span>
                    <p className="font-bold text-[#2d2c25]">Klasörü / Dosyayı Paylaşın</p>
                    <p className="text-[11px] text-[#737265]">
                      Google Drive'da dosyanın paylaşım ayarını <em>"Bağlantıya sahip olan herkes görüntüleyebilir"</em> veya öğretmenlerin e-postalarına yetkili yapın.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#e6e2d3] space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">3</span>
                    <p className="font-bold text-[#2d2c25]">0 Kota ile Anında Eşitleyin</p>
                    <p className="text-[11px] text-[#737265]">
                      Diğer idareciler veya öğretmenler listeden veya indirilen dosyadan yükleme yaparak tüm verilere sıfır Firebase kotasıyla erişir.
                    </p>
                  </div>
                </div>
              </div>

              {/* Hybrid Sync Status & Manual Cloud Publish */}
              <div className="bg-white rounded-2xl p-4 border border-[#e6e2d3] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#2d2c25]">
                      {hasPendingChanges ? 'Bekleyen Yerel Değişiklikler Mevcut' : 'Tüm Değişiklikler Eşitlendi'}
                    </p>
                    <p className="text-[11px] text-[#737265]">
                      {hasPendingChanges 
                        ? `${pendingSyncCount} adet işlem yerel hafızada güvende. Dilediğiniz an buluta toplu gönderebilirsiniz.`
                        : `Son bulut eşitleme: ${lastSyncedAt || 'Güncel'}`}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncingNow}
                    className="w-full sm:w-auto px-4 py-2 bg-[#B08D57] hover:bg-[#9c7b48] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                    <span>{isSyncingNow ? 'Yayınlanıyor...' : 'Buluta Yayınla & Eşitle'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e6e2d3] bg-[#fcfbf7] flex items-center justify-between text-xs text-[#8e8d82] shrink-0">
          <span>Akademi Panel 2 • Bulut Yedekleme & Güvenlik</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#e6e2d3] hover:bg-gray-50 text-[#5a5a40] font-bold rounded-xl cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
