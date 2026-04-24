import React from 'react';
import { Tale, TaleCategory } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { Heart, MessageCircle, Share2, MapPin, Tag } from 'lucide-react';
import { motion } from 'motion/react';

interface TaleCardProps {
  tale: Tale;
  onClap: (id: string) => void;
}

const categoryIcons: Record<TaleCategory, string> = {
  [TaleCategory.MARKET]: '🏪',
  [TaleCategory.STORIES]: '📖',
  [TaleCategory.FARMING]: '🌱',
  [TaleCategory.NEWS]: '📻',
  [TaleCategory.ADVICE]: '💡',
  [TaleCategory.OTHER]: '🌑'
};

export const TaleCard: React.FC<TaleCardProps> = ({ tale, onClap }) => {
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
            <h3 className="text-xl font-black text-olive leading-tight">{tale.authorName}</h3>
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
        <span className="bg-sand text-stone px-3 py-1 rounded-full text-[10px] font-bold">
          {new Date(tale.createdAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="bg-sand/30 rounded-2xl p-5 serif italic text-olive/80 border-r-4 border-clay/30 text-lg">
        {tale.transcription || "جاري معالجة الصوت..."}
      </div>

      <AudioPlayer url={tale.audioUrl} />

      <div className="flex items-center justify-between mt-2 pt-4 border-t border-border-warm">
        <button 
          onClick={() => onClap(tale.id)}
          className="flex items-center gap-2 text-clay font-black hover:scale-105 transition-transform"
        >
          <div className="text-xl">👏</div>
          <span className="font-mono text-sm">{tale.clapsCount} تصفيق</span>
        </button>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-full hover:bg-sand text-olive font-bold text-sm transition-colors">
            <span>💬</span> 
            <span>رد صوتي</span>
          </button>
          <button className="p-2 rounded-full hover:bg-sand text-stone transition-colors">
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
