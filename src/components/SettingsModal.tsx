import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, UserPlus, Shield, Users, Trash2, Clock, Check, 
  ShieldCheck, UserCheck, Search, Sparkles, RefreshCw, AlertCircle,
  Calendar, ExternalLink, Mail, User as UserIcon
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { db, auth, collection, query, onSnapshot, deleteDoc, doc, setDoc } from '../lib/firebase';

interface RegisteredUserRecord {
  id: string;
  email: string;
  name?: string;
  photoURL?: string | null;
  role?: string;
  status?: string;
  lastLoginAt?: string;
  timestamp?: string;
}

const LOCAL_USERS_CACHE_KEY = 'akademi_registered_users_cache';

export const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { state, updateUsers, setUserAccountRole, userRole } = useAppContext();
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserRecord[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_USERS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Real-time listener for registered users who have logged in or attempted login
  useEffect(() => {
    if (isOpen && userRole === 'admin') {
      const q = query(collection(db, 'access_requests'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersList: RegisteredUserRecord[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          usersList.push({
            id: docSnap.id,
            email: (data.email || docSnap.id).trim().toLowerCase(),
            name: data.name || (data.email ? data.email.split('@')[0] : 'Kullanıcı'),
            photoURL: data.photoURL || null,
            role: data.role,
            status: data.status,
            lastLoginAt: data.lastLoginAt || data.timestamp,
            timestamp: data.timestamp || data.lastLoginAt
          });
        });

        // Merge with existing cached items
        try {
          const cached = localStorage.getItem(LOCAL_USERS_CACHE_KEY);
          const cachedList: RegisteredUserRecord[] = cached ? JSON.parse(cached) : [];
          cachedList.forEach(c => {
            if (!usersList.some(u => u.email === c.email)) {
              usersList.push(c);
            }
          });
          localStorage.setItem(LOCAL_USERS_CACHE_KEY, JSON.stringify(usersList));
        } catch {}

        setRegisteredUsers(usersList);
      }, (error) => {
        console.warn("Registered users onSnapshot notice:", error?.message || error);
      });
      return () => unsubscribe();
    }
  }, [isOpen, userRole]);

  if (!isOpen || userRole !== 'admin') return null;

  const admins = (state.admins || []).map(a => (a || '').trim().toLowerCase());
  const teachers = (state.teachers || []).map(t => (t || '').trim().toLowerCase());

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const isSuperAdmin = (email: string) => {
    const clean = (email || '').trim().toLowerCase();
    return clean === 'kirklareliataturkortaokulu@gmail.com' || clean === 'bahadirkumcu@gmail.com';
  };

  // Classify registered users
  const pendingUsers = registeredUsers.filter(u => {
    const email = (u.email || '').trim().toLowerCase();
    return email && !admins.includes(email) && !teachers.includes(email);
  });

  // Filtered lists based on search
  const filteredPending = pendingUsers.filter(u => 
    !searchQuery || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredTeachers = teachers.filter(email => 
    !searchQuery || email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAdmins = admins.filter(email => 
    !searchQuery || email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Giriş kaydı mevcut';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Role Assignment Handlers
  const handleGrantRole = async (userEmail: string, role: 'teacher' | 'admin', userName?: string) => {
    const cleanEmail = userEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    setIsProcessing(cleanEmail);
    try {
      await setUserAccountRole(cleanEmail, role);

      // Save user record with approved status
      const updatedList = registeredUsers.map(u => 
        u.email === cleanEmail 
          ? { ...u, role, status: 'approved' }
          : u
      );
      if (!updatedList.some(u => u.email === cleanEmail)) {
        updatedList.unshift({
          id: cleanEmail,
          email: cleanEmail,
          name: userName || cleanEmail.split('@')[0],
          role,
          status: 'approved',
          lastLoginAt: new Date().toISOString(),
          timestamp: new Date().toISOString()
        });
      }
      setRegisteredUsers(updatedList);
      try {
        localStorage.setItem(LOCAL_USERS_CACHE_KEY, JSON.stringify(updatedList));
      } catch {}

      const roleLabel = role === 'admin' ? 'İDARECİ (Yönetici)' : 'ÖĞRETMEN';
      showToast(`${userName || cleanEmail} için ${roleLabel} yetkisi başarıyla tanımlandı! Kullanıcının ekranı anında açılacaktır.`);
    } catch (err: any) {
      showToast(err?.message || 'Yetki verilirken bir hata oluştu.', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRevokeRole = async (email: string) => {
    if (isSuperAdmin(email)) {
      showToast('Süper admin yetkisi kaldırılamaz.', 'error');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    setIsProcessing(cleanEmail);
    try {
      await setUserAccountRole(cleanEmail, 'guest');
      showToast(`${cleanEmail} kullanıcısının yetkisi kaldırıldı (Misafir moduna alındı).`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'İşlem başarısız oldu.', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDeleteRequest = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      await deleteDoc(doc(db, 'access_requests', cleanEmail));
      setRegisteredUsers(prev => prev.filter(u => u.email !== cleanEmail));
      try {
        const cached = localStorage.getItem(LOCAL_USERS_CACHE_KEY);
        if (cached) {
          const list: RegisteredUserRecord[] = JSON.parse(cached);
          localStorage.setItem(LOCAL_USERS_CACHE_KEY, JSON.stringify(list.filter(u => u.email !== cleanEmail)));
        }
      } catch {}
      showToast(`${cleanEmail} kaydı listeden silindi.`, 'info');
    } catch (err: any) {
      showToast('Kayıt silinemedi.', 'error');
    }
  };

  const handleManualAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newTeacherEmail.trim().toLowerCase();
    if (cleanEmail && !teachers.includes(cleanEmail) && !admins.includes(cleanEmail)) {
      await handleGrantRole(cleanEmail, 'teacher');
      setNewTeacherEmail('');
    }
  };

  const handleManualAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newAdminEmail.trim().toLowerCase();
    if (cleanEmail && !admins.includes(cleanEmail)) {
      await handleGrantRole(cleanEmail, 'admin');
      setNewAdminEmail('');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden border border-[#e6e2d3] flex flex-col animate-slide-up sm:animate-none pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-[#e6e2d3] bg-[#fcfbf7] sticky top-0 z-20">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-700 shadow-sm border border-emerald-200/60 shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-serif font-bold text-[#5a5a40] truncate">Kullanıcı & Yetki Yönetimi</h2>
                {pendingUsers.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse shrink-0">
                    {pendingUsers.length} Bekleyen
                  </span>
                )}
              </div>
              <p className="text-[10.5px] sm:text-xs text-[#8e8d82] mt-0.5 truncate sm:whitespace-normal">
                Kayıtlı üyeleri görüntüleyin, tek tıkla Öğretmen veya İdareci yetkisi tanımlayın.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 text-[#8e8d82] hover:bg-[#e6e2d3] hover:text-[#5a5a40] rounded-full transition-colors cursor-pointer active:scale-95 shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div className={`mx-3 sm:mx-6 mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
            feedback.type === 'error' 
              ? 'bg-rose-50 border-rose-200 text-rose-800' 
              : feedback.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <Check className="w-4 h-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Search Bar & Quick Stats */}
        <div className="p-3 sm:px-6 sm:pt-4 sm:pb-3 bg-[#faf9f5] border-b border-[#e6e2d3] flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8e8d82] absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="İsim veya e-posta ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 sm:pl-9 pr-3 py-2 sm:py-2.5 bg-white border border-[#e6e2d3] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#B08D57] shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start sm:justify-end text-xs font-medium text-[#8e8d82]">
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 font-bold text-[10px] sm:text-xs">
              {pendingUsers.length} Bekleyen
            </span>
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 font-bold text-[10px] sm:text-xs">
              {teachers.length} Öğretmen
            </span>
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 font-bold text-[10px] sm:text-xs">
              {admins.length} İdareci
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">

          {/* SECTION 1: BEKLEYEN & YENİ KAYITLI KULLANICILAR */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-amber-300/80 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5">
              <div className="flex items-start gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-amber-950 uppercase tracking-wider">
                    Giriş Yapmış Yeni Kullanıcılar (Onay Bekleyenler)
                  </h3>
                  <p className="text-[10.5px] sm:text-xs text-amber-900/80">
                    Google ile kaydolan kullanıcılar. Tek tıkla yetkilendirin.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] sm:text-xs font-bold bg-amber-200 text-amber-900 shadow-2xs shrink-0 self-start sm:self-auto">
                {pendingUsers.length} Hesap
              </span>
            </div>

            {filteredPending.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {filteredPending.map((user) => {
                  const isCurProcessing = isProcessing === user.email;

                  return (
                    <div 
                      key={user.id || user.email}
                      className="p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-amber-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3.5 transition-all hover:border-amber-400"
                    >
                      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                        {user.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt={user.name || 'User'} 
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl object-cover border border-amber-300 shrink-0 shadow-2xs mt-0.5 sm:mt-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-xs sm:text-sm shrink-0 mt-0.5 sm:mt-0">
                            {user.name ? user.name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                          </div>
                        )}

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{user.name || 'Kullanıcı'}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300/80">
                              Misafir
                            </span>
                          </div>
                          <span className="text-[11px] sm:text-xs text-gray-500 font-mono truncate">{user.email}</span>
                          <span className="text-[10px] text-amber-800/70 flex items-center gap-1 mt-0.5 truncate">
                            <Calendar className="w-3 h-3 text-amber-600 shrink-0" />
                            Son Giriş: {formatDate(user.lastLoginAt || user.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons: Grant Teacher, Grant Admin, Delete */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => handleGrantRole(user.email, 'teacher', user.name)}
                          disabled={isCurProcessing}
                          className="flex-1 sm:flex-initial px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Öğretmen Yetkisi Ver"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Öğretmen Yap</span>
                        </button>

                        <button
                          onClick={() => handleGrantRole(user.email, 'admin', user.name)}
                          disabled={isCurProcessing}
                          className="flex-1 sm:flex-initial px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          title="İdareci Yetkisi Ver"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>İdareci Yap</span>
                        </button>

                        <button
                          onClick={() => handleDeleteRequest(user.email)}
                          disabled={isCurProcessing}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg sm:rounded-xl border border-rose-200 transition-colors cursor-pointer active:scale-95 shrink-0"
                          title="İsteği Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 sm:p-5 bg-white/80 rounded-xl border border-amber-200 text-center text-amber-900/80 text-[11px] sm:text-xs font-medium">
                {searchQuery ? 'Aramanıza uygun onay bekleyen kullanıcı bulunamadı.' : 'Onay bekleyen yeni bir kayıtlı kullanıcı bulunmuyor.'}
              </div>
            )}
          </div>

          <div className="h-px bg-[#e6e2d3] w-full"></div>

          {/* SECTION 2: YETKİLİ ÖĞRETMENLER */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" /> Yetkili Öğretmenler ({teachers.length})
              </h3>
              <span className="text-[10px] sm:text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 self-start sm:self-auto">
                Sonuçlar, Analiz & Arena Yetkisi
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[11px] text-[#8e8d82] mb-2.5">
              Öğretmenler; Sınav Sonuçları, Madde Analizi ve Akademi Arena sekmelerini kullanabilir.
            </p>

            <div className="space-y-1.5 sm:space-y-2 mb-2.5">
              {filteredTeachers.map(email => {
                const userObj = registeredUsers.find(u => u.email === email);
                return (
                  <div key={email} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 bg-blue-50/70 rounded-xl sm:rounded-2xl border border-blue-100 hover:border-blue-200 transition-colors gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 mr-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-600/10 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {userObj?.name ? userObj.name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-blue-950 truncate">
                          {userObj?.name || email.split('@')[0]}
                        </span>
                        <span className="text-[10.5px] sm:text-[11px] text-blue-700/80 font-mono truncate">{email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button 
                        onClick={() => handleGrantRole(email, 'admin', userObj?.name)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 text-[10.5px] sm:text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer active:scale-95"
                        title="İdareci Yetkisine Yükselt"
                      >
                        İdareci Yap
                      </button>
                      <button 
                        onClick={() => handleRevokeRole(email)} 
                        className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 active:scale-90 rounded-lg transition-all cursor-pointer"
                        title="Yetkiyi Kaldır"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredTeachers.length === 0 && (
                <p className="text-xs text-[#8e8d82] text-center py-3 bg-gray-50 rounded-xl border border-dashed border-[#e6e2d3]">
                  {searchQuery ? 'Aramanıza uygun öğretmen bulunamadı.' : 'Henüz yetkilendirilmiş öğretmen hesabı bulunmamaktadır.'}
                </p>
              )}
            </div>

            {/* Quick Add Teacher by Email */}
            <form onSubmit={handleManualAddTeacher} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                placeholder="Önceden Öğretmen E-postası Tanımla (@gmail.com)"
                value={newTeacherEmail}
                onChange={(e) => setNewTeacherEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-[#e6e2d3] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              <button 
                type="submit" 
                className="px-3.5 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs sm:text-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> Öğretmen Olarak Ekle
              </button>
            </form>
          </div>

          <div className="h-px bg-[#e6e2d3] w-full"></div>

          {/* SECTION 3: YETKİLİ İDARECİLER & YÖNETİCİLER */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" /> Yetkili İdareciler / Yöneticiler ({admins.length})
              </h3>
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 self-start sm:self-auto">
                Tam Sistem Yetkisi
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[11px] text-[#8e8d82] mb-2.5">
              İdareciler tüm okul modüllerini, sınavları, bütçeyi ve kütüğü yönetebilir.
            </p>

            <div className="space-y-1.5 sm:space-y-2 mb-2.5">
              {filteredAdmins.map(email => {
                const isSuper = isSuperAdmin(email);
                const userObj = registeredUsers.find(u => u.email === email);

                return (
                  <div key={email} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 bg-emerald-50/70 rounded-xl sm:rounded-2xl border border-emerald-100 hover:border-emerald-200 transition-colors gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 mr-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-600/10 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {userObj?.name ? userObj.name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-emerald-950 truncate">
                            {userObj?.name || email.split('@')[0]}
                          </span>
                          {isSuper && (
                            <span className="text-[9.5px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded-md border border-amber-300/70">
                              Süper Admin
                            </span>
                          )}
                        </div>
                        <span className="text-[10.5px] sm:text-[11px] text-emerald-700/80 font-mono truncate">{email}</span>
                      </div>
                    </div>

                    {!isSuper && (
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button 
                          onClick={() => handleGrantRole(email, 'teacher', userObj?.name)}
                          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 text-[10.5px] sm:text-[11px] font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer active:scale-95"
                          title="Öğretmen Yetkisine Dönüştür"
                        >
                          Öğretmen Yap
                        </button>
                        <button 
                          onClick={() => handleRevokeRole(email)} 
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 active:scale-90 rounded-lg transition-all cursor-pointer"
                          title="Yetkiyi Kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Add Admin by Email */}
            <form onSubmit={handleManualAddAdmin} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                placeholder="Önceden İdareci E-postası Tanımla (@gmail.com)"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-[#e6e2d3] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 shadow-2xs"
              />
              <button 
                type="submit" 
                className="px-3.5 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs sm:text-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> İdareci Olarak Ekle
              </button>
            </form>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-[#e6e2d3] bg-[#fcfbf7] flex items-center justify-between text-[11px] sm:text-xs text-[#8e8d82]">
          <span>Toplam {registeredUsers.length} Kayıtlı Kullanıcı</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 sm:px-5 sm:py-2 bg-[#B08D57] hover:bg-[#9a7b4a] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
