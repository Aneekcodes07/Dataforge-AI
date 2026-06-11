import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Search,
  BellOff,
  ChevronRight,
} from 'lucide-react';
import { useUIStore, type Notification } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { staggerContainer } from '@/styles/animations';

type FilterType = 'all' | 'unread' | 'success' | 'warning' | 'error' | 'info';

// Relative timestamp helper
function formatRelativeTime(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

// Map notification type to icon, colors and fallback actions
const notifConfig = {
  success: {
    icon: CheckCircle2,
    color: 'text-success bg-success/10 border-success/20',
    dotColor: 'bg-success',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-warning bg-warning/10 border-warning/20',
    dotColor: 'bg-warning',
  },
  error: {
    icon: XCircle,
    color: 'text-danger bg-danger/10 border-danger/20',
    dotColor: 'bg-danger',
  },
  info: {
    icon: Info,
    color: 'text-info bg-info/10 border-info/20',
    dotColor: 'bg-info',
  },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, fetchNotifications } = useUIStore();
  const [activeTab, setActiveTab] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync with DB notifications log on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Trigger brief shimmer loading on tab switches for polished UX
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Handle navigating to contextual details
  const handleContextClick = (notif: Notification) => {
    // Mark as read first
    if (!notif.read) {
      markAsRead(notif.id);
    }

    const messageLower = notif.message.toLowerCase();
    const titleLower = notif.title.toLowerCase();

    // Map to relevant routes
    if (titleLower.includes('pipeline') || messageLower.includes('pipeline') || messageLower.includes('crawler')) {
      navigate('/history?pipeline=p1');
    } else if (titleLower.includes('dataset') || messageLower.includes('dataset') || messageLower.includes('parquet')) {
      navigate('/datasets');
    } else if (titleLower.includes('export') || messageLower.includes('export')) {
      navigate('/export');
    } else {
      navigate('/dashboard');
    }
  };

  // Filter notifications based on tab and search query
  const filteredNotifications = notifications.filter((notif) => {
    // 1. Tab filter
    if (activeTab === 'unread' && notif.read) return false;
    if (activeTab !== 'all' && activeTab !== 'unread' && notif.type !== activeTab) return false;

    // 2. Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = notif.title.toLowerCase().includes(query);
      const matchMsg = notif.message.toLowerCase().includes(query);
      return matchTitle || matchMsg;
    }

    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="page-section max-w-[1440px] mx-auto text-left"
    >
      {/* Header */}
      <div className="page-header border-b border-border pb-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-dashboard-title text-text-primary font-mono uppercase tracking-wider">
            [SYS_NOTIFICATIONS_LOG]
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Real-time feed of background crawler pipelines, data validations, and autonomous node activities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="btn-secondary py-2 px-3 text-xs font-semibold font-mono uppercase tracking-wide inline-flex items-center gap-1.5 rounded-md hover:text-accent hover:border-accent/40"
            >
              <Check className="w-3.5 h-3.5" />
              [MARK_ALL_READ]
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 items-start">
        {/* Navigation Sidebar / Filter Tabs */}
        <div className="space-y-1 bg-surface/30 p-2.5 rounded-xl border border-border/40 backdrop-blur-md">
          <p className="text-[10px] font-bold font-mono text-text-tertiary uppercase tracking-widest px-3 mb-2">
            Filter Logs
          </p>
          {(
            [
              { id: 'all', label: 'All notifications', count: notifications.length },
              { id: 'unread', label: 'Unread log entries', count: unreadCount, badge: true },
              { id: 'success', label: 'Success events', count: notifications.filter((n) => n.type === 'success').length },
              { id: 'warning', label: 'Warnings & alerts', count: notifications.filter((n) => n.type === 'warning').length },
              { id: 'error', label: 'System errors', count: notifications.filter((n) => n.type === 'error').length },
              { id: 'info', label: 'Information feeds', count: notifications.filter((n) => n.type === 'info').length },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left duration-200',
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/20 font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.02] border border-transparent'
                )}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold leading-none',
                      isActive
                        ? 'bg-accent/20 text-accent'
                        : ('badge' in tab && tab.badge && tab.count > 0)
                        ? 'bg-accent text-black'
                        : 'bg-white/[0.04] text-text-tertiary border border-border/50'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List Panel */}
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search notifications by title, pipeline code, or event descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-10 pr-4 w-full h-[42px] bg-surface/30 backdrop-blur-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-text-tertiary hover:text-text-primary"
              >
                [CLEAR]
              </button>
            )}
          </div>

          {/* Notifications List container */}
          <div className="card bg-surface/20 border border-border/40 rounded-xl p-0 overflow-hidden backdrop-blur-md">
            {isLoading ? (
              // Shimmer Loading Skeleton
              <div className="divide-y divide-border/20">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-5 flex gap-4 animate-pulse">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04]" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-4 bg-white/[0.05] rounded-md w-1/3" />
                      <div className="h-3.5 bg-white/[0.04] rounded-md w-3/4" />
                      <div className="h-3 bg-white/[0.03] rounded-md w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                <AnimatePresence initial={false}>
                  {filteredNotifications.length === 0 ? (
                    // Empty state layout
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-16 text-center flex flex-col items-center justify-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-border/40 flex items-center justify-center text-text-tertiary">
                        <BellOff className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-text-primary font-mono uppercase tracking-wider">
                          [NO_NOTIFICATIONS_MATCHED]
                        </h3>
                        <p className="text-xs text-text-secondary max-w-sm">
                          {searchQuery
                            ? `No events matching "${searchQuery}" were detected in this system scope.`
                            : `There are currently no active notifications for this filter parameter.`}
                        </p>
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="btn-secondary py-1.5 px-3 text-[11px] font-mono uppercase tracking-wide rounded-md mt-2"
                        >
                          Clear Search Filter
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    filteredNotifications.map((notif) => {
                      const cfg = notifConfig[notif.type] || notifConfig.info;
                      const Icon = cfg.icon;

                      return (
                        <motion.div
                          key={notif.id}
                          layoutId={notif.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className={cn(
                            'p-5 transition-all duration-200 text-left flex gap-4 items-start relative group',
                            !notif.read ? 'bg-accent/[0.015]' : 'hover:bg-white/[0.01]'
                          )}
                        >
                          {/* Unread indicator dot */}
                          {!notif.read && (
                            <span
                              className={cn(
                                'absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full',
                                cfg.dotColor
                              )}
                            />
                          )}

                          {/* Icon box */}
                          <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center shrink-0', cfg.color)}>
                            <Icon className="w-4 h-4" />
                          </div>

                          {/* Info panel */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                              <h4 className={cn(
                                'text-sm tracking-tight',
                                !notif.read ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary'
                              )}>
                                {notif.title}
                              </h4>
                              <span className="text-[10px] font-mono text-text-tertiary whitespace-nowrap pt-0.5">
                                {formatRelativeTime(notif.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-text-secondary mt-1 leading-relaxed max-w-4xl">
                              {notif.message}
                            </p>

                            {/* Actions block */}
                            <div className="flex items-center gap-4 mt-3">
                              <button
                                onClick={() => handleContextClick(notif)}
                                className="text-[11px] font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1 hover:underline transition-all"
                              >
                                View Operational Context
                                <ChevronRight className="w-3 h-3" />
                              </button>
                              
                              {!notif.read && (
                                <button
                                  onClick={() => markAsRead(notif.id)}
                                  className="text-[11px] font-medium text-text-tertiary hover:text-text-primary inline-flex items-center gap-1 hover:underline transition-all"
                                >
                                  <Check className="w-3 h-3" />
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
