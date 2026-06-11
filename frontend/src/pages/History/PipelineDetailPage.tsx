import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Terminal,
  Search,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineDetailProps {
  pipelineId: string;
  projectName: string;
  onBack: () => void;
}

// Mock logs data matching ecommerce workflow
const MOCK_PIPELINE_LOGS = [
  { time: '09:01:00', level: 'info', msg: 'System - Initializing ingestion workflow pl_ec_crawl_8321' },
  { time: '09:01:02', level: 'info', msg: 'Connector - Connecting to raw API gateway: https://api.shop.co/v3...' },
  { time: '09:01:04', level: 'success', msg: 'Connector - Secure HTTP handshake completed successfully. Connection: 200 OK' },
  { time: '09:01:05', level: 'info', msg: 'System - Spawning layout parser agent ocr_worker_01 and ingest agent crawl_worker_04' },
  { time: '09:01:10', level: 'info', msg: 'ocr_worker_01 - Layout parser activated. Scraping layout trees and image nodes...' },
  { time: '09:01:15', level: 'info', msg: 'crawl_worker_04 - Crawler crawler ingest queue initialized (0 items)' },
  { time: '09:01:25', level: 'info', msg: 'crawl_worker_04 - Fetching product batch 1/10 (records 0 - 200,000)' },
  { time: '09:01:45', level: 'info', msg: 'ocr_worker_01 - Document parsing finished. Average speed: 48 documents/sec' },
  { time: '09:02:10', level: 'info', msg: 'crawl_worker_04 - Fetching product batch 2/10 (records 200,000 - 400,000)' },
  { time: '09:02:44', level: 'warn', msg: 'crawl_worker_04 - Remote gateway socket timed out. Preparing automatic retry...' },
  { time: '09:02:46', level: 'success', msg: 'crawl_worker_04 - Scraper reconnected inside 2s. Resuming batch ingestion loop' },
  { time: '09:03:10', level: 'info', msg: 'crawl_worker_04 - Fetching product batch 3/10 (records 400,000 - 600,000)' },
  { time: '09:03:30', level: 'info', msg: 'crawl_worker_04 - Active stream throughput stable: 2,840 records/sec' },
  { time: '09:03:50', level: 'info', msg: 'crawl_worker_04 - Fetching product batch 4/10 (records 600,000 - 800,000)' },
  { time: '09:04:12', level: 'info', msg: 'crawl_worker_04 - Scaling ingest threads. Thread load level: 82%' },
  { time: '09:04:20', level: 'info', msg: 'crawl_worker_04 - Fetching product batch 5/10 (records 800,000 - 1,000,000)' },
  { time: '09:05:00', level: 'info', msg: 'crawl_worker_04 - Fetching product batch 6/10 (records 1,000,000 - 1,200,000)' },
  { time: '09:05:05', level: 'info', msg: 'System - Allocating validation schema_guard_02 and normalizer clean_worker_02' },
  { time: '09:05:15', level: 'info', msg: 'schema_guard_02 - Initializing column integrity validations. Checking 48 fields...' },
  { time: '09:05:22', level: 'warn', msg: 'schema_guard_02 - Out-of-bounds warning: field [price] contains negative value at index 12' },
  { time: '09:05:30', level: 'warn', msg: 'schema_guard_02 - Out-of-bounds warning: field [price] contains negative value at index 45' },
  { time: '09:05:40', level: 'warn', msg: 'schema_guard_02 - Out-of-bounds warning: field [price] contains negative value at index 78' },
  { time: '09:05:45', level: 'warn', msg: 'schema_guard_02 - Rule warning: column [description] has 216 null occurrences (11.7% null rate)' },
  { time: '09:05:50', level: 'success', msg: 'schema_guard_02 - Validation constraints pass: 98.2% compliance index' },
  { time: '09:06:00', level: 'info', msg: 'clean_worker_02 - Normalization worker initialized. Applying cleaning rules' },
  { time: '09:06:15', level: 'info', msg: 'clean_worker_02 - Auto-resolution: negative price rows coerced to absolute float values' },
  { time: '09:06:30', level: 'clean', msg: 'clean_worker_02 - Auto-resolution: filled 216 empty description rows with default string ""' },
  { time: '09:07:05', level: 'info', msg: 'clean_worker_02 - Deduplication pass activated. Scanning compound record hashes...' },
  { time: '09:07:45', level: 'info', msg: 'clean_worker_02 - Scan progress: 1.2M records processed' },
  { time: '09:08:00', level: 'success', msg: 'clean_worker_02 - Deduplication completed. Purged 4,802 duplicate entries' },
  { time: '09:08:30', level: 'info', msg: 'System - Ingestion complete. Allocating file writer s3_export_01' },
  { time: '09:08:55', level: 'info', msg: 's3_export_01 - Encoding final columnar byte structures. Format: Apache Parquet' },
  { time: '09:09:20', level: 'info', msg: 's3_export_01 - Committing output tables to target: s3://dataforge-parquet/prod/ecommerce-crawl-v3/' },
  { time: '09:09:45', level: 'info', msg: 's3_export_01 - Uploading block partition index 1/1 (814.2 MB zipped)' },
  { time: '09:10:00', level: 'success', msg: 's3_export_01 - Target upload finished. Commits completed: 1,872,441 records written' },
  { time: '09:10:02', level: 'success', msg: 'System - Pipeline Ingestion pl_ec_crawl_8321 finished successfully in 00:08:55' }
];

