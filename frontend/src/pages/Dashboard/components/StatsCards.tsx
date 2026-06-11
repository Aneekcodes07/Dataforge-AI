import { motion } from 'motion/react';
import { Database, Loader2, ShieldCheck, Brain, TrendingUp, TrendingDown } from 'lucide-react';
import { MOCK_STATS, type StatCardData } from '@/lib/constants';
import { staggerContainer, staggerItem } from '@/styles/animations';

const iconMap: Record<string, React.ElementType> = {
  database: Database,
  loader: Loader2,
  shield: ShieldCheck,
  brain: Brain,
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) {
    return null;
  }

  const safeData = data.length === 1 ? [data[0], data[0]] : data;
  const max = Math.max(...safeData);
  const min = Math.min(...safeData);
  const range = max - min || 1;
  const width = 120;
  const height = 36;
  const padding = 2;
  const xStep = safeData.length > 1 ? (width - padding * 2) / (safeData.length - 1) : 0;

  const points = safeData
    .map((val, i) => {
      const x = padding + i * xStep;
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      const safeY = Number.isFinite(y) ? y : height / 2;
      const safeX = Number.isFinite(x) ? x : padding;
      return `${safeX},${safeY}`;
    })
    .join(' ');

  // Create area fill
  const areaPoints = `${padding},${height} ${points} ${width - padding},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible opacity-60">
      <defs>
        <linearGradient id={`sparkline-gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#sparkline-gradient-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({ stat }: { stat: StatCardData }) {
  const Icon = iconMap[stat.iconName] || Database;
  const isPositive = stat.change > 0;

  return (
    <motion.div
      variants={staggerItem}
      className="card group hover:border-white/[0.10] transition-all relative overflow-hidden"
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${stat.color}, transparent)`,
        }}
      />

      {/* Header: Icon + Label */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: `${stat.color}12`,
            border: `1px solid ${stat.color}20`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: stat.color }} />
        </div>
        <p className="text-xs font-medium text-text-secondary tracking-wide">{stat.label}</p>
      </div>

      {/* Value + Sparkline row */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold font-mono tracking-tight text-text-primary">{stat.value}</p>
          <div className="flex items-center gap-1.5 mt-2">
            {stat.change !== 0 ? (
              <>
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono"
                  style={{
                    backgroundColor: isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: isPositive ? '#22C55E' : '#EF4444',
                  }}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {stat.changeLabel}
                </div>
              </>
            ) : (
              <span
                className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${stat.color}15`,
                  color: stat.color,
                }}
              >
                {stat.changeLabel}
              </span>
            )}
          </div>
        </div>
        <div className="pb-1">
          <Sparkline data={stat.sparklineData} color={stat.color} />
        </div>
      </div>
    </motion.div>
  );
}

export default function StatsCards() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6"
    >
      {MOCK_STATS.map((stat) => (
        <StatCard key={stat.id} stat={stat} />
      ))}
    </motion.div>
  );
}
