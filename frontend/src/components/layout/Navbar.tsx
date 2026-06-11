import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, Command, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount, notifications, markAllAsRead, setCommandPaletteOpen, connectionState } = useUIStore();
  const { user } = useAuthStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Connection status styling
  const statusStyles = {
    connected: { color: 'text-success bg-success/5 border-success/15', dot: 'bg-success animate-pulse', label: 'Online' },
    reconnecting: { color: 'text-warning bg-warning/5 border-warning/15', dot: 'bg-warning animate-ping', label: 'Reconnecting' },
    offline: { color: 'text-error bg-error/5 border-error/15', dot: 'bg-error', label: 'Offline' },
    disconnected: { color: 'text-text-secondary bg-white/[0.01] border-white/[0.04]', dot: 'bg-text-tertiary', label: 'Disconnected' },
  }[connectionState] || { color: 'text-text-secondary bg-white/[0.01]', dot: 'bg-text-tertiary', label: 'Offline' };

  // Build breadcrumb from current path
  const currentNav = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const breadcrumb = currentNav ? currentNav.label : 'Dashboard';

  // Close notification panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="h-16 border-b border-white/[0.06] bg-[#0A0A0A]/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-30">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-tertiary font-medium">DataForge</span>
        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-text-primary font-semibold">{breadcrumb}</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button
          type="button"
          aria-label="Search"
          onClick={() => setCommandPaletteOpen(true)}
          className={cn(
            'flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]',
            'text-text-tertiary hover:border-white/[0.10] hover:bg-white/[0.04] hover:text-text-secondary',
            'transition-all duration-200 text-[12px] font-medium'
          )}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-text-muted border border-white/[0.06] ml-2">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>

        {/* Connection Status Badge */}
        <span className={cn(
          "hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold tracking-wider transition-all",
          statusStyles.color
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusStyles.dot)} />
          {statusStyles.label.toUpperCase()}
        </span>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen(!notifOpen)}
            className={cn(
              'relative p-2.5 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-all duration-200'
            )}
          >
            <Bell className="w-[18px] h-[18px] text-text-secondary" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-black flex items-center justify-center font-mono">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'absolute right-0 top-full mt-2 w-80',
                  'bg-[#0C0C0C] border border-white/[0.06] rounded-xl shadow-xl overflow-hidden'
                )}
              >
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-text-primary">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-medium text-accent hover:underline transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-text-tertiary text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={cn(
                          'px-4 py-3.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors',
                          !notif.read && 'bg-accent/[0.02]'
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {!notif.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-text-primary">{notif.title}</p>
                            <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{notif.message}</p>
                            <p className="text-[10px] text-text-tertiary mt-1.5">
                              {formatRelativeTime(notif.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-white/[0.06] bg-white/[0.01] px-4 py-2.5 flex justify-center">
                  <button
                    onClick={() => {
                      setNotifOpen(false);
                      navigate('/notifications');
                    }}
                    className="text-[11px] font-semibold text-accent hover:text-accent-hover transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    View all notifications
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Avatar Block */}
        {user && (
          <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-[10px] font-bold text-black">
              {getInitials(user.name)}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
