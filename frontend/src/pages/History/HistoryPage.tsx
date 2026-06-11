import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Globe,
  FileText,
  Table,
  Plug,
  Sheet,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Play,
  Search,
  ChevronRight,
  Activity
} from 'lucide-react';
import { MOCK_PROJECTS } from '@/lib/constants';
import { formatRelativeTime, formatCompactNumber, cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/styles/animations';
import PipelineDetailPage from './PipelineDetailPage';

const sourceIconMap: Record<string, React.ElementType> = {
  url: Globe,
  pdf: FileText,
  csv: Table,
  api: Plug,
  excel: Sheet,
  image: ImageIcon,
};

const statusConfig: Record<string, { label: string; chipClass: string; icon: React.ElementType }> = {
  completed: { label: 'Success', chipClass: 'chip chip-success text-[10px]', icon: CheckCircle2 },
  in_progress: { label: 'Running', chipClass: 'chip chip-running text-[10px]', icon: Activity },
  failed: { label: 'Failed', chipClass: 'chip chip-failed text-[10px]', icon: AlertCircle },
  queued: { label: 'Queued', chipClass: 'chip chip-queued text-[10px]', icon: Play },
};

const pipelineIdMap: Record<string, { id: string; name: string }> = {
  p1: { id: 'pl_ec_crawl_8321', name: 'E-commerce Products' },
  p2: { id: 'pl_fin_report_4231', name: 'Financial Report Q4' },
  p3: { id: 'pl_survey_clean_9128', name: 'Customer Survey Data' },
  p4: { id: 'pl_weather_sync_5821', name: 'Weather API Feed' },
  p5: { id: 'pl_inventory_excel_3129', name: 'Inventory Spreadsheet' },
  p6: { id: 'pl_receipt_ocr_7421', name: 'Receipt OCR Batch' },
};

export default function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'failed' | 'queued'>('all');

  const selectedPipelineId = searchParams.get('pipeline');

  // If a pipeline detail parameter is active, load details workspace
  if (selectedPipelineId) {
    // Determine mapping
    let projName = "Unknown Ingest";
    let realId = selectedPipelineId;
    
    // Check match in p1-p6 keys
    const match = pipelineIdMap[selectedPipelineId];
    if (match) {
      projName = match.name;
      realId = match.id;
    } else {
      // Check if they passed a raw pl_ec_crawl_8321 directly
      const found = Object.values(pipelineIdMap).find(v => v.id === selectedPipelineId);
      if (found) {
        projName = found.name;
      }
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="page-section max-w-[1440px] mx-auto"
      >
        <PipelineDetailPage 
          pipelineId={realId} 
          projectName={projName} 
          onBack={() => setSearchParams({})} 
        />
      </motion.div>
    );
  }

  // Filter project executions
  const filteredProjects = useMemo(() => {
    return MOCK_PROJECTS.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            project.sourceType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = MOCK_PROJECTS.length;
    const running = MOCK_PROJECTS.filter(p => p.status === 'in_progress').length;
    const failed = MOCK_PROJECTS.filter(p => p.status === 'failed').length;
    const success = MOCK_PROJECTS.filter(p => p.status === 'completed').length;
    return { total, running, failed, success };
  }, []);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="page-section max-w-[1440px] mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            Ingestion & Project History
          </h1>
          <p className="text-sm text-text-secondary mt-1.5">
            Audit logs and metric summaries for all autonomous operations runs
          </p>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-text-secondary">
          <span className="chip text-[11px]">
            {stats.running} Active Pipeline
          </span>
          <span className="chip text-[11px]">
            {stats.success} Successes
          </span>
        </div>
      </motion.div>

      {/* Metric Cards Banner */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border border-border">
          <div className="text-xs text-text-secondary">Total Ingestion Jobs</div>
          <div className="text-xl font-bold text-text-primary mt-1">{stats.total} Runs</div>
        </div>
        <div className="card p-4 border border-border">
          <div className="text-xs text-text-secondary">Active Workers</div>
          <div className="text-xl font-bold text-accent mt-1">{stats.running} Ingress</div>
        </div>
        <div className="card p-4 border border-border">
          <div className="text-xs text-text-secondary">Avg Quality Score</div>
          <div className="text-xl font-bold text-success mt-1">93.8%</div>
        </div>
        <div className="card p-4 border border-border">
          <div className="text-xs text-text-secondary">Job Terminations</div>
          <div className="text-xl font-bold text-error mt-1">{stats.failed} Errors</div>
        </div>
      </motion.div>

      {/* Filters Bar */}
      <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        {/* Severity filter tabs */}
        <div className="flex gap-2 border-b border-border md:border-none overflow-x-auto scrollbar-none">
          {(['all', 'completed', 'in_progress', 'failed', 'queued'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={cn(
                "pb-2 md:pb-0 md:px-3 md:py-1.5 md:rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap",
                statusFilter === tab 
                  ? "border-b-2 border-accent text-accent md:bg-accent/10 md:border-none" 
                  : "border-transparent text-text-secondary hover:text-text-primary md:hover:bg-white/[0.02]"
              )}
            >
              {tab === 'all' ? 'All Executions' : tab === 'completed' ? 'Success' : tab === 'in_progress' ? 'Running' : tab}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-text-tertiary" />
          <input 
            type="search" 
            placeholder="Search projects by name..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input pl-9 pr-4 py-2 text-xs w-full md:w-64"
          />
        </div>
      </motion.div>

      {/* Main Execution list card */}
      <motion.div variants={staggerItem} className="card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/[0.01] text-text-muted border-b border-border font-semibold uppercase">
                <th className="p-3">Ingestion Job</th>
                <th className="p-3">Job ID</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Row Count</th>
                <th className="p-3 text-right">Quality Index</th>
                <th className="p-3 text-right">Ingest Time</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text-primary">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-text-tertiary">
                    No historical logs found matching active search.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
                  const SourceIcon = sourceIconMap[project.sourceType] || Globe;
                  const status = statusConfig[project.status];
                  const pipelineId = pipelineIdMap[project.id]?.id || `pl_${project.id}_run`;

                  return (
                    <tr 
                      key={project.id}
                      onClick={() => setSearchParams({ pipeline: project.id })}
                      className="hover:bg-white/[0.01] transition-all cursor-pointer group"
                    >
                      {/* Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-border flex items-center justify-center shrink-0">
                            <SourceIcon className="w-4 h-4 text-text-secondary" />
                          </div>
                          <div>
                            <span className="font-semibold text-text-primary group-hover:text-accent transition-colors block">
                              {project.name}
                            </span>
                            <span className="text-[10px] text-text-tertiary capitalize">{project.sourceType} Source</span>
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="p-3 font-mono text-[10px] text-text-secondary font-semibold">
                        {pipelineId}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <span className={status.chipClass}>
                          {status.label}
                        </span>
                      </td>

                      {/* Records */}
                      <td className="p-3 text-right font-mono font-medium text-text-primary">
                        {project.rowCount > 0 ? formatCompactNumber(project.rowCount) : '—'}
                      </td>

                      {/* Quality */}
                      <td className="p-3 text-right">
                        {project.qualityScore > 0 ? (
                          <span className={cn(
                            "font-bold font-mono",
                            project.qualityScore >= 95 ? "text-success" : 
                            project.qualityScore >= 85 ? "text-accent" : "text-warning"
                          )}>
                            {project.qualityScore}%
                          </span>
                        ) : '—'}
                      </td>

                      {/* Modified */}
                      <td className="p-3 text-right text-text-secondary whitespace-nowrap">
                        {formatRelativeTime(project.lastModified)}
                      </td>

                      {/* Chevron Link */}
                      <td className="p-3 text-right">
                        <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-text-primary group-hover:translate-x-0.5 transition-all inline" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