const TIMELINE_STEPS = [
  {
    title: "Source Connected",
    status: "Success",
    time: "09:01 AM",
    runtime: "4s",
    desc: "Established secure connection to ecommerce REST API source using production API tokens.",
    metrics: [
      { label: "API Gateway", val: "https://api.shop.co/v3" },
      { label: "Response Status", val: "200 OK" },
      { label: "Payload Encoding", val: "gzip/json" }
    ],
    logs: [
      "[09:01:00] INFO: Initializing ingestion workflow pl_ec_crawl_8321",
      "[09:01:02] INFO: Connecting to raw API gateway: https://api.shop.co/v3...",
      "[09:01:04] SUCCESS: Secure HTTP handshake completed successfully. Connection: 200 OK"
    ]
  },
  {
    title: "Ingestion & OCR Started",
    status: "Success",
    time: "09:03 AM",
    runtime: "1m 50s",
    desc: "Active document parsing and extraction. Scrapes unstructured metadata blocks and layout grids.",
    metrics: [
      { label: "OCR Nodes Alloc", val: "ocr_worker_01" },
      { label: "Throughput", val: "48 docs/sec" },
      { label: "Memory Usage", val: "840 MB" }
    ],
    logs: [
      "[09:01:05] INFO: Spawning layout parser agent ocr_worker_01",
      "[09:01:10] INFO: Layout parser activated. Scraping layout trees and image nodes...",
      "[09:01:45] INFO: Document parsing finished. Average speed: 48 documents/sec"
    ]
  },
  {
    title: "Agent Extraction Complete",
    status: "Success",
    time: "09:05 AM",
    runtime: "3m 41s",
    desc: "Crawl extraction worker successfully retrieved complete raw product list and features.",
    metrics: [
      { label: "Extractor Engine", val: "crawl_worker_04" },
      { label: "Peak Throughput", val: "2,840 records/s" },
      { label: "Data Volume", val: "814.2 MB raw" }
    ],
    logs: [
      "[09:01:05] INFO: Spawning ingest agent crawl_worker_04",
      "[09:01:25] INFO: Crawler ingest queue initialized (0 items)",
      "[09:02:10] INFO: Fetching product batch 2/10 (records 200,000 - 400,000)",
      "[09:02:44] WARNING: Remote gateway socket timed out. Preparing automatic retry...",
      "[09:02:46] SUCCESS: Scraper reconnected inside 2s. Resuming batch ingestion loop",
      "[09:03:30] INFO: Active stream throughput stable: 2,840 records/sec",
      "[09:05:00] INFO: Fetching product batch 6/10"
    ]
  },
  {
    title: "Schema Validation Complete",
    status: "Success with Warnings",
    time: "09:06 AM",
    runtime: "55s",
    desc: "Autonomous Schema Guard verified the integrity of incoming columns against configured database rules.",
    metrics: [
      { label: "Validation Engine", val: "schema_guard_02" },
      { label: "Constraint Rules", val: "48 checked" },
      { label: "Quality Compliance", val: "98.2%" }
    ],
    logs: [
      "[09:05:05] INFO: Allocating validation schema_guard_02",
      "[09:05:15] INFO: Initializing column integrity validations. Checking 48 fields...",
      "[09:05:22] WARNING: Out-of-bounds warning: field [price] contains negative value at index 12",
      "[09:05:30] WARNING: Out-of-bounds warning: field [price] contains negative value at index 45",
      "[09:05:40] WARNING: Out-of-bounds warning: field [price] contains negative value at index 78",
      "[09:05:45] WARNING: Rule warning: column [description] has 216 null occurrences (11.7% null rate)",
      "[09:05:50] SUCCESS: Validation constraints pass: 98.2% compliance index"
    ]
  },
  {
    title: "Cleaning & Norm Complete",
    status: "Success",
    time: "09:08 AM",
    runtime: "2m 10s",
    desc: "Normalized string structures, standardizing dates, and resolving anomalies detected in validation.",
    metrics: [
      { label: "Cleaner Node", val: "clean_worker_02" },
      { label: "Duplicates Purged", val: "4,802 rows" },
      { label: "Auto-Resolutions", val: "3 coerced, 216 filled" }
    ],
    logs: [
      "[09:05:05] INFO: Allocating normalizer clean_worker_02",
      "[09:06:00] INFO: Normalization worker initialized. Applying cleaning rules",
      "[09:06:15] INFO: Auto-resolution: negative price rows coerced to absolute float values",
      "[09:06:30] INFO: Auto-resolution: filled 216 empty description rows with default string \"\"",
      "[09:07:05] INFO: Deduplication pass activated. Scanning compound record hashes...",
      "[09:08:00] SUCCESS: Deduplication completed. Purged 4,802 duplicate entries"
    ]
  },
  {
    title: "Dataset Generated",
    status: "Success",
    time: "09:10 AM",
    runtime: "1m 30s",
    desc: "Encoded cleaned output buffer to binary Parquet schemas and committed storage to S3 repository.",
    metrics: [
      { label: "Exporter Engine", val: "s3_export_01" },
      { label: "Output Format", val: "Apache Parquet" },
      { label: "Total Upload Size", val: "814.2 MB" }
    ],
    logs: [
      "[09:08:30] INFO: Ingestion complete. Allocating file writer s3_export_01",
      "[09:08:55] INFO: Encoding final columnar byte structures. Format: Apache Parquet",
      "[09:09:20] INFO: Committing output tables to target: s3://dataforge-parquet/prod/ecommerce-crawl-v3/",
      "[09:10:00] SUCCESS: Target upload finished. Commits completed: 1,872,441 records written",
      "[09:10:02] SUCCESS: Pipeline Ingestion pl_ec_crawl_8321 finished successfully in 00:08:55"
    ]
  }
];

