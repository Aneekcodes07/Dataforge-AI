import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Globe,
  Database,
  Network,
  Zap,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

/** CSS-built dashboard preview — mirrors the real product UI */
export default function ProductPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-[1224px] mx-auto"
    >
      {/* Browser chrome */}
      <div className="rounded-md border border-white/[0.06] bg-[#0D0D0D] shadow-2xl shadow-black/80 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.04] bg-[#151515]">
          <div className="flex gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 flex justify-center">
            <span className="text-xs text-text-secondary font-mono">app.dataforge.ai/dashboard</span>
          </div>
        </div>

        <div className="flex min-h-[500px] sm:min-h-[580px]">
          {/* Mini sidebar */}
          <div className="hidden sm:flex w-[72px] lg:w-[80px] flex-col border-r border-white/[0.04] bg-[#0D0D0D] py-6 px-3 gap-3 shrink-0">
            <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            {[LayoutDashboard, Globe, Database, Network].map((Icon, i) => (
              <div
                key={i}
                className={`w-11 h-11 rounded-md flex items-center justify-center mx-auto ${
                  i === 0 ? 'bg-white/[0.04] text-accent' : 'text-text-secondary'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-6 sm:p-10 bg-[#050505] overflow-hidden flex flex-col justify-between">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <p className="text-lg font-bold text-text-primary font-mono tracking-tight">[COMMAND_CENTER_NODE_01]</p>
                <p className="text-xs text-text-secondary mt-1">Host active: 3 ingestion workflows in queue</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono border border-accent/20 text-accent px-2 py-0.5 rounded uppercase tracking-wider bg-accent/5">
                  SYSTEM_NORMAL
                </span>
              </div>
            </div>

            {/* Stat pills */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Active Pipeline', value: '7/7 Agents', color: '#FF7A00' },
                { label: 'Token Volume', value: '42.5M/s', color: '#FFB347' },
                { label: 'Data Quality', value: '99.8%', color: '#22C55E' },
                { label: 'Validation rate', value: '100%', color: '#22C55E' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border border-white/[0.04] bg-[#0D0D0D] px-5 py-4 flex flex-col justify-between"
                >
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider font-mono font-semibold">{stat.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-text-primary mt-2" style={{ color: stat.color }}>
                     {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Projects table snippet */}
            <div className="rounded-md border border-white/[0.04] bg-[#0D0D0D] overflow-hidden flex-1 flex flex-col">
              <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between bg-[#151515]">
                <span className="text-xs font-bold font-mono uppercase text-text-secondary tracking-wider">Active Operations Log</span>
                <span className="text-xs font-semibold text-accent hover:text-accent-hover cursor-pointer font-mono">[VIEW_ALL]</span>
              </div>
              <div className="flex-1 flex flex-col justify-around bg-[#0D0D0D]">
                {[
                  { name: 'E-commerce Products Scrape', status: 'completed', rows: '2.8M rows', latency: '4ms' },
                  { name: 'Financial Report Ingestion', status: 'running', rows: '1.5M rows', latency: '12ms' },
                  { name: 'Customer Survey Validation', status: 'completed', rows: '12.5M rows', latency: '2ms' },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-accent/5 flex items-center justify-center shrink-0 border border-accent/10">
                        <Globe className="w-4 h-4 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-mono font-medium text-text-primary truncate block">{row.name}</span>
                        <span className="text-[10px] font-mono text-text-secondary">latency: {row.latency}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-text-secondary font-mono">{row.rows}</span>
                      {row.status === 'running' ? (
                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
