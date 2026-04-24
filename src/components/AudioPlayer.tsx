import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  url: string;
  onEnded?: () => void;
}

const formatDuration = (s: number) => {
  if (isNaN(s)) return "0:00";
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, onEnded }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
      setCurrentTime(audio.currentTime);
    };

    const updateDuration = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      if (onEnded) onEnded();
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onEnded]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current && duration) {
      const newTime = (Number(e.target.value) / 100) * duration;
      audioRef.current.currentTime = newTime;
      setProgress(Number(e.target.value));
      setCurrentTime(newTime);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-3 bg-sand/50 p-2 rounded-2xl border border-border-warm/50">
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex-shrink-0 rounded-full bg-olive text-white flex items-center justify-center transition-colors hover:bg-olive/90 shadow-md"
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="translate-x-0.5" fill="currentColor" />}
        </button>
        
        <div className="flex flex-col flex-1 gap-1">
          <div className="flex justify-between items-center text-[10px] font-mono text-olive/60">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
          <div className="relative flex items-center h-4 group">
            <input 
              type="range"
              min="0"
              max="100"
              value={progress || 0}
              onChange={handleSeek}
              className="absolute w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full h-1.5 bg-olive/10 rounded-full overflow-hidden flex items-center">
              <div 
                className="h-full bg-olive transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Scrubber handle */}
            <div 
              className="absolute h-3 w-3 bg-olive rounded-full shadow-sm pointer-events-none group-hover:scale-125 transition-transform"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        <audio ref={audioRef} src={url} />
      </div>
    </div>
  );
};
