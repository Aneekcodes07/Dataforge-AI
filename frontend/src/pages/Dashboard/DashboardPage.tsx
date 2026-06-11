import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import StatsCards from './components/StatsCards';
import QuickStart from './components/QuickStart';
import RecentProjects from './components/RecentProjects';
import ActivityFeed from './components/ActivityFeed';
import { staggerContainer, staggerItem } from '@/styles/animations';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { fetchProjects } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="page-section max-w-[1440px] mx-auto"
    >
      {/* Welcome header */}
      <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'Admin'}
          </h1>
          <p className="text-sm text-text-secondary mt-1.5">
            DataForge Operations Dashboard — All systems operational
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="chip chip-live">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Online
          </span>
          <span className="chip chip-cyan text-[10px]">
            Uptime: 142h
          </span>
        </div>
      </motion.div>

      {/* KPI Stats */}
      <motion.div variants={staggerItem}>
        <StatsCards />
      </motion.div>

      {/* Pipeline Source Selection */}
      <motion.div variants={staggerItem}>
        <QuickStart />
      </motion.div>

      {/* Two balanced panels: Logs + Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={staggerItem}>
          <RecentProjects />
        </motion.div>
        <motion.div variants={staggerItem}>
          <ActivityFeed />
        </motion.div>
      </div>
    </motion.div>
  );
}
