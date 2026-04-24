import { useEffect, useState } from 'react';
import { auth, db, storage, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  increment,
  serverTimestamp,
  getDoc,
  setDoc,
  where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Tale, TaleCategory, UserProfile, Report } from './types';
import { VoiceRecorder } from './components/VoiceRecorder';
import { TaleCard } from './components/TaleCard';
import { AudioPlayer } from './components/AudioPlayer';
import { transcribeAudio, categorizeTale, moderateContent } from './lib/gemini';
import { Radio, LogOut, User as UserIcon, Plus, X, Search, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tales, setTales] = useState<Tale[]>([]);
  const [filteredTales, setFilteredTales] = useState<Tale[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [filter, setFilter] = useState<TaleCategory | 'all'>('all');
  const [authReady, setAuthReady] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const isSheikh = user?.email === 'ahmedalbannatech@gmail.com';

  useEffect(() => {
    if (showAdmin && isSheikh) {
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      });
      return unsubscribe;
    }
  }, [showAdmin, isSheikh]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        const path = `users/${u.uid}`;
        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              displayName: u.displayName,
              phoneNumber: u.phoneNumber || '',
              createdAt: serverTimestamp(),
            });
            setUserProfile({ uid: u.uid, displayName: u.displayName || '', phoneNumber: '', createdAt: new Date() });
          } else {
            setUserProfile({ uid: u.uid, ...userSnap.data() } as UserProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
      } else {
        setUserProfile(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setTales([]);
      return;
    }

    const path = 'tales';
    const q = query(
      collection(db, path),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tale));
      setTales(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, [authReady, user]);

  useEffect(() => {
    let result = tales;
    if (filter !== 'all') {
      result = result.filter(t => t.category === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        (t.transcription && t.transcription.toLowerCase().includes(q)) ||
        (t.authorName && t.authorName.toLowerCase().includes(q))
      );
    }
    setFilteredTales(result);
  }, [tales, filter, searchQuery]);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  const handleLogout = () => signOut(auth);

  const handleRecordingComplete = async (blob: Blob, region?: string) => {
    if (!user) return;
    setIsUploading(true);
    
    try {
      const filename = `tales/${user.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const transcription = await transcribeAudio(base64data, 'audio/webm');
        const category = transcription ? await categorizeTale(transcription) : 'other';
        const isSafe = transcription ? !(await moderateContent(transcription)) : true;

        if (!isSafe) {
          alert('عفوا، هذا المحتوى يتعارض مع الآداب العامة ولن يتم نشره.');
          setIsUploading(false);
          setShowRecorder(false);
          return;
        }

        const path = 'tales';
        try {
          await addDoc(collection(db, path), {
            authorId: user.uid,
            authorName: user.displayName || 'مستخدم مجهول',
            audioUrl: url,
            duration: 0,
            region: region || '',
            transcription: transcription || 'لم يتم استخراج النص',
            category: category as TaleCategory,
            clapsCount: 0,
            createdAt: serverTimestamp(),
            isPublic: true
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
        
        setIsUploading(false);
        setShowRecorder(false);
      };

    } catch (err) {
      console.error("Upload error:", err);
      setIsUploading(false);
    }
  };

  const handleBioRecordingComplete = async (blob: Blob) => {
    if (!user) return;
    setIsUploading(true);
    
    try {
      const filename = `bios/${user.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const transcription = await transcribeAudio(base64data, 'audio/webm');

        const path = `users/${user.uid}`;
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            voiceAvatarUrl: url,
            voiceBio: transcription || 'تعريف صوتي'
          });
          setUserProfile(prev => prev ? { ...prev, voiceAvatarUrl: url, voiceBio: transcription || 'تعريف صوتي' } : null);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
        setIsUploading(false);
      };
    } catch (err) {
      console.error("Bio upload error:", err);
      setIsUploading(false);
    }
  };

  const handleClap = async (id: string) => {
    const path = `tales/${id}`;
    try {
      const taleRef = doc(db, 'tales', id);
      await updateDoc(taleRef, {
        clapsCount: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'dismissed' });
    } catch (error) {
      console.error(error);
      alert('حدث خطأ');
    }
  };

  const handleDeleteTaleFromReport = async (taleId: string, reportId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف الحكاية والموافقة على البلاغ؟')) return;
    try {
      await deleteDoc(doc(db, 'tales', taleId));
      await updateDoc(doc(db, 'reports', reportId), { status: 'reviewed' });
      alert('تم إزالة الحكاية بنجاح.');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء الحذف.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-sand">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-olive rounded-full flex items-center justify-center mx-auto mb-8 text-white shadow-2xl shadow-olive/30 border-4 border-white/20">
            <Radio size={48} strokeWidth={1.5} />
          </div>
          <h1 className="serif text-6xl font-black mb-4 text-olive">راديو الحكايات</h1>
          <p className="text-stone text-lg mb-10 leading-relaxed font-bold uppercase tracking-widest">
            شبكة الصوت اليمنية الأولى
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-clay text-white py-5 rounded-[40px] font-black text-2xl shadow-xl hover:bg-clay/90 transition-all active:scale-95 shadow-clay/20"
          >
            تحدث الآن
          </button>
          <p className="mt-8 text-xs text-stone font-black uppercase tracking-widest bg-white/50 py-2 rounded-full border border-border-warm">
            بدون قراءة أو كتابة • فقط صوتك
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 bg-sand flex flex-col items-center">
      {/* Header */}
      <header className="sticky top-0 w-full z-30 bg-bone/90 backdrop-blur-md border-b border-border-warm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-olive rounded-full flex items-center justify-center text-white shadow-lg">
            <Radio size={28} />
          </div>
          <div>
            <h1 className="serif text-2xl font-black text-olive">راديو الحكايات</h1>
            <p className="text-[10px] text-stone font-bold uppercase tracking-widest">شبكة الصوت اليمنية الأولى</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isSheikh && (
            <button 
              onClick={() => setShowAdmin(true)} 
              className="px-3 py-1.5 bg-yemen-red/10 text-yemen-red hover:bg-yemen-red hover:text-white rounded-full flex items-center gap-2 transition-colors font-bold text-xs"
            >
              <ShieldAlert size={16} /> 
              محكمة الراديو
            </button>
          )}
          <div 
            onClick={() => setShowProfile(true)}
            className="w-12 h-12 rounded-full border-2 border-olive p-0.5 shadow-md bg-white cursor-pointer hover:opacity-80 transition-opacity"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-sand flex items-center justify-center">
                <UserIcon className="text-olive" />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="w-full max-w-2xl px-6 pt-10 pb-4 flex flex-col gap-6">
        <div className="flex justify-between items-end">
          <h2 className="serif text-4xl font-black text-olive">حكايات اليوم</h2>
          <span className="text-stone font-bold text-xs uppercase tracking-widest">مباشر • ريف اليمن</span>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone/50" size={20} />
          <input 
            type="text" 
            placeholder="ابحث بالحروف في الحكايات الصوتية..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-border-warm rounded-full py-3 pr-12 pl-4 outline-none focus:border-clay font-bold text-olive placeholder:font-normal placeholder:text-stone/50"
          />
        </div>
      </div>

      {/* Categories Scroller */}
      <div className="w-full overflow-x-auto whitespace-nowrap px-6 py-6 flex gap-3 no-scrollbar scroll-smooth">
        <button 
          onClick={() => setFilter('all')}
          className={`category-pill ${filter === 'all' ? 'active' : ''}`}
        >
          كل الموجات
        </button>
        {Object.values(TaleCategory).map(cat => (
          <button 
            key={cat}
            onClick={() => setFilter(cat)}
            className={`category-pill ${filter === cat ? 'active' : ''}`}
          >
            {cat === TaleCategory.MARKET ? 'سوق الحراج' : 
             cat === TaleCategory.STORIES ? 'حكايات الطيبين' : 
             cat === TaleCategory.FARMING ? 'سوالف المزارع' : 
             cat === TaleCategory.NEWS ? 'موجز الأخبار' : 
             cat === TaleCategory.ADVICE ? 'نصائح وحكم' : 'حاجات ثانية'}
          </button>
        ))}
      </div>

      {/* Feed */}
      <main className="w-full max-w-2xl mx-auto px-6 py-4 flex flex-col gap-6">
        {filteredTales.length === 0 ? (
          <div className="text-center py-20 text-olive/40 italic">
            لا توجد حكايات في هذه الموجة بعد...
          </div>
        ) : (
          filteredTales.map(tale => (
            <TaleCard key={tale.id} tale={tale} onClap={handleClap} />
          ))
        )}
      </main>

      {/* Action Bar */}
      <div className="fixed bottom-10 left-0 w-full px-6 flex justify-center z-40 pointer-events-none">
        <div className="relative pointer-events-auto">
          <button 
            onClick={() => setShowRecorder(true)}
            className="w-20 h-20 bg-clay text-white rounded-[32px] shadow-2xl flex flex-col items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-clay/40 border-4 border-white/20"
          >
            <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center mb-1">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">تحدث</span>
          </button>
          <div className="absolute -top-3 -right-3 bg-white px-2 py-1 rounded-full shadow-md border border-border-warm text-[8px] font-black uppercase tracking-widest text-clay">
            بدون كتابة
          </div>
        </div>
      </div>

      {/* Recorder Overlay */}
      <AnimatePresence>
        {showRecorder && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50 bg-bone flex flex-col pt-12 overflow-y-auto"
          >
            <div className="px-8 flex justify-end shrink-0">
              <button onClick={() => setShowRecorder(false)} className="p-3 hover:bg-stone/10 rounded-full transition-colors">
                <X size={40} className="text-olive" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-10 pb-20">
              <h1 className="serif text-5xl font-black mb-4 text-olive text-center">سجّل حكايتك الآن</h1>
              <p className="text-stone font-bold uppercase tracking-widest text-center mb-12">بث جديد من قلب اليمن...</p>
              
              <div className="w-full max-w-sm rounded-[32px] bg-white border border-border-warm p-2 shadow-xl">
                <div className="border-dashed border-2 border-border-warm rounded-[28px]">
                  <VoiceRecorder 
                    onRecordingComplete={handleRecordingComplete} 
                    isUploading={isUploading} 
                    showRegionPicker
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Overlay */}
      <AnimatePresence>
        {showProfile && userProfile && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-0 z-50 bg-bone flex flex-col overflow-y-auto"
          >
            <header className="sticky top-0 bg-bone/90 backdrop-blur-md border-b border-border-warm px-6 py-4 flex items-center justify-between z-10 shrink-0">
              <h2 className="serif text-2xl font-black text-olive">حسابي</h2>
              <div className="flex items-center gap-2">
                <button onClick={handleLogout} className="p-2 hover:bg-stone/10 rounded-full text-yemen-red transition-colors font-bold flex gap-2 items-center text-sm">
                  تسجيل خروج
                </button>
                <button onClick={() => setShowProfile(false)} className="p-2 hover:bg-stone/10 rounded-full transition-colors">
                  <X size={28} className="text-olive" />
                </button>
              </div>
            </header>

            <div className="flex-1 p-6 max-w-2xl w-full mx-auto flex flex-col gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full border-4 border-olive p-1 shadow-xl bg-white mb-4">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-sand flex items-center justify-center">
                      <UserIcon size={48} className="text-olive" />
                    </div>
                  )}
                </div>
                <h3 className="serif text-3xl font-black text-olive mb-2">{user.displayName}</h3>
                
                <div className="bg-sand p-6 rounded-[32px] w-full mt-6 border border-border-warm">
                  <h4 className="font-bold text-stone uppercase tracking-widest text-xs mb-4">بطاقتك الصوتية (تعريفك)</h4>
                  {userProfile.voiceAvatarUrl ? (
                    <div className="flex flex-col gap-4">
                      <div className="p-4 bg-white rounded-2xl italic font-serif text-olive/80 border-r-4 border-clay">
                        {userProfile.voiceBio}
                      </div>
                      <AudioPlayer url={userProfile.voiceAvatarUrl} />
                      <button 
                        onClick={() => setUserProfile({...userProfile, voiceAvatarUrl: undefined})}
                        className="text-xs font-bold text-yemen-red mt-2 self-start underline"
                      >
                        إعادة تسجيل صوتي
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center bg-white p-6 rounded-2xl border-2 border-dashed border-border-warm">
                      <p className="text-olive font-bold mb-4">لم تسجل تعريفاً بصوتك بعد</p>
                      <VoiceRecorder onRecordingComplete={handleBioRecordingComplete} isUploading={isUploading} compact />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-stone uppercase tracking-widest text-sm mb-4 border-b border-border-warm pb-2">حكاياتي التي سجلتها</h4>
                <div className="flex flex-col gap-4">
                  {tales.filter(t => t.authorId === user.uid).length === 0 ? (
                    <p className="text-stone italic">لم تسجل أي حكاية بعد...</p>
                  ) : (
                    tales.filter(t => t.authorId === user.uid).map(tale => (
                      <TaleCard key={tale.id} tale={tale} onClap={handleClap} />
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel Overlay */}
      <AnimatePresence>
        {showAdmin && isSheikh && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 bg-bone flex flex-col overflow-y-auto"
          >
            <header className="sticky top-0 bg-bone/90 backdrop-blur-md border-b border-border-warm px-6 py-4 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-3 text-yemen-red">
                <ShieldAlert size={28} />
                <h2 className="serif text-2xl font-black">محكمة الراديو (خاص بالشيوخ)</h2>
              </div>
              <button onClick={() => setShowAdmin(false)} className="p-2 hover:bg-stone/10 rounded-full transition-colors">
                <X size={28} className="text-olive" />
              </button>
            </header>
            
            <div className="p-6 max-w-3xl w-full mx-auto flex flex-col gap-6">
              <h3 className="font-bold text-stone text-sm uppercase tracking-widest border-b border-border-warm pb-2">البلاغات المعلقة</h3>
              {reports.filter(r => r.status === 'pending').length === 0 ? (
                <p className="text-stone italic text-center py-10">لا توجد بلاغات معلقة. الراديو نظيف!</p>
              ) : (
                reports.filter(r => r.status === 'pending').map(report => (
                  <div key={report.id} className="bg-white p-6 rounded-2xl border-2 border-border-warm shadow-md flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-yemen-red">بلاغ عن حكاية</span>
                      <span className="text-[10px] text-stone font-mono">
                        {report.createdAt ? new Date(report.createdAt.toDate()).toLocaleString() : ''}
                      </span>
                    </div>
                    
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-xs font-bold text-yemen-red mb-2">تسجيل الشكوى:</p>
                      <AudioPlayer url={report.audioUrl} />
                    </div>

                    <div className="flex gap-4 border-t border-border-warm pt-4">
                      <button 
                        onClick={() => handleDeleteTaleFromReport(report.taleId, report.id)}
                        className="flex-1 bg-yemen-red text-white py-2 rounded-xl font-bold hover:bg-red-700 transition-colors"
                      >
                        حذف الحكاية المخالفة
                      </button>
                      <button 
                        onClick={() => handleDismissReport(report.id)}
                        className="flex-1 bg-sand text-olive py-2 rounded-xl font-bold hover:bg-sand/80 transition-colors"
                      >
                        تجاهل البلاغ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
