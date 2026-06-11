import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Globe, FileText, Table, Plug, Sheet, Image, AlertCircle, CheckCircle2, Loader2, Play, ArrowRight } from 'lucide-react';
import { MOCK_PROJECTS } from '@/lib/constants';
import { formatRelativeTime, formatCompactNumber, cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/styles/animations';

const sourceIconMap: Record<string, React.ElementType> = {
  url: Globe,
  pdf: FileText,
  csv: Table,
  api: Plug,
  excel: Sheet,
  image: Image,
};

const statusConfig: Record<string, { label: string; chipClass: string; icon: React.ElementType }> = {
  completed: { label: 'Success', chipClass: 'chip chip-success', icon: CheckCircle2 },
  in_progress: { label: 'Running', chipClass: 'chip chip-running', icon: Loader2 },
  failed: { label: 'Failed', chipClass: 'chip chip-failed', icon: AlertCircle },
  queued: { label: 'Queued', chipClass: 'chip chip-queued', icon: Play },
};

export default function RecentProjects() {
  const navigate = useNavigate();

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="card flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight">Recent Operations</h3>
          <p className="text-xs text-text-tertiary mt-0.5">Latest pipeline runs and extraction logs</p>
        </div>
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
        >
          View All
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-0 overflow-x-auto flex-1">
        {/* Header — desktop table */}
        <div className="hidden md:grid grid-cols-[1fr_100px_80px_110px_80px] gap-4 px-4 py-2.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider bg-white/[0.02] rounded-lg mb-2">
          <span>Project</span>
          <span>Status</span>
          <span className="text-right">Rows</span>
          <span className="text-right">Modified</span>
          <span className="text-right">Quality</span>
        </div>

        {MOCK_PROJECTS.map((project, index) => {
          const SourceIcon = sourceIconMap[project.sourceType] || Globe;
          const status = statusConfig[project.status];
          const StatusIcon = status.icon;

          return (
            <motion.div
              key={project.id}
              variants={staggerItem}
              onClick={() => navigate(`/history?pipeline=${project.id}`)}
              className={cn(
                'px-4 py-3 rounded-lg hover:bg-white/[0.02] transition-all cursor-pointer group',
                index % 2 === 0 && 'bg-white/[0.01]'
              )}
            >
              {/* Mobile card layout */}
              <div className="md:hidden space-y-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <SourceIcon className="w-4 h-4 text-text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                      {project.name}
                    </p>
                    <p className="text-[10px] text-text-tertiary capitalize">{project.sourceType}</p>
                  </div>
                  <span className={status.chipClass}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-secondary pl-12">
                  <span>{project.rowCount > 0 ? formatCompactNumber(project.rowCount) : '—'} rows</span>
                  <span>{formatRelativeTime(project.lastModified)}</span>
                  <span>
                    {project.qualityScore > 0 ? `${project.qualityScore}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Desktop table row */}
              <div className="hidden md:grid grid-cols-[1fr_100px_80px_110px_80px] gap-4 items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <SourceIcon className="w-4 h-4 text-text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                      {project.name}
                    </p>
                    <p className="text-[10px] text-text-tertiary capitalize">{project.sourceType} source</p>
                  </div>
                </div>

                <div>
                  <span className={cn(status.chipClass, 'text-[10px]')}>
                    {project.status === 'in_progress' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <StatusIcon className="w-3 h-3" />
                    )}
                    {status.label}
                  </span>
                </div>

                <p className="text-xs text-text-primary text-right font-mono font-medium">
                  {project.rowCount > 0 ? formatCompactNumber(project.rowCount) : '—'}
                </p>

                <p className="text-[11px] text-text-tertiary text-right">
                  {formatRelativeTime(project.lastModified)}
                </p>

                <div className="text-right">
                  {project.qualityScore > 0 ? (
                    <div className="inline-flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${project.qualityScore}%`,
                            backgroundColor: project.qualityScore >= 95 ? '#22C55E' :
                              project.qualityScore >= 85 ? '#FF7A00' : '#F59E0B',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-medium text-text-secondary">
                        {project.qualityScore}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-text-muted">—</span>
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
