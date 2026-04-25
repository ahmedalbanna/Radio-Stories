import React, { useState, useEffect } from 'react';
import { Tale, TaleCategory, VoiceResponse, UserProfile } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { Share2, MapPin, Tag, Flag, ChevronDown, ChevronUp, Bookmark, BookmarkCheck, UserPlus, UserMinus, Ban, PlayCircle, PauseCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { VoiceRecorder } from './VoiceRecorder';

interface TaleCardProps {
  tale: Tale;
  onClap: (id: string) => void;
  currentUserId?: string;
  isSaved?: boolean;
  isFollowed?: boolean;
}

const categoryIcons: Record<TaleCategory, string> = {
  [TaleCategory.MARKET]: '🏪',
  [TaleCategory.STORIES]: '📖',
  [TaleCategory.FARMING]: '🌱',
  [TaleCategory.NEWS]: '📻',
  [TaleCategory.ADVICE]: '💡',
  [TaleCategory.OTHER]: '🌑'
};

export const TaleCard: React.FC<TaleCardProps> = ({ tale, onClap, currentUserId, isSaved, isFollowed }) => {
  const [showReplies, setShowReplies] = useState(false);
  const [responses, setResponses] = useState<VoiceResponse[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [isUploadingReply, setIsUploadingReply] = useState(false);

  const [isReporting, setIsReporting] = useState(false);
  const [isUploadingReport, setIsUploadingReport] = useState(false);

  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);
  const [isPlayingAvatar, setIsPlayingAvatar] = useState(false);
  const [audio] = useState(new Audio());

  useEffect(() => {
    // Fetch author's voice avatar
    const fetchAuthorAvatar = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', tale.authorId));
        if (userDoc.exists() && userDoc.data().voiceAvatarUrl) {
          setAuthorAvatarUrl(userDoc.data().voiceAvatarUrl);
        }
      } catch (e) {
        console.error("Could not fetch author profile:", e);
      }
    };
    fetchAuthorAvatar();
  }, [tale.authorId]);

  useEffect(() => {
    if (authorAvatarUrl) {
      audio.src = authorAvatarUrl;
      audio.onended = () => setIsPlayingAvatar(false);
    }
  }, [authorAvatarUrl, audio]);

  const toggleAvatarPlay = () => {
    if (isPlayingAvatar) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlayingAvatar(!isPlayingAvatar);
  };

  useEffect(() => {
    if (!showReplies) return;
    const path = `tales/${tale.id}/responses`;
    const q = query(collection(db, path), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResponses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VoiceResponse)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, [showReplies, tale.id]);

  const handleShare = () => {
    const text = encodeURIComponent(`اسمع هذه الحكاية من ${tale.authorName} على راديو الحكايات\n\n"${tale.transcription}"\n\nاستمع من هنا: ${window.location.origin}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleSaveToggle = async () => {
    if (!currentUserId) return;
    try {
      const docRef = doc(db, `users/${currentUserId}/saves`, tale.id);
      if (isSaved) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, { savedAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("Save error: ", err);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUserId || currentUserId === tale.authorId) return;
    try {
      const docRef = doc(db, `users/${currentUserId}/follows`, tale.authorId);
      if (isFollowed) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, { createdAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("Follow error: ", err);
    }
  };

  const handleBlockUser = async () => {
    if (!currentUserId || currentUserId === tale.authorId) return;
    if (!window.confirm(`هل أنت متأكد من حظر المستخدم ${tale.authorName}؟ لن ترى حكاياته بعد الآن.`)) return;
    try {
      const docRef = doc(db, `users/${currentUserId}/blocks`, tale.authorId);
      await setDoc(docRef, { createdAt: serverTimestamp() });
      alert('تم الحظر بنجاح.');
    } catch (err) {
      console.error("Block error: ", err);
    }
  };

  const handleReportComplete = async (blob: Blob) => {
    if (!auth.currentUser) return;
    setIsUploadingReport(true);
    
    try {
      const filename = `reports/${tale.id}_${auth.currentUser.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      const path = 'reports';
      await addDoc(collection(db, path), {
        taleId: tale.id,
        reporterId: auth.currentUser.uid,
        audioUrl: url,
        transcription: "بلاغ صوتي", // Simplified for now, real app should transcribe
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      
      setIsUploadingReport(false);
      setIsReporting(false);
      alert('تم إرسال بلاغك الصوتي بنجاح لمراجعته من شيوخ الراديو.');
    } catch (err) {
      console.error(err);
      setIsUploadingReport(false);
      alert('حدث خطأ أثناء رفع البلاغ.');
    }
  };

  const handleReplyComplete = async (blob: Blob) => {
    if (!auth.currentUser) return;
    setIsUploadingReply(true);
    
    try {
      const filename = `responses/${tale.id}_${auth.currentUser.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      const path = `tales/${tale.id}/responses`;
      await addDoc(collection(db, path), {
        taleId: tale.id,
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'مستخدم مجهول',
        audioUrl: url,
        duration: 0,
        createdAt: serverTimestamp()
      });
      
      setIsUploadingReply(false);
      setIsReplying(false);
    } catch (err) {
      console.error(err);
      setIsUploadingReply(false);
      alert('حدث خطأ أثناء الرفع.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="yemeni-card p-6 flex flex-col gap-5 bg-white border-border-warm"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-sand flex-shrink-0 flex items-center justify-center text-3xl border-2 border-olive shadow-inner">
            {categoryIcons[tale.category]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-olive leading-tight">{tale.authorName}</h3>
              {authorAvatarUrl && (
                <button 
                  onClick={toggleAvatarPlay}
                  className="text-clay hover:opacity-80 transition-opacity"
                  title="الاستماع للتعريف الصوتي"
                >
                  {isPlayingAvatar ? <PauseCircle size={18} fill="currentColor" className="text-white" /> : <PlayCircle size={18} />}
                </button>
              )}
              {currentUserId && currentUserId !== tale.authorId && (
                <button 
                  onClick={handleFollowToggle}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-colors ${
                    isFollowed ? 'bg-olive text-white hover:bg-olive/80' : 'bg-sand text-olive hover:bg-stone/20'
                  }`}
                  title={isFollowed ? "إلغاء المتابعة" : "متابعة"}
                >
                  {isFollowed ? <UserMinus size={12} /> : <UserPlus size={12} />}
                  {isFollowed ? "متابع" : "متابعة"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-stone font-bold uppercase tracking-wider mt-1">
              <span className="flex items-center gap-1 bg-sand px-2 py-0.5 rounded-full">
                <Tag size={10} /> {tale.category}
              </span>
              {tale.region && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} /> {tale.region}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="bg-sand text-stone px-3 py-1 rounded-full text-[10px] font-bold mt-1">
            {tale.createdAt ? new Date(tale.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'الآن'}
          </span>
          <div className="flex items-center gap-1">
            {currentUserId && currentUserId !== tale.authorId && (
              <button onClick={handleBlockUser} className="text-stone/50 hover:text-stone transition-colors p-1" title="حظر المستخدم">
                <Ban size={14} />
              </button>
            )}
            <button onClick={() => setIsReporting(!isReporting)} className="text-stone hover:text-yemen-red transition-colors p-1" title="إبلاغ">
              <Flag size={14} />
            </button>
            {currentUserId && (
              <button 
                onClick={handleSaveToggle} 
                className={`p-1 transition-colors ${isSaved ? 'text-olive' : 'text-stone hover:text-olive'}`} 
                title={isSaved ? "إلغاء الحفظ" : "حفظ الحكاية"}
              >
                {isSaved ? <BookmarkCheck size={16} fill="currentColor" /> : <Bookmark size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-sand/30 rounded-2xl p-5 serif italic text-olive/80 border-r-4 border-clay/30 text-lg">
        {tale.transcription || "جاري معالجة الصوت..."}
      </div>

      <AnimatePresence>
        {isReporting && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 p-4 rounded-2xl border-l-4 border-yemen-red overflow-hidden flex flex-col items-center"
          >
            <p className="text-xs font-bold text-yemen-red mb-2 uppercase tracking-widest leading-relaxed text-center">
              سجل بصوتك سبب اعتراضك على هذه الحكاية، وسيراجعها شيوخ الراديو:
            </p>
            <VoiceRecorder onRecordingComplete={handleReportComplete} isUploading={isUploadingReport} compact />
            <button 
              onClick={() => setIsReporting(false)}
              className="mt-3 text-[10px] font-bold text-stone hover:underline"
            >
              إلغاء البلاغ
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AudioPlayer url={tale.audioUrl} />

      <div className="flex items-center justify-between mt-2 pt-4 border-t border-border-warm">
        <button 
          onClick={() => onClap(tale.id)}
          className="flex items-center gap-2 text-clay font-black hover:scale-105 transition-transform"
        >
          <div className="text-xl">👏</div>
          <span className="font-mono text-sm">{tale.clapsCount || 0} تصفيق</span>
        </button>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full hover:bg-sand text-olive font-bold text-sm transition-colors"
          >
            <span>💬</span> 
            <span>ردود</span>
            {showReplies ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={handleShare} className="p-2 rounded-full hover:bg-sand text-stone transition-colors">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showReplies && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-border-warm/50 flex flex-col gap-4">
              {responses.map(res => (
                <div key={res.id} className="bg-sand/30 p-4 rounded-2xl pr-6 border-r-2 border-olive/20 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-olive">{res.authorName}</span>
                    <span className="text-[10px] text-stone font-mono">
                      {res.createdAt ? new Date(res.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <AudioPlayer url={res.audioUrl} />
                </div>
              ))}

              {isReplying ? (
                <div className="bg-sand p-4 rounded-2xl flex flex-col items-center">
                  <p className="text-xs font-bold text-stone mb-4 uppercase tracking-widest">تحدث بردك الآن</p>
                  <VoiceRecorder onRecordingComplete={handleReplyComplete} isUploading={isUploadingReply} compact />
                  <button 
                    onClick={() => setIsReplying(false)}
                    className="mt-4 text-xs font-bold text-yemen-red hover:underline"
                  >
                    إلغاء التحدث
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsReplying(true)}
                  className="bg-sand text-olive py-3 rounded-2xl font-bold hover:bg-sand/80 transition-colors flex items-center justify-center gap-2"
                >
                  <span>🎤</span> أضف ردك الصوتي
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
