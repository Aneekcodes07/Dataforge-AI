import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import DatasetDetailPage from './DatasetDetailPage';

interface DatasetItem {
  name: string;
  source: string;
  sourceType: string;
  records: string;
  schema: string;
  quality: number;
  lastRun: string;
  status: 'Running' | 'Done' | 'Queued' | 'Failed';
}

const mockDatasets: DatasetItem[] = [
  {
    name: 'ecommerce-crawl-v3',
    source: 'Web crawl',
    sourceType: 'info',
    records: '1,872,441',
    schema: 'JSON',
    quality: 98.2,
    lastRun: '2 min ago',
    status: 'Running'
  },
  {
    name: 'arxiv-ml-papers',
    source: 'PDF',
    sourceType: 'muted',
    records: '128,004',
    schema: 'Parquet',
    quality: 99.7,
    lastRun: '1 hr ago',
    status: 'Done'
  },
  {
    name: 'financial-news-Q4',
    source: 'API',
    sourceType: 'muted',
    records: '340,200',
    schema: 'JSONL',
    quality: 91.5,
    lastRun: '8 min ago',
    status: 'Queued'
  },
  {
    name: 'github-issues-annotated',
    source: 'API',
    sourceType: 'muted',
    records: '892,100',
    schema: 'Parquet',
    quality: 97.1,
    lastRun: 'Yesterday',
    status: 'Done'
  },
  {
    name: 'product-reviews-scrape',
    source: 'Web crawl',
    sourceType: 'info',
    records: '22,018',
    schema: 'CSV',
    quality: 0,
    lastRun: '3 hr ago',
    status: 'Failed'
  }
];

export default function DatasetExplorerPage() {
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Running' | 'Done' | 'Failed'>('All');

  // Filter datasets
  const filteredDatasets = mockDatasets.filter(dataset => {
    const matchesSearch = dataset.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          dataset.source.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'All') return matchesSearch;
    return matchesSearch && dataset.status === activeFilter;
  });

  return (
    <div className="page-section max-w-[1440px] mx-auto min-h-[70vh]">
      <AnimatePresence mode="wait">
        {!selectedDataset ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
              <div>
                <span className="text-[10px] font-bold font-mono uppercase tracking-[0.15em] text-text-muted">
                  Data Repository
                </span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary mt-1">
                  Datasets
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    placeholder="Search datasets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-9 pr-4 py-2 text-xs w-[220px]"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => alert('Add pipeline module integration is active inside Pipeline Wizard.')}
                  className="btn btn-primary btn-sm text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New Dataset
                </button>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {(['All', 'Running', 'Done', 'Failed'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`
                    px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-150 cursor-pointer
                    ${activeFilter === filter 
                      ? 'bg-accent/10 border-accent/30 text-accent font-semibold' 
                      : 'bg-white/[0.02] border-white/[0.04] text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                    }
                  `}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Table panel container */}
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dataset Name</th>
                      <th>Source</th>
                      <th>Records</th>
                      <th>Schema</th>
                      <th>Quality</th>
                      <th>Last Run</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDatasets.length > 0 ? (
                      filteredDatasets.map((dataset) => (
                        <tr 
                          key={dataset.name} 
                          className="hover:bg-white/[0.01] transition-colors cursor-pointer group"
                          onClick={() => {
                            if (dataset.status !== 'Failed') {
                              setSelectedDataset(dataset.name);
                            } else {
                              alert('This dataset ingest job failed. Triggering rebuild action...');
                            }
                          }}
                        >
                          <td>
                            <div className="font-semibold text-text-primary text-sm group-hover:text-accent transition-colors">
                              {dataset.name}
                            </div>
                            <div className="text-[10px] text-text-muted mt-0.5 font-mono">
                              Product catalog • 48 fields
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${dataset.sourceType === 'info' ? 'badge-info' : 'badge-muted'} text-[10px] font-mono`}>
                              {dataset.source}
                            </span>
                          </td>
                          <td>
                            <span className="font-mono text-xs text-text-secondary">
                              {dataset.records}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-muted text-[10px] font-mono">
                              {dataset.schema}
                            </span>
                          </td>
                          <td>
                            {dataset.quality > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="progress w-12">
                                  <div 
                                    className="progress-fill ok" 
                                    style={{ width: `${dataset.quality}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-success font-mono">
                                  {dataset.quality}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-mono text-text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <span className="text-xs text-text-secondary font-mono">
                              {dataset.lastRun}
                            </span>
                          </td>
                          <td>
                            {dataset.status === 'Running' && (
                              <span className="badge badge-primary text-[10px]">
                                <RefreshCw className="w-3 h-3 animate-spin mr-1 shrink-0" />
                                Running
                              </span>
                            )}
                            {dataset.status === 'Done' && (
                              <span className="badge badge-ok text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-success mr-1 shrink-0" />
                                Done
                              </span>
                            )}
                            {dataset.status === 'Queued' && (
                              <span className="badge badge-warn text-[10px]">
                                <ClockIcon className="w-3 h-3 mr-1 shrink-0" />
                                Queued
                              </span>
                            )}
                            {dataset.status === 'Failed' && (
                              <span className="badge badge-err text-[10px]">
                                <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (dataset.status !== 'Failed') {
                                  setSelectedDataset(dataset.name);
                                } else {
                                  alert('Dataset failed. Inspect Quality logs.');
                                }
                              }}
                              className="btn btn-ghost btn-sm text-[11px] font-mono tracking-tight group-hover:bg-white/[0.04] transition-colors"
                            >
                              {dataset.status === 'Failed' ? 'Retry' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-text-muted text-sm font-mono">
                          No datasets match the selected criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            <DatasetDetailPage 
              datasetId={selectedDataset} 
              onBack={() => setSelectedDataset(null)} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Help clock wrapper matching Lucide icons
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
