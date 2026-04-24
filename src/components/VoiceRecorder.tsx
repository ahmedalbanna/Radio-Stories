import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, region?: string) => void;
  isUploading?: boolean;
  showRegionPicker?: boolean;
  compact?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete, isUploading, showRegionPicker = false, compact = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [selectedRegion, setSelectedRegion] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob, selectedRegion);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("يرجى السماح بالوصول إلى الميكروفون لبدء التسجيل.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {isRecording && (
          <span className="text-clay font-mono font-bold">{formatDuration(duration)}</span>
        )}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${isRecording ? 'bg-clay animate-pulse' : 'bg-olive'} ${isUploading ? 'opacity-50' : ''}`}
        >
          {isUploading ? <Loader2 className="animate-spin" size={20} /> : isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8 w-full max-w-sm mx-auto">
      {showRegionPicker && !isRecording && !isUploading && (
        <select 
          value={selectedRegion} 
          onChange={e => setSelectedRegion(e.target.value)}
          className="w-full text-center bg-sand border-2 border-border-warm rounded-full py-2 px-4 text-olive font-bold outline-none focus:border-clay transition-colors"
        >
          <option value="">أين موقعك؟ (اختياري)</option>
          <option value="صنعاء">صنعاء</option>
          <option value="عدن">عدن</option>
          <option value="تعز">تعز</option>
          <option value="حضرموت">حضرموت</option>
          <option value="الحديدة">الحديدة</option>
          <option value="إب">إب</option>
          <option value="أخرى">أخرى</option>
        </select>
      )}

      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="text-4xl font-mono text-clay font-black"
          >
            {formatDuration(duration)}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
          className={`mic-button ${isRecording ? 'recording' : ''} ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isUploading ? (
            <Loader2 className="animate-spin" size={40} />
          ) : isRecording ? (
            <Square size={40} fill="currentColor" />
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full border-4 border-white/30 flex items-center justify-center mb-2">
                <div className="w-6 h-6 bg-white rounded-full"></div>
              </div>
              <span className="text-sm font-bold uppercase tracking-wider">تحدث الآن</span>
            </div>
          )}
        </button>
        
        {!isRecording && !isUploading && (
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.1, 0.2] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-clay rounded-[40px] -z-10"
          />
        )}
      </div>

      <p className="text-stone font-bold uppercase tracking-widest text-center text-xs">
        {isUploading ? "جاري الرفع..." : isRecording ? "اضغط للتوقف" : "بدون كتابة"}
      </p>
    </div>
  );
};
