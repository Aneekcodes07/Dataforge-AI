import { motion } from 'motion/react';
import {
  Globe, Sparkles, Brain, BarChart3, Download, AlertCircle,
} from 'lucide-react';
import { MOCK_ACTIVITIES } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/styles/animations';
import { useUIStore } from '@/stores/uiStore';

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  extraction: { icon: Globe, color: '#FF7A00', label: 'Extraction' },
  cleaning: { icon: Sparkles, color: '#22D3EE', label: 'Cleaning' },
  ml: { icon: Brain, color: '#A78BFA', label: 'ML Engine' },
  analysis: { icon: BarChart3, color: '#22C55E', label: 'Analysis' },
  export: { icon: Download, color: '#FF7A00', label: 'Export' },
  error: { icon: AlertCircle, color: '#EF4444', label: 'Error' },
};

export default function ActivityFeed() {
  const { activities } = useUIStore();
  
  // Use real-time database activities, fall back to MOCK_ACTIVITIES if database is empty
  const displayActivities = activities.length > 0 ? activities : MOCK_ACTIVITIES;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="card h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight">Activity Feed</h3>
          <p className="text-xs text-text-tertiary mt-0.5">Real-time events from the agent network</p>
        </div>
        <span className="chip chip-live text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Live
        </span>
      </div>

      <div className="space-y-1 flex-1">
        {displayActivities.map((activity, index) => {
          const config = typeConfig[activity.type] || typeConfig.extraction;
          const Icon = config.icon;

          return (
            <motion.div
              key={activity.id}
              variants={staggerItem}
              className="flex items-start gap-3.5 px-3 py-3.5 rounded-lg hover:bg-white/[0.02] transition-colors relative"
            >
              {/* Timeline line */}
              {index < displayActivities.length - 1 && (
                <div
                  className="absolute left-[26px] top-[44px] w-px h-[calc(100%-20px)]"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                />
              )}

              {/* Icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${config.color}10`,
                  border: `1px solid ${config.color}18`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color: config.color }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-semibold font-mono rounded-full px-2 py-0.5"
                    style={{
                      backgroundColor: `${config.color}10`,
                      color: config.color,
                    }}
                  >
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {activity.message}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                  <span className="text-text-muted">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                  {activity.projectName && (
                    <>
                      <span className="text-text-muted">·</span>
                      <span className="text-text-tertiary text-[10px]">{activity.projectName}</span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

