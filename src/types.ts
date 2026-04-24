export enum TaleCategory {
  MARKET = 'market',
  STORIES = 'stories',
  FARMING = 'farming',
  NEWS = 'news',
  ADVICE = 'advice',
  OTHER = 'other'
}

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  displayName: string;
  voiceAvatarUrl?: string;
  voiceBio?: string;
  createdAt: any;
}

export interface Tale {
  id: string;
  authorId: string;
  authorName: string;
  audioUrl: string;
  duration: number;
  transcription?: string;
  category: TaleCategory;
  region?: string;
  clapsCount: number;
  createdAt: any;
  isPublic: boolean;
}

export interface VoiceResponse {
  id: string;
  taleId: string;
  authorId: string;
  authorName: string;
  audioUrl: string;
  duration: number;
  createdAt: any;
}

export interface Report {
  id: string;
  taleId: string;
  reporterId: string;
  audioUrl: string;
  transcription: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: any;
}
