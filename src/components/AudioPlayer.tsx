import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, FastForward } from 'lucide-react';

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
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (!isDragging) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
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
  }, [onEnded, isDragging]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateSeek(e);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging) return;
    updateSeek(e as any);
  }, [isDragging, duration]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    updateSeek(e as any, true);
  }, [isDragging, duration]);

  const updateSeek = (e: React.PointerEvent<HTMLDivElement> | PointerEvent, finalCommit = false) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = parseFloat(((x / rect.width) * 100).toFixed(2));
    const newTime = (percent / 100) * duration;
    
    setProgress(percent);
    setCurrentTime(newTime);
    
    if (finalCommit && audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    } else {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const toggleSpeed = () => {
    setPlaybackRate(prev => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      return 1;
    });
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
        
        <div className="flex flex-col flex-1 gap-1 select-none touch-none">
          <div className="flex justify-between items-center text-[10px] font-mono text-olive/60">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
          <div 
            className="relative flex items-center h-4 group cursor-pointer"
            ref={progressBarRef}
            onPointerDown={handlePointerDown}
          >
            <div className="w-full h-1.5 bg-olive/10 rounded-full overflow-hidden flex items-center">
              <div 
                className={`h-full bg-olive ${isDragging ? '' : 'transition-all duration-100 ease-linear'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Scrubber handle */}
            <div 
              className="absolute h-3 w-3 bg-olive rounded-full shadow-sm group-hover:scale-125 transition-transform"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        <button 
          onClick={toggleSpeed}
          className="w-8 h-8 flex-shrink-0 rounded-full bg-black/5 text-olive flex items-center justify-center text-[10px] font-bold font-mono transition-colors hover:bg-black/10"
          title="Playback Speed"
        >
          {playbackRate}x
        </button>

        <audio ref={audioRef} src={url} />
      </div>
    </div>
  );
};
