import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, NAV_GROUPS } from '@/lib/constants';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { getInitials } from '@/lib/utils';

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();

  return (
    <motion.aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40',
        'bg-[#0A0A0A] flex flex-col border-r border-white/[0.06]',
        'transition-all duration-300 ease-in-out'
      )}
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06] shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shrink-0 shadow-md">
          <Zap className="w-4.5 h-4.5 text-black stroke-[2.5]" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <span className="font-mono font-bold text-sm tracking-wide text-text-primary">
                DataForge<span className="text-accent">.ai</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-5 font-mono text-[11px]" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.key);
          if (items.length === 0) return null;

          return (
            <div key={group.key} className="space-y-1">
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[9px] font-semibold uppercase tracking-[0.12em] text-text-muted px-3 mb-2"
                  >
                    {group.label}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      className={cn(
                        'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg',
                        'transition-all duration-150',
                        'hover:bg-white/[0.03] text-text-secondary hover:text-text-primary',
                        isActive && 'bg-white/[0.04] text-text-primary'
                      )}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      {/* Active indicator pill */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-accent"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}

                      <Icon
                        className={cn(
                          'w-[18px] h-[18px] shrink-0 transition-colors',
                          isActive ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary'
                        )}
                      />

                      <AnimatePresence>
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                              'overflow-hidden whitespace-nowrap font-medium tracking-tight text-[12px]',
                              isActive ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'
                            )}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {/* Badge */}
                      {item.badge && !sidebarCollapsed && (
                        <span className="ml-auto text-[9px] font-semibold font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full border border-accent/15">
                          {item.badge}
                        </span>
                      )}
                      {item.badge && sidebarCollapsed && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
                      )}
                    </NavLink>
                  );
                })}
              </div>

              {/* Group divider */}
              <div className="pt-1">
                <div className="h-px bg-white/[0.04] mx-3" />
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-white/[0.06] p-3 space-y-1 shrink-0 font-mono text-[11px]">
        <NavLink
          to="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]',
            'transition-all duration-150 font-medium text-[12px]'
          )}
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>

        {/* User profile */}
        {user && (
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg',
              'hover:bg-white/[0.03] transition-all duration-150 cursor-pointer'
            )}
            onClick={logout}
            title={sidebarCollapsed ? `${user.name} — Logout` : undefined}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shrink-0 text-[10px] font-bold text-black font-mono">
              {getInitials(user.name)}
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 overflow-hidden min-w-0"
                >
                  <p className="text-[11px] font-semibold text-text-primary truncate">{user.name}</p>
                  <p className="text-[9px] text-text-tertiary truncate font-mono">{user.email}</p>
                </motion.div>
              )}
            </AnimatePresence>
            {!sidebarCollapsed && <LogOut className="w-3.5 h-3.5 text-text-tertiary shrink-0" />}
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        type="button"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={toggleSidebar}
        className={cn(
          'absolute -right-3 top-[72px] w-6 h-6 rounded-full border border-white/[0.08]',
          'bg-[#0A0A0A]',
          'flex items-center justify-center shadow-lg',
          'hover:border-accent/30 hover:bg-[#141414]',
          'transition-all duration-200 z-50 cursor-pointer'
        )}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3 h-3 text-text-secondary" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-text-secondary" />
        )}
      </button>
    </motion.aside>
  );
}
