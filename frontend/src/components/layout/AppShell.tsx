import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import CommandPalette from './CommandPalette';
import { useUIStore } from '@/stores/uiStore';
import { wsService } from '@/lib/websocketService';
import { cn } from '@/lib/utils';
import { pageTransition } from '@/styles/animations';

export default function AppShell() {
  const { sidebarCollapsed, fetchNotifications, fetchActivities } = useUIStore();
  const location = useLocation();

  // Manage real-time WebSocket connection lifecycle linked to user session
  useEffect(() => {
    // 1. Fetch initial DB states
    fetchNotifications();
    fetchActivities();

    // 2. Establish connection
    wsService.connect();

    return () => {
      // Clean up connection on logout/session teardown
      wsService.disconnect();
    };
  }, [fetchNotifications, fetchActivities]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div
        className={cn('transition-all duration-300 ease-in-out')}
        style={{
          marginLeft: sidebarCollapsed ? 72 : 260,
        }}
      >
        <Navbar />

        <main className="px-6 py-8 md:px-10 md:py-10 lg:px-12 min-h-[calc(100vh-4rem)] overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}