const PREVIEW_ROWS = [
  { id: "SKU-48200-A", name: "AuraTech Headphones Pro 10", category: "Audio", price: 144.99, rating: 4.8, stock: 320 },
  { id: "SKU-48201-B", name: "VeloSound Mechanical Keyboard 11", category: "Gaming", price: 84.99, rating: 4.6, stock: 150 },
  { id: "SKU-48202-C", name: "CoreLink Gaming Monitor 12", category: "Electronics", price: 344.99, rating: 4.7, stock: 45 },
  { id: "SKU-48203-A", name: "EchoByte Fitness Band 13", category: "Mobile Access", price: 44.99, rating: 4.2, stock: 610 },
  { id: "SKU-48204-B", name: "NexusWare Multi-Port Hub 14", category: "Office Tech", price: 24.99, rating: 4.5, stock: 1200 }
];

export default function PipelineDetailPage({ pipelineId, projectName, onBack }: PipelineDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'agents' | 'logs' | 'metrics' | 'errors' | 'output'>('overview');
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [logSearch, setLogSearch] = useState('');
  const [logLevel, setLogLevel] = useState<string>('all');
  const [isAutoscroll, setIsAutoscroll] = useState(true);
  const [isRunning, setIsRunning] = useState(true);
  const [runningLogs, setRunningLogs] = useState(MOCK_PIPELINE_LOGS);

  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (isAutoscroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [runningLogs, activeTab, isAutoscroll]);

  // Log filtering
  const filteredLogs = useMemo(() => {
    return runningLogs.filter(log => {
      const matchesLevel = logLevel === 'all' || log.level === logLevel;
      const matchesSearch = !logSearch || log.msg.toLowerCase().includes(logSearch.toLowerCase()) || log.level.toLowerCase().includes(logSearch.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [runningLogs, logLevel, logSearch]);

  const handleRunAgain = () => {
    alert("Re-triggering crawler agents on pipeline " + pipelineId + "...");
    setIsRunning(true);
    setRunningLogs([]);
    let i = 0;
    const timer = setInterval(() => {
      if (i < MOCK_PIPELINE_LOGS.length) {
        setRunningLogs(prev => [...prev, MOCK_PIPELINE_LOGS[i]]);
        i++;
      } else {
        clearInterval(timer);
      }
    }, 200);
  };

  const handlePauseToggle = () => {
    setIsRunning(!isRunning);
    alert(isRunning ? "Pipeline crawl suspended. Workers standing by." : "Pipeline resumed. Ingestion loops re-allocated.");
  };

  const handleExportLogs = () => {
    const logsContent = runningLogs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.msg}`).join('\r\n');
    const blob = new Blob([logsContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pipelineId}_diagnostics.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (confirm("CAUTION: Are you sure you want to permanently delete the pipeline configuration?")) {
      onBack();
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <button onClick={onBack} className="hover:text-text-primary transition-colors flex items-center gap-1">
          History
        </button>
        <span>/</span>
        <span className="text-text-primary font-medium">{projectName}</span>
        <span>/</span>
        <span className="text-accent font-mono">{pipelineId}</span>
      </div>

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight">
              {projectName} Ingest Pipeline
            </h1>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5",
              isRunning ? "bg-accent/10 text-accent" : "bg-white/[0.04] text-text-secondary"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", isRunning ? "bg-accent animate-pulse" : "bg-text-tertiary")} />
              {isRunning ? 'Running' : 'Paused'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-2 text-xs text-text-secondary">
            <div>Pipeline ID: <code className="text-accent bg-white/[0.04] px-1 py-0.5 rounded font-mono">{pipelineId}</code></div>
            <div>Created: <span className="text-text-primary font-medium">June 08, 2026</span></div>
            <div>Owner: <span className="text-text-primary font-medium">Alex Rivera (Data Ops)</span></div>
            <div>Runtime: <span className="text-text-primary font-mono">00:08:55</span></div>
            <div>Last Run: <span className="text-text-primary">2 min ago</span></div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleRunAgain} className="btn btn-outline btn-sm text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Run Again
          </button>
          <button onClick={handlePauseToggle} className="btn btn-outline btn-sm text-xs">
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? 'Pause' : 'Resume'}
          </button>
          <button onClick={handleExportLogs} className="btn btn-outline btn-sm text-xs">
            <Download className="w-3.5 h-3.5" />
            Export Logs
          </button>
          <button onClick={handleDelete} className="btn btn-outline btn-sm text-xs text-error border-error/25 hover:bg-error/10 hover:border-error/50">
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-4 border-b border-border overflow-x-auto scrollbar-none">
        {(['overview', 'timeline', 'agents', 'logs', 'metrics', 'errors', 'output'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-3 text-xs font-semibold capitalize tracking-wide transition-all border-b-2 whitespace-nowrap",
              activeTab === tab 
                ? "border-accent text-accent font-bold" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {tab === 'agents' ? 'Agent Activity' : tab === 'timeline' ? 'Execution Timeline' : tab}
          </button>
        ))}
      </div>

      {/* Tabs Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="min-h-[350px]"
        >
          {/* PANEL: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card relative overflow-hidden p-4 border border-border">
                  <div className="text-xs text-text-secondary">Records Processed</div>
                  <div className="text-xl md:text-2xl font-bold text-text-primary mt-1">1,872,441</div>
                  <div className="text-[10px] text-success mt-1.5 flex items-center gap-1 font-medium">
                    <span>↑</span> 100% crawl completion
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-transparent opacity-35" />
                </div>
                <div className="card relative overflow-hidden p-4 border border-border">
                  <div className="text-xs text-text-secondary">Pipeline Throughput</div>
                  <div className="text-xl md:text-2xl font-bold text-text-primary mt-1">2,840/s</div>
                  <div className="text-[10px] text-accent mt-1.5 flex items-center gap-1 font-medium">
                    Average rate: 2,420 records/sec
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-transparent opacity-35" />
                </div>
                <div className="card relative overflow-hidden p-4 border border-border">
                  <div className="text-xs text-text-secondary">Execution Ingest Runtime</div>
                  <div className="text-xl md:text-2xl font-bold text-text-primary mt-1">00:08:55</div>
                  <div className="text-[10px] text-text-secondary mt-1.5">
                    Target Limit: 00:30:00
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-transparent opacity-35" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card relative overflow-hidden p-4 border border-border">
                  <div className="text-xs text-text-secondary">Job Success Rate</div>
                  <div className="text-xl md:text-2xl font-bold text-success mt-1">100%</div>
                  <div className="text-[10px] text-success mt-1.5">All 6 steps executed successfully</div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-success to-transparent opacity-35" />
                </div>
                <div className="card relative overflow-hidden p-4 border border-border">
                  <div className="text-xs text-text-secondary">Quality Score</div>
                  <div className="text-xl md:text-2xl font-bold text-success mt-1">98.2%</div>
                  <div className="text-[10px] text-success mt-1.5">↑ 0.1 pts above validation margin</div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-success to-transparent opacity-35" />
                </div>
                <div className="card relative overflow-hidden p-4 border border-border">
                  <div className="text-xs text-text-secondary">CPU Cost Estimate</div>
                  <div className="text-xl md:text-2xl font-bold text-text-primary mt-1">$1.42</div>
                  <div className="text-[10px] text-text-secondary mt-1.5">Total consumption: 2.8 Compute-Hrs</div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-transparent opacity-35" />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card border border-border lg:col-span-2 p-5 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase">Live Ingest Rate (Records/s)</h3>
                    <span className="chip chip-success text-[10px]">Active Stream</span>
                  </div>
                  {/* SVG Chart */}
                  <div className="h-36 w-full flex items-end">
                    <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF8A00" stopOpacity="0.2"/>
                          <stop offset="100%" stopColor="#FF8A00" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      {/* Grid lines */}
                      <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                      <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                      <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                      {/* Line */}
                      <path
                        d="M 0 100 Q 40 80 80 90 T 160 50 T 240 60 T 320 30 T 400 40 T 480 15 L 500 15 L 500 120 L 0 120 Z"
                        fill="url(#chart-grad)"
                      />
                      <path
                        d="M 0 100 Q 40 80 80 90 T 160 50 T 240 60 T 320 30 T 400 40 T 480 15 L 500 15"
                        fill="none"
                        stroke="#FF8A00"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="500" cy="15" r="4" fill="#FF8A00" stroke="#FFFFFF" strokeWidth="1" />
                    </svg>
                  </div>
                  <div className="flex justify-between text-[10px] text-text-tertiary mt-2">
                    <span>09:01 AM Start</span>
                    <span>09:05 AM Peak</span>
                    <span>09:10 AM Completed</span>
                  </div>
                </div>

                <div className="card border border-border p-5 flex flex-col justify-between">
                  <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase mb-4">Pipeline Configuration</h3>
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-text-secondary block mb-1">Stream Connector</span>
                      <div className="flex items-center gap-2 font-semibold text-text-primary">
                        <span className="chip chip-cyan text-[10px]">Web Scraper</span>
                        <span className="font-mono text-[11px] text-text-secondary">https://api.shop.co/v3</span>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3">
                      <span className="text-text-secondary block mb-1">Concurrency Settings</span>
                      <span className="font-medium text-text-primary">4 Concurrent Threads (Auto-scale Active)</span>
                    </div>
                    <div className="border-t border-border pt-3">
                      <span className="text-text-secondary block mb-1">Target Repository</span>
                      <span className="font-mono text-[10px] text-text-secondary break-all">
                        s3://dataforge-parquet/prod/ecommerce-crawl-v3/
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PANEL: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Stepper list */}
              <div className="card border border-border p-5 space-y-4 lg:col-span-1">
                <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase mb-2">Step Milestones</h3>
                <div className="relative border-l-2 border-border pl-5 space-y-6">
                  {TIMELINE_STEPS.map((step, idx) => (
                    <div
                      key={idx}
                      onClick={() => setTimelineIndex(idx)}
                      className={cn(
                        "relative cursor-pointer group transition-all",
                        timelineIndex === idx ? "opacity-100" : "opacity-60 hover:opacity-100"
                      )}
                    >
                      {/* Step marker dot */}
                      <span className={cn(
                        "absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background transition-all",
                        timelineIndex === idx 
                          ? "bg-accent shadow-[0_0_8px_#FF8A00]" 
                          : "bg-success"
                      )} />
                      <div className="text-xs font-semibold text-text-primary flex items-center justify-between">
                        <span>{step.title}</span>
                        <span className="text-[10px] text-text-tertiary font-mono">{step.time}</span>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1 group-hover:text-text-primary transition-colors">
                        {step.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Detail box */}
              <div className="lg:col-span-2 card border border-border bg-white/[0.01] p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">{TIMELINE_STEPS[timelineIndex].title}</h3>
                    <span className="text-xs text-text-secondary mt-0.5 block">
                      Duration: {TIMELINE_STEPS[timelineIndex].runtime} • Executed at {TIMELINE_STEPS[timelineIndex].time}
                    </span>
                  </div>
                  <span className={cn(
                    "chip text-[10px]",
                    TIMELINE_STEPS[timelineIndex].status.toLowerCase().includes('warning') 
                      ? "chip-running" 
                      : "chip-success"
                  )}>
                    {TIMELINE_STEPS[timelineIndex].status}
                  </span>
                </div>

                <div className="py-4 space-y-5">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {TIMELINE_STEPS[timelineIndex].desc}
                  </p>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Step Metrics</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {TIMELINE_STEPS[timelineIndex].metrics.map((m, mIdx) => (
                        <div key={mIdx} className="card p-3 border border-border bg-background/50">
                          <span className="text-[10px] text-text-tertiary block uppercase">{m.label}</span>
                          <span className="text-xs font-semibold text-text-primary mt-1 block font-mono">{m.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Diagnostics Stream</h4>
                    <div className="bg-[#020202] border border-border rounded-lg p-3 font-mono text-[11px] text-text-muted space-y-1 max-h-40 overflow-y-auto">
                      {TIMELINE_STEPS[timelineIndex].logs.map((log, lIdx) => (
                        <div key={lIdx} className="whitespace-pre-wrap leading-relaxed">{log}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PANEL: AGENTS */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase">Active worker nodes topology</h3>
                  <p className="text-xs text-text-tertiary mt-0.5">Pipeline data processing pipeline agent workload levels</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <span className="w-1.5 h-1.5 bg-success rounded-full animate-ping" />
                  Live Agents Stream
                </div>
              </div>

              {/* Worker agent nodes grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: "ocr_worker_01", name: "OCR Parsing Agent", status: "processing", rate: "48 docs/sec", latency: "114ms", queue: "0 items" },
                  { id: "crawl_worker_04", name: "Extractor Agent", status: "processing", rate: "2,840 rec/s", latency: "24ms", queue: "0 items" },
                  { id: "schema_guard_02", name: "Validator Agent", status: "processing", rate: "2,840 rec/s", latency: "4ms", queue: "0 items" },
                  { id: "clean_worker_02", name: "Cleaner Agent", status: "processing", rate: "2,840 rec/s", latency: "8ms", queue: "0 items" },
                  { id: "insights_worker_01", name: "EDA Agent", status: "idle", rate: "0/s", latency: "--", queue: "0 items" },
                  { id: "s3_export_01", name: "Export Agent", status: "idle", rate: "0/s", latency: "--", queue: "0 items" }
                ].map(agent => (
                  <div key={agent.id} className="card border border-border p-4 relative overflow-hidden hover:border-accent/40 transition-all group">
                    <span className={cn(
                      "absolute top-4 right-4 w-2 h-2 rounded-full",
                      agent.status === 'processing' 
                        ? "bg-success shadow-[0_0_8px_#22C55E] animate-pulse" 
                        : "bg-warning shadow-[0_0_8px_#F59E0B]"
                    )} />
                    <div className="text-xs font-bold text-text-primary">{agent.name}</div>
                    <code className="text-[10px] text-text-tertiary mt-0.5 block font-mono">{agent.id}</code>
                    
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Status:</span>
                        <span className={cn("font-medium", agent.status === 'processing' ? "text-success" : "text-warning")}>
                          ● {agent.status === 'processing' ? 'Processing' : 'Idle'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Throughput:</span>
                        <span className="text-text-primary font-medium">{agent.rate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Latency:</span>
                        <span className="text-text-primary font-medium">{agent.latency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Queue depth:</span>
                        <span className="text-text-primary font-medium">{agent.queue}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PANEL: LOGS */}
          {activeTab === 'logs' && (
            <div className="card border border-border flex flex-col h-[480px]">
              {/* Terminal Header controls */}
              <div className="flex items-center justify-between p-3 border-b border-border flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <Terminal className="w-4 h-4 text-text-secondary" />
                  <span className="text-xs font-bold text-text-primary">Terminal Log Console</span>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <select 
                    value={logLevel} 
                    onChange={e => setLogLevel(e.target.value)}
                    className="input w-36 px-2 py-1 text-xs"
                  >
                    <option value="all">ALL SEVERITIES</option>
                    <option value="info">INFO</option>
                    <option value="warn">WARNING</option>
                    <option value="success">SUCCESS</option>
                  </select>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-text-tertiary" />
                    <input 
                      type="search" 
                      placeholder="Search log records..." 
                      value={logSearch}
                      onChange={e => setLogSearch(e.target.value)}
                      className="input w-44 pl-7 pr-2 py-1 text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary select-none">
                    <input 
                      type="checkbox" 
                      checked={isAutoscroll}
                      onChange={e => setIsAutoscroll(e.target.checked)}
                      className="rounded accent-accent border-border bg-white/[0.04]"
                    />
                    Auto-scroll
                  </label>
                </div>
              </div>

              {/* Black Terminal Screen */}
              <div 
                ref={terminalRef}
                className="bg-[#030303] flex-1 overflow-y-auto p-4 font-mono text-[11px] text-text-muted space-y-1.5"
              >
                {filteredLogs.length === 0 ? (
                  <div className="text-text-tertiary text-center py-12">No diagnostics logs match criteria.</div>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-4 items-start leading-relaxed">
                      <span className="text-text-tertiary shrink-0 select-none">{log.time}</span>
                      <span className={cn(
                        "font-bold shrink-0 select-none",
                        log.level === 'warn' && "text-warning",
                        log.level === 'success' && "text-success",
                        log.level === 'info' && "text-blue-400"
                      )}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className="text-text-primary break-all">{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PANEL: METRICS */}
          {activeTab === 'metrics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Buffer queues load */}
              <div className="card border border-border p-5 space-y-4">
                <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase">Agent Memory Queue Backlog</h3>
                <div className="space-y-4">
                  {[
                    { label: "OCR Parsing Buffer Load", val: "0 items (Healthy)", width: "0%" },
                    { label: "Extractor Backlog Queue", val: "0 items (Healthy)", width: "0%" },
                    { label: "Cleaner Normalization Queue", val: "0 items (Healthy)", width: "0%" }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">{item.label}</span>
                        <span className="font-semibold text-text-primary">{item.val}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full" style={{ width: item.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error balances distribution */}
              <div className="card border border-border p-5 flex flex-col justify-between">
                <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase mb-2">Execution Diagnostic Distributions</h3>
                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-text-secondary">Validation Constraint Failures</span>
                    <span className="font-mono text-warning font-semibold">3 negative price records (corrected)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-text-secondary">Extraction Completeness Warnings</span>
                    <span className="font-mono text-text-secondary">216 null descriptions</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-text-secondary">Scraper Connection Retries</span>
                    <span className="font-mono text-success font-semibold">1 socket retry attempt (Resolved)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PANEL: ERRORS */}
          {activeTab === 'errors' && (
            <div className="card border border-border p-5 space-y-4">
              <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase mb-2">Warnings & Resolution Logs</h3>
              <div className="space-y-3">
                {[
                  {
                    type: 'warn',
                    icon: AlertTriangle,
                    color: 'text-warning border-warning/20 bg-warning/5',
                    title: "Out-Of-Bounds Validation Check failed in 'price' field",
                    desc: "Three records contained negative values for the listing price (SKU-48212-A at index 12, SKU-48245-B at index 45, SKU-48278-C at index 78).",
                    resol: "Coerced to absolute values during cleaning step."
                  },
                  {
                    type: 'info',
                    icon: Info,
                    color: 'text-text-secondary border-border bg-white/[0.01]',
                    title: "Completeness boundary warning in 'description'",
                    desc: "216 records contained empty description properties (11.7% of batch). This is within standard threshold boundaries of 15%.",
                    resol: "Filled with default empty strings."
                  },
                  {
                    type: 'success',
                    icon: CheckCircle2,
                    color: 'text-success border-success/20 bg-success/5',
                    title: "Network scraper connection timeout (pl_ec_crawl_8321)",
                    desc: "Socket timed out at 09:02:44 during batch 2/10 ingestion.",
                    resol: "Scraper agent auto-retried and successfully reconnected inside 2s. No data packets lost."
                  }
                ].map((err, idx) => {
                  const Icon = err.icon;
                  return (
                    <div key={idx} className={cn("p-4 border rounded-lg space-y-2", err.color)}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4.5 h-4.5" />
                        <h4 className="text-xs font-bold text-text-primary">{err.title}</h4>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed pl-6">{err.desc}</p>
                      <div className="text-[10px] text-accent font-mono pl-6 font-semibold uppercase">
                        [Resolution]: {err.resol}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PANEL: OUTPUT */}
          {activeTab === 'output' && (
            <div className="space-y-6">
              {/* Target File details */}
              <div className="card border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-text-primary">ecommerce-crawl-v3.parquet</div>
                  <div className="text-xs text-text-secondary mt-1">
                    Compiled Target: 1,872,441 records • 48 fields • 98.2% quality score
                  </div>
                </div>
                <button 
                  onClick={() => alert("Redirecting to Dataset Detail Page for ds_ec_crawl_92e85a...")} 
                  className="btn btn-primary btn-sm self-start sm:self-auto text-xs"
                >
                  View Dataset details
                  <ExternalLink className="w-3 h-3 ml-1" />
                </button>
              </div>

              {/* Preview table */}
              <div className="card border border-border overflow-hidden">
                <div className="p-3 border-b border-border">
                  <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase">Target Preview (First 5 Rows)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/[0.01] text-text-muted border-b border-border">
                        <th className="p-3 font-semibold uppercase">Product ID</th>
                        <th className="p-3 font-semibold uppercase">Name</th>
                        <th className="p-3 font-semibold uppercase">Category</th>
                        <th className="p-3 font-semibold uppercase">Price</th>
                        <th className="p-3 font-semibold uppercase">Rating</th>
                        <th className="p-3 font-semibold uppercase">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {PREVIEW_ROWS.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="p-3 font-mono text-text-secondary font-semibold">{row.id}</td>
                          <td className="p-3 font-medium">{row.name}</td>
                          <td className="p-3"><span className="chip chip-cyan text-[9px]">{row.category}</span></td>
                          <td className="p-3 font-mono">${row.price.toFixed(2)}</td>
                          <td className="p-3 font-mono">⭐ {row.rating.toFixed(1)}</td>
                          <td className="p-3 font-mono">{row.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
