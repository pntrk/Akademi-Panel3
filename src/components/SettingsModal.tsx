import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Users, Trash2, Clock, Check, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { db, auth, collection, query, onSnapshot, deleteDoc, doc } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

export const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { state, updateUsers, userRole } = useAppContext();
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userRole === 'admin') {
      if (!auth.currentUser) {
        setRequests([]);
        return;
      }
      const q = query(collection(db, 'access_requests'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const reqs: any[] = [];
        snapshot.forEach(docSnap => {
          reqs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setRequests(reqs);
      }, (error) => {
        console.warn("Requests onSnapshot notice:", error?.message || error);
        if (error?.code === 'permission-denied') {
          handleFirestoreError(error, OperationType.GET, 'access_requests');
        }
      });
      return () => unsubscribe();
    }
  }, [isOpen, userRole]);

  if (!isOpen || userRole !== 'admin') return null;

  const admins = state.admins || [];
  const teachers = state.teachers || [];

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newTeacherEmail.trim().toLowerCase();
    if (cleanEmail && !teachers.includes(cleanEmail) && !admins.includes(cleanEmail)) {
      updateUsers(admins, [...teachers, cleanEmail]);
      setNewTeacherEmail('');
      deleteDoc(doc(db, 'access_requests', cleanEmail)).catch(() => {});
      showToast(`${cleanEmail} öğretmen olarak eklendi`);
    }
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newAdminEmail.trim().toLowerCase();
    if (cleanEmail && !admins.includes(cleanEmail)) {
      updateUsers([...admins, cleanEmail], teachers.filter(t => t !== cleanEmail));
      setNewAdminEmail('');
      deleteDoc(doc(db, 'access_requests', cleanEmail)).catch(() => {});
      showToast(`${cleanEmail} idareci olarak eklendi`);
    }
  };

  const handleAcceptRequest = (email: string, role: 'admin' | 'teacher') => {
    const cleanEmail = email.trim().toLowerCase();
    if (role === 'admin' && !admins.includes(cleanEmail)) {
      updateUsers([...admins, cleanEmail], teachers.filter(t => t !== cleanEmail));
      showToast(`${cleanEmail} idareci olarak yetkilendirildi`);
    } else if (role === 'teacher' && !teachers.includes(cleanEmail) && !admins.includes(cleanEmail)) {
      updateUsers(admins, [...teachers, cleanEmail]);
      showToast(`${cleanEmail} öğretmen olarak yetkilendirildi`);
    }
    deleteDoc(doc(db, 'access_requests', email)).catch(() => {});
  };

  const handleRejectRequest = (email: string) => {
    deleteDoc(doc(db, 'access_requests', email)).catch(() => {});
    showToast(`${email} isteği silindi`);
  };

  const handlePromoteTeacherToAdmin = (email: string) => {
    updateUsers([...admins, email], teachers.filter(t => t !== email));
    showToast(`${email} idareci yapıldı`);
  };

  const handleDemoteAdminToTeacher = (email: string) => {
    if (isSuperAdmin(email)) return;
    updateUsers(admins.filter(a => a !== email), [...teachers, email]);
    showToast(`${email} öğretmen olarak güncellendi`);
  };

  const handleRemoveTeacher = (email: string) => {
    updateUsers(admins, teachers.filter(t => t !== email));
    showToast(`${email} sistemden kaldırıldı`);
  };

  const isSuperAdmin = (email: string) => email === 'kirklareliataturkortaokulu@gmail.com' || email === 'bahadirkumcu@gmail.com';

  const handleRemoveAdmin = (email: string) => {
    if (isSuperAdmin(email)) return;
    updateUsers(admins.filter(a => a !== email), teachers);
    showToast(`${email} idareci yetkisi kaldırıldı`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all" onClick={onClose}>
      <div 
        className="bg-white rounded-t-[28px] sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto border border-[#e6e2d3] flex flex-col animate-slide-up sm:animate-none pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#e6e2d3] bg-[#fcfbf7] rounded-t-[28px] sm:rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-serif font-bold text-[#5a5a40]">Kullanıcı & Yetki Yönetimi</h2>
              <p className="text-[11px] text-[#8e8d82]">Öğretmen ve İdareci erişim izinlerini düzenleyin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#8e8d82] hover:bg-[#e6e2d3] rounded-full transition-colors active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1">
          
          {/* Pending Requests Section */}
          <div className="bg-amber-50/50 p-4 sm:p-5 rounded-2xl border border-amber-200/80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" /> Bekleyen Erişim İstekleri (Giriş Yapanlar)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-200/80 text-amber-900">
                {requests.length} İstek
              </span>
            </div>
            
            <p className="text-[11px] text-amber-800/80 mb-3 leading-relaxed">
              Google ile ilk defa giriş yapan kullanıcılar bu alana düşer. İlgili kullanıcıya rol atadığınızda ekranı anında yetkisine göre açılacaktır.
            </p>

            {requests.length > 0 ? (
              <div className="space-y-2.5">
                {requests.map(req => (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-sm gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 font-bold text-xs shrink-0">
                        {req.name ? req.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-[#5a5a40] truncate">{req.name}</span>
                        <span className="text-xs text-[#8e8d82] font-mono truncate">{req.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button 
                        onClick={() => handleAcceptRequest(req.email, 'teacher')} 
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer active:scale-95" 
                        title="Öğretmen Yetkisi Ver (Sadece Sınav Sonuçları ve Akademi Arena açılır)"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-600" /> Öğretmen Yap
                      </button>
                      <button 
                        onClick={() => handleAcceptRequest(req.email, 'admin')} 
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer active:scale-95" 
                        title="İdareci Yetkisi Ver (Tüm 6 modülü yönetebilir)"
                      >
                        <Shield className="w-3.5 h-3.5 text-emerald-600" /> İdareci Yap
                      </button>
                      <button 
                        onClick={() => handleRejectRequest(req.email)} 
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors cursor-pointer" 
                        title="İsteği Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-white/70 rounded-xl border border-amber-200/50 text-center text-amber-800/70 text-xs font-medium">
                Şu anda onay bekleyen yeni bir erişim isteği bulunmamaktadır.
              </div>
            )}
          </div>

          <div className="h-px bg-[#e6e2d3] w-full"></div>

          {/* Teachers Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Öğretmenler ({teachers.length})
              </h3>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Kısıtlı Menü: Sınav Sonuçları & Arena
              </span>
            </div>
            <p className="text-[11px] text-[#8e8d82] mb-3">
              Öğretmenler giriş yaptıklarında sadece <strong>Sınav Sonuçları</strong> ve <strong>Akademi Arena</strong> sekmelerini görüntüleyebilir; öğrenci kaydı, sınav oluşturma ve bütçe alanlarına erişemezler.
            </p>

            <form onSubmit={handleAddTeacher} className="flex flex-col sm:flex-row gap-2 mb-3">
              <input
                type="email"
                required
                placeholder="Yeni Öğretmen E-posta Adresi (@gmail.com)"
                value={newTeacherEmail}
                onChange={(e) => setNewTeacherEmail(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-white border border-[#e6e2d3] rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm cursor-pointer">
                <UserPlus className="w-4 h-4" /> Öğretmen Ekle
              </button>
            </form>

            <div className="space-y-2">
              {teachers.map(email => (
                <div key={email} className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-blue-900 truncate">{email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={() => handlePromoteTeacherToAdmin(email)}
                      className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors"
                      title="İdareci Yetkisine Yükselt"
                    >
                      İdareci Yap
                    </button>
                    <button 
                      onClick={() => handleRemoveTeacher(email)} 
                      className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 active:scale-90 rounded-lg transition-all"
                      title="Yetkiyi Kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {teachers.length === 0 && (
                <p className="text-xs text-[#8e8d82] text-center py-4 bg-gray-50 rounded-xl border border-dashed border-[#e6e2d3]">
                  Henüz kayıtlı öğretmen bulunmuyor.
                </p>
              )}
            </div>
          </div>

          <div className="h-px bg-[#e6e2d3] w-full"></div>

          {/* Admins Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" /> İdareciler ({admins.length})
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Tam Yetki: Tüm 6 Modül & Yönetim
              </span>
            </div>
            <p className="text-[11px] text-[#8e8d82] mb-3">
              İdareciler tüm modülleri yönetebilir, öğrenci/sınav ekleyebilir, bütçe yönetebilir ve kullanıcı yetkilerini düzenleyebilir.
            </p>

            <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-2 mb-3">
              <input
                type="email"
                required
                placeholder="Yeni İdareci E-posta Adresi (@gmail.com)"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-white border border-[#e6e2d3] rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button type="submit" className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm cursor-pointer">
                <UserPlus className="w-4 h-4" /> İdareci Ekle
              </button>
            </form>

            <div className="space-y-2">
              {admins.map(email => (
                <div key={email} className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-emerald-900 truncate">
                      {email} {isSuperAdmin(email) && <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded-md ml-1.5">Süper Admin</span>}
                    </span>
                  </div>
                  {!isSuperAdmin(email) && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => handleDemoteAdminToTeacher(email)}
                        className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 text-[11px] font-bold rounded-lg border border-blue-200 transition-colors"
                        title="Öğretmen Yetkisine Dönüştür"
                      >
                        Öğretmen Yap
                      </button>
                      <button 
                        onClick={() => handleRemoveAdmin(email)} 
                        className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 active:scale-90 rounded-lg transition-all"
                        title="Yetkiyi Kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
