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
  reach?: number | null;
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

/** One Instagram or TikTok post from the native connectors (media, saves, reposts, watch-through). */
export interface Media {
  id: string;
  platform: 'Instagram' | 'Instagram IE' | 'TikTok';
  posted_at: string;
  posted: string;
  kind: 'Reel' | 'Carousel' | 'Image' | 'Video' | 'Photo';
  caption: string;
  permalink: string | null;
  media_url: string | null;
  thumb_url: string | null;
  embed_url: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reposts: number | null;
  full_watch_rate: number | null;
  avg_watch_s: number | null;
  new_followers: number | null;
  comment_key: string;
}

/** Daily account totals from the native connectors. */
export interface AccountDay {
  date: string;
  platform: 'Instagram' | 'Instagram IE' | 'TikTok';
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reposts: number | null;
  interactions: number | null;
  profile_views: number | null;
  follows: number | null;
}

export interface CompetitorItem {
  id: string; brand: string; kind: string | null; platform: string | null; title: string; summary: string | null;
  metric: string | null; spike: boolean | null; posted_on: string | null; url: string | null; so_what: string | null; found_at: string;
}

export interface Mention {
  id: string; source: string | null; author: string | null; title: string; summary: string | null; kind: string | null;
  action: string | null; priority: string | null; metric: string | null; posted_on: string | null; url: string | null;
  why: string | null; done: boolean; found_at: string;
}
