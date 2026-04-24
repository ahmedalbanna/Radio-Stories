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
  doc, 
  increment,
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Tale, TaleCategory } from './types';
import { VoiceRecorder } from './components/VoiceRecorder';
import { TaleCard } from './components/TaleCard';
import { transcribeAudio, categorizeTale } from './lib/gemini';
import { Radio, LogOut, User as UserIcon, Plus, X, ListFilter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [tales, setTales] = useState<Tale[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [filter, setFilter] = useState<TaleCategory | 'all'>('all');
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        // Ensure user doc exists
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
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
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

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  const handleLogout = () => signOut(auth);

  const handleRecordingComplete = async (blob: Blob) => {
    if (!user) return;
    setIsUploading(true);
    
    try {
      const filename = `tales/${user.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      // AI Processing
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const transcription = await transcribeAudio(base64data, 'audio/webm');
        const category = transcription ? await categorizeTale(transcription) : 'other';

        const path = 'tales';
        try {
          await addDoc(collection(db, path), {
            authorId: user.uid,
            authorName: user.displayName || 'مستخدم مجهول',
            audioUrl: url,
            duration: 0, // In a real app, calculate this
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

  const filteredTales = filter === 'all' ? tales : tales.filter(t => t.category === filter);

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
          <button onClick={handleLogout} className="p-2 hover:bg-stone/10 rounded-full text-stone transition-colors">
            <LogOut size={22} />
          </button>
          <div className="w-12 h-12 rounded-full border-2 border-olive p-0.5 shadow-md bg-white">
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
      <div className="w-full max-w-2xl px-6 pt-10 pb-4 flex justify-between items-end">
        <h2 className="serif text-4xl font-black text-olive">حكايات اليوم</h2>
        <span className="text-stone font-bold text-xs uppercase tracking-widest">مباشر • ريف اليمن</span>
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
      <main className="max-w-2xl mx-auto px-6 py-4 flex flex-col gap-6">
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
            className="fixed inset-0 z-50 bg-bone flex flex-col pt-12"
          >
            <div className="px-8 flex justify-end">
              <button onClick={() => setShowRecorder(false)} className="p-3 hover:bg-stone/10 rounded-full transition-colors">
                <X size={40} className="text-olive" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-10">
              <h1 className="serif text-5xl font-black mb-4 text-olive text-center">سجّل حكايتك الآن</h1>
              <p className="text-stone font-bold uppercase tracking-widest text-center mb-12">بث جديد من قلب اليمن...</p>
              
              <div className="yemeni-card p-4 bg-white/50 border-dashed border-2 border-border-warm mb-8">
                <VoiceRecorder 
                  onRecordingComplete={handleRecordingComplete} 
                  isUploading={isUploading} 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
