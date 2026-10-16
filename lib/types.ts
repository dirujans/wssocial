export type Channel = 'TikTok' | 'Instagram' | 'Facebook' | 'LinkedIn' | 'X';
export const CHANNELS: Channel[] = ['TikTok', 'Instagram', 'Facebook', 'LinkedIn', 'X'];

export const NETWORK_TO_CHANNEL: Record<string, Channel> = {
  tiktok: 'TikTok',
  fb_instagram_account: 'Instagram',
  facebook: 'Facebook',
  linkedin_company: 'LinkedIn',
  twitter: 'X',
  TIKTOK: 'TikTok',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  TWITTER: 'X',
};

/** One channel, one day (Sprout via Windsor). */
export interface ProfileDay {
  date: string; // YYYY-MM-DD
  channel: Channel;
  impressions: number | null;
  engagements: number | null;
  followers: number | null;
  posts_sent: number | null;
}

/** One owned post with lifetime metrics (Sprout via Windsor). */
export interface Post {
  post_guid: string;
  posted: string; // YYYY-MM-DD
  posted_at: string; // ISO
  channel: Channel;
  format: 'Story' | 'Reel' | 'Video' | 'Ad' | 'Post';
  text: string;
  link: string;
  impressions: number | null;
  views: number | null;
  likes: number;
  comments: number | null;
  shares: number;
  saves: number;
  engagements: number;
  engagement_rate: number | null;
  comment_key: string; // matches Comment.post_key
}

export type Theme = 'Pushback' | "Where's ours?" | 'Wants in' | 'Love' | 'Tagging a friend' | 'Other';
export const THEMES: Theme[] = ['Pushback', "Where's ours?", 'Wants in', 'Love', 'Tagging a friend', 'Other'];

export interface Comment {
  comment_id: string;
  platform: 'Instagram' | 'Instagram IE' | 'TikTok';
  text: string;
  likes: number;
  replies: number | null;
  author: string | null;
  commented_at: string | null; // ISO, Instagram only
  post_date: string; // date the post went out
  post_key: string;
  post_link: string | null;
  theme: Theme;
}

export interface Alert {
  id: string; // dedupe key
  kind: 'spike' | 'drop' | 'loud_comment' | 'pushback';
  severity: 'info' | 'warn' | 'critical';
  title: string;
  detail: string;
  link: string | null;
  created_at?: string;
}
