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
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#e6e2d3] bg-[#fcfbf7] sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-700 shadow-sm border border-emerald-200/60 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-serif font-bold text-[#5a5a40]">Kullanıcı & Yetki Yönetimi</h2>
                {pendingUsers.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                    {pendingUsers.length} Bekleyen
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8e8d82] mt-0.5">
                Uygulamaya giriş yapmış tüm kayıtlı üyeleri görüntüleyin, tek tıkla Öğretmen veya İdareci yetkisi tanımlayın.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-[#8e8d82] hover:bg-[#e6e2d3] hover:text-[#5a5a40] rounded-full transition-colors cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
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
        <div className="p-4 sm:px-6 sm:pt-4 sm:pb-2 bg-[#faf9f5] border-b border-[#e6e2d3] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#8e8d82] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="İsim veya e-posta ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-[#e6e2d3] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57]"
            />
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end text-xs font-medium text-[#8e8d82]">
            <span className="px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 font-bold">
              {pendingUsers.length} Onay Bekleyen
            </span>
            <span className="px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 font-bold">
              {teachers.length} Öğretmen
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 font-bold">
              {admins.length} İdareci
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">

          {/* SECTION 1: BEKLEYEN & YENİ KAYITLI KULLANICILAR */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 rounded-2xl border-2 border-amber-300/80 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wider">
                    Giriş Yapmış Yeni Kayıtlı Kullanıcılar (Onay Bekleyenler)
                  </h3>
                  <p className="text-xs text-amber-900/80">
                    Google ile uygulamaya giriş yapmış veya kaydolmuş kullanıcılar aşağıda listelenmektedir. Tek tıkla yetki atayabilirsiniz.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900 shadow-xs shrink-0">
                {pendingUsers.length} Hesap
              </span>
            </div>

            {filteredPending.length > 0 ? (
              <div className="space-y-3">
                {filteredPending.map((user) => {
                  const isCurProcessing = isProcessing === user.email;

                  return (
                    <div 
                      key={user.id || user.email}
                      className="p-4 bg-white rounded-2xl border border-amber-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all hover:border-amber-400"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {user.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt={user.name || 'User'} 
                            className="w-10 h-10 rounded-2xl object-cover border border-amber-300 shrink-0 shadow-xs"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-sm shrink-0">
                            {user.name ? user.name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                          </div>
                        )}

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900 truncate">{user.name || 'Kullanıcı'}</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300/80">
                              Kayıtlı Misafir
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 font-mono truncate">{user.email}</span>
                          <span className="text-[11px] text-amber-800/70 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-amber-600" />
                            Son Giriş / Kayıt: {formatDate(user.lastLoginAt || user.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons: Grant Teacher, Grant Admin, Delete */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          onClick={() => handleGrantRole(user.email, 'teacher', user.name)}
                          disabled={isCurProcessing}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="Öğretmen Yetkisi Ver (Sınav Sonuçları, Analiz ve Akademi Arena açılır)"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Öğretmen Yetkisi Ver</span>
                        </button>

                        <button
                          onClick={() => handleGrantRole(user.email, 'admin', user.name)}
                          disabled={isCurProcessing}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="İdareci Yetkisi Ver (Tüm sisteme tam erişim)"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>İdareci Yetkisi Ver</span>
                        </button>

                        <button
                          onClick={() => handleDeleteRequest(user.email)}
                          disabled={isCurProcessing}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                          title="İsteği / Kaydı Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 bg-white/80 rounded-xl border border-amber-200 text-center text-amber-900/80 text-xs font-medium">
                {searchQuery ? 'Aramanıza uygun onay bekleyen kullanıcı bulunamadı.' : 'Şu anda onay bekleyen yeni bir kayıtlı kullanıcı bulunmuyor. Yeni bir kullanıcı Google ile giriş yaptığında anında bu alana eklenecektir.'}
              </div>
            )}
          </div>

          <div className="h-px bg-[#e6e2d3] w-full"></div>

          {/* SECTION 2: YETKİLİ ÖĞRETMENLER */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Yetkili Öğretmenler ({teachers.length})
              </h3>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                Sonuçlar, Analiz & Arena Yetkisi
              </span>
            </div>
            <p className="text-[11px] text-[#8e8d82] mb-3">
              Öğretmenler giriş yaptıklarında Nasıl Çalışır rehberini, Profil ayarlarını, Sınav Sonuçlarını, Sonuçlar Analizini ve Akademi Arena sekmelerini kullanabilir.
            </p>

            <div className="space-y-2 mb-3">
              {filteredTeachers.map(email => {
                const userObj = registeredUsers.find(u => u.email === email);
                return (
                  <div key={email} className="flex items-center justify-between p-3 bg-blue-50/70 rounded-2xl border border-blue-100 hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 mr-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {userObj?.name ? userObj.name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-blue-950 truncate">
                          {userObj?.name || email.split('@')[0]}
                        </span>
                        <span className="text-[11px] text-blue-700/80 font-mono truncate">{email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => handleGrantRole(email, 'admin', userObj?.name)}
                        className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                        title="İdareci Yetkisine Yükselt"
                      >
                        İdareci Yap
                      </button>
                      <button 
                        onClick={() => handleRevokeRole(email)} 
                        className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 active:scale-90 rounded-lg transition-all cursor-pointer"
                        title="Yetkiyi Kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredTeachers.length === 0 && (
                <p className="text-xs text-[#8e8d82] text-center py-4 bg-gray-50 rounded-xl border border-dashed border-[#e6e2d3]">
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
                className="flex-1 px-3.5 py-2 bg-white border border-[#e6e2d3] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button 
                type="submit" 
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs sm:text-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Öğretmen Olarak Ekle
              </button>
            </form>
          </div>

          <div className="h-px bg-[#e6e2d3] w-full"></div>

          {/* SECTION 3: YETKİLİ İDARECİLER & YÖNETİCİLER */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" /> Yetkili İdareciler / Yöneticiler ({admins.length})
              </h3>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                Tam Sistem Yetkisi
              </span>
            </div>
            <p className="text-[11px] text-[#8e8d82] mb-3">
              İdareciler tüm okul modüllerini yönetebilir, öğrenci/sınav ekleyebilir, bütçe yönetebilir ve kullanıcı yetkilerini düzenleyebilir.
            </p>

            <div className="space-y-2 mb-3">
              {filteredAdmins.map(email => {
                const isSuper = isSuperAdmin(email);
                const userObj = registeredUsers.find(u => u.email === email);

                return (
                  <div key={email} className="flex items-center justify-between p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100 hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 mr-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {userObj?.name ? userObj.name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-emerald-950 truncate">
                            {userObj?.name || email.split('@')[0]}
                          </span>
                          {isSuper && (
                            <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-md border border-amber-300/70">
                              Süper Admin
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-emerald-700/80 font-mono truncate">{email}</span>
                      </div>
                    </div>

                    {!isSuper && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                          onClick={() => handleGrantRole(email, 'teacher', userObj?.name)}
                          className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 text-[11px] font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer"
                          title="Öğretmen Yetkisine Dönüştür"
                        >
                          Öğretmen Yap
                        </button>
                        <button 
                          onClick={() => handleRevokeRole(email)} 
                          className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 active:scale-90 rounded-lg transition-all cursor-pointer"
                          title="Yetkiyi Kaldır"
                        >
                          <Trash2 className="w-4 h-4" />
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
                className="flex-1 px-3.5 py-2 bg-white border border-[#e6e2d3] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button 
                type="submit" 
                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs sm:text-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> İdareci Olarak Ekle
              </button>
            </form>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#e6e2d3] bg-[#fcfbf7] flex items-center justify-between text-xs text-[#8e8d82]">
          <span>Toplam {registeredUsers.length} Kayıtlı Kullanıcı Hesabı</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#B08D57] hover:bg-[#9a7b4a] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
