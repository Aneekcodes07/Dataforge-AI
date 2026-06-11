import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface ActivityItem {
  id: string;
  type: 'extraction' | 'cleaning' | 'analysis' | 'ml' | 'export' | 'error';
  message: string;
  timestamp: Date;
  projectName?: string;
}

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Connection State
  connectionState: 'connected' | 'reconnecting' | 'disconnected' | 'offline';
  setConnectionState: (state: 'connected' | 'reconnecting' | 'disconnected' | 'offline') => void;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  addNotificationRealtime: (notification: Notification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAsReadRealtime: (id: string) => void;
  markAllAsRead: () => Promise<void>;

  // Activities
  activities: ActivityItem[];
  fetchActivities: () => Promise<void>;
  addActivityRealtime: (activity: ActivityItem) => void;

  // Loading states
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // Command palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  // Connection state
  connectionState: 'disconnected',
  setConnectionState: (state) => set({ connectionState: state }),

  // Notifications — Seed with temporary mock data (will be overridden on fetch)
  notifications: [
    {
      id: 'n1',
      type: 'success',
      title: 'Pipeline Completed Successfully',
      message: "Ingestion pipeline 'ecommerce-crawl-v3' (pl_ec_crawl_8321) finished all 6 stages (1.87M records).",
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      read: false,
    },
    {
      id: 'n2',
      type: 'success',
      title: 'Dataset Parquet Generated',
      message: "Compiled Parquet tables for 'financial-news-Q4' saved successfully to S3 repository.",
      timestamp: new Date(Date.now() - 1000 * 60 * 18),
      read: false,
    },
    {
      id: 'n3',
      type: 'warning',
      title: 'Schema Validation Warning',
      message: "Quality score for 'arxiv-ml-papers' dropped to 91.5% due to 3 price range constraint violations.",
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      read: false,
    },
    {
      id: 'n4',
      type: 'error',
      title: 'Ingestion Agent Timeout',
      message: "Crawler worker node 'crawler_worker_04' failed to resolve connection with target REST API gateway.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      read: false,
    },
  ],
  unreadCount: 4,

  fetchNotifications: async () => {
    try {
      const data = await api.get<any[]>('/monitoring/notifications');
      const mapped: Notification[] = data.map((n) => ({
        id: n.id,
        type: n.type as Notification['type'],
        title: n.title,
        message: n.content,
        timestamp: new Date(n.createdAt),
        read: n.isRead,
      }));
      set({
        notifications: mapped,
        unreadCount: mapped.filter((n) => !n.read).length,
      });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  },

  addNotification: (notification) => {
    // Client-side fallback creator (e.g. for user actions)
    const newNotif: Notification = {
      ...notification,
      id: `n_${Date.now()}`,
      timestamp: new Date(),
      read: false,
    };
    set((s) => ({
      notifications: [newNotif, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }));
  },

  addNotificationRealtime: (notification) => {
    set((s) => {
      // Avoid duplicate appending
      if (s.notifications.some((n) => n.id === notification.id)) {
        return {};
      }
      return {
        notifications: [notification, ...s.notifications],
        unreadCount: s.unreadCount + (notification.read ? 0 : 1),
      };
    });
  },

  markAsRead: async (id) => {
    // 1. Pessimistic update in database
    try {
      await api.post(`/monitoring/notifications/${id}/read`);
    } catch (err) {
      console.error(`Failed to mark notification ${id} as read on server:`, err);
    }
    // 2. Perform optimistic/local updates
    get().markAsReadRealtime(id);
  },

  markAsReadRealtime: (id) => {
    set((s) => {
      const updated = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },

  markAllAsRead: async () => {
    const unread = get().notifications.filter((n) => !n.read);
    // Mark all as read concurrently
    await Promise.all(
      unread.map((n) =>
        api.post(`/monitoring/notifications/${n.id}/read`).catch(() => {})
      )
    );
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  // Activities
  activities: [],
  fetchActivities: async () => {
    try {
      const data = await api.get<any[]>('/monitoring/activities');
      const mapped: ActivityItem[] = data.map((l) => ({
        id: l.id,
        type: (l.eventType?.toLowerCase() || 'extraction') as ActivityItem['type'],
        message: l.description,
        timestamp: new Date(l.createdAt),
      }));
      set({ activities: mapped });
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    }
  },

  addActivityRealtime: (activity) => {
    set((s) => {
      if (s.activities.some((a) => a.id === activity.id)) {
        return {};
      }
      return {
        activities: [activity, ...s.activities].slice(0, 50), // Cap size to 50
      };
    });
  },

  // Loading
  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
}));
