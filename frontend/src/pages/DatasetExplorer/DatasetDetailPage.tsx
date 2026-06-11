import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Download, 
  Copy, 
  Share2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  Table, 
  LineChart, 
  FileText, 
  Search, 
  Layers,
  Clock,
  User,
  Tag,
  Calendar
} from 'lucide-react';

interface DatasetDetailPageProps {
  datasetId: string;
  onBack: () => void;
}

// --- Mock Schema Fields ---
const mockSchemaFields = [
  { name: 'product_id', type: 'string', nullable: false, unique: '100% unique', desc: 'Unique alphanumeric identifier for the product SKU.' },
  { name: 'name', type: 'string', nullable: false, unique: '99.9% unique', desc: 'Commercial name of the product item.' },
  { name: 'price', type: 'double', nullable: false, unique: 'N/A', desc: 'Active listing price in USD. Positive numbers only.' },
  { name: 'category', type: 'string', nullable: false, unique: '24 distinct', desc: 'General product department classification.' },
  { name: 'description', type: 'string', nullable: true, unique: 'N/A', desc: 'Marketing copy text and feature specifications.' },
  { name: 'rating', type: 'double', nullable: true, unique: 'N/A', desc: 'Aggregate customer star rating from 0.0 to 5.0.' },
  { name: 'image_url', type: 'string', nullable: true, unique: '99.7% unique', desc: 'Secure direct CDN links to image thumbnail assets.' },
  { name: 'stock_count', type: 'integer', nullable: false, unique: 'N/A', desc: 'Real-time inventory count currently available at warehouse.' },
  { name: 'brand', type: 'string', nullable: false, unique: 'N/A', desc: 'Manufacturer or label brand name.' },
  { name: 'created_at', type: 'timestamp', nullable: false, unique: '99.9% unique', desc: 'Audit timestamp indicating when raw crawled record was ingested.' }
];

// --- Mock Data Preview Data Ingestion ---
interface PreviewRecord {
  product_id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  stock_count: number;
  brand: string;
  created_at: string;
}

const generateMockData = (): PreviewRecord[] => {
  const data: PreviewRecord[] = [];
  const templates = [
    { name: 'Wireless Headphones Pro', category: 'Audio', price: 149.99, rating: 4.8, stock: 320, brand: 'VeloSound' },
    { name: 'Ergonomic Mechanical Keyboard', category: 'Gaming', price: 89.99, rating: 4.6, stock: 150, brand: 'ApexGear' },
    { name: 'Ultra-wide Gaming Monitor 34"', category: 'Electronics', price: 349.99, rating: 4.7, stock: 45, brand: 'AuraTech' },
    { name: 'Smart Fitness Band v2', category: 'Mobile Access', price: 49.99, rating: 4.2, stock: 610, brand: 'NexusWare' },
    { name: 'USB-C Multi-Port Hub', category: 'Office Tech', price: 29.99, rating: 4.5, stock: 1200, brand: 'CoreLink' },
    { name: 'MagSafe Wireless Charger', category: 'Power Systems', price: 39.99, rating: 4.4, stock: 850, brand: 'CoreLink' },
    { name: 'Noise Cancelling Earbuds', category: 'Audio', price: 119.99, rating: 4.5, stock: 240, brand: 'VeloSound' },
    { name: 'Dual-Device Charging Dock', category: 'Power Systems', price: 59.99, rating: 4.3, stock: 180, brand: 'CoreLink' },
    { name: 'LED Smart Desk Lamp', category: 'Office Tech', price: 34.99, rating: 4.1, stock: 420, brand: 'EchoByte' },
    { name: 'Mechanical Numpad Keypad', category: 'Gaming', price: 19.99, rating: 4.4, stock: 90, brand: 'ApexGear' }
  ];

  for (let i = 0; i < 100; i++) {
    const template = templates[i % templates.length];
    const isAnomaly = (i === 12 || i === 45 || i === 78);
    const price = isAnomaly ? -12.99 : parseFloat((template.price + (i % 7) * 4.5 - 5.0).toFixed(2));
    const rating = isAnomaly ? 6.2 : parseFloat((template.rating - (i % 5) * 0.1).toFixed(1));
    const randId = `SKU-${48200 + i}-${['A', 'B', 'C'][i % 3]}`;

    data.push({
      product_id: randId,
      name: `${template.brand} ${template.name.split(' ').slice(1).join(' ')} ${10 + (i % 5)}`,
      category: template.category,
      price: price,
      rating: rating,
      stock_count: template.stock + (i * 8) - (i % 7) * 15,
      brand: template.brand,
      created_at: new Date(Date.now() - (i * 3600000)).toISOString().replace('T', ' ').substring(0, 19)
    });
  }
  return data;
};

const mockPreviewData = generateMockData();
const previewPageSize = 10;

export default function DatasetDetailPage({ datasetId, onBack }: DatasetDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'preview' | 'quality' | 'lineage' | 'export'>('overview');
  
  // Tab-specific filters & states
  const [schemaSearch, setSchemaSearch] = useState('');
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'with_issues' | 'high_rating' | 'low_stock'>('all');
  const [previewPage, setPreviewPage] = useState(1);
  const [isPreviewScanning, setIsPreviewScanning] = useState(false);
  
  // Export states
  const [exportHistory, setExportHistory] = useState([
    { file: 'ds_ec_crawl_92e85a_csv.gz', time: 'June 11, 2026 11:20 AM', format: 'CSV', size: '142.4 MB', trigger: 'Alex Rivera', status: 'Downloaded' },
    { file: 'ds_ec_crawl_92e85a_parquet.zip', time: 'June 10, 2026 04:45 PM', format: 'Parquet', size: '86.8 MB', trigger: 'System (Auto-Sync)', status: 'Uploaded S3' }
  ]);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Canvas ref for chart
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Redraw chart when in Overview Tab
  useEffect(() => {
    if (activeTab !== 'overview' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const chartData = [2100, 2250, 2400, 2350, 2480, 2410, 2550, 2600, 2750, 2840];
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement?.offsetWidth || 500;
    const H = 140;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const max = Math.max(...chartData);
    const min = Math.min(...chartData) * 0.95;
    const range = max - min || 1;
    const pad = { t: 10, r: 10, b: 24, l: 48 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    // Get current design token colors
    const borderCol = 'rgba(255, 255, 255, 0.06)';
    const textCol = '#71717A';

    // Grid Lines
    [0, 0.5, 1].forEach(frac => {
      const y = pad.t + (1 - frac) * innerH;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      const val = Math.round(min + frac * range);
      ctx.fillStyle = textCol;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${val}/s`, pad.l - 8, y + 3);
    });

    // Drawing Curve
    ctx.save();
    ctx.beginPath();
    chartData.forEach((v, i) => {
      const x = pad.l + (i / (chartData.length - 1)) * innerW;
      const y = pad.t + (1 - (v - min) / range) * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#FF7A00';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Fill Gradient area
    ctx.lineTo(pad.l + innerW, pad.t + innerH);
    ctx.lineTo(pad.l, pad.t + innerH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + innerH);
    grad.addColorStop(0, 'rgba(255,122,0,0.15)');
    grad.addColorStop(1, 'rgba(255,122,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Draw End Node Dot
    chartData.forEach((v, i) => {
      if (i === chartData.length - 1) {
        const x = pad.l + (i / (chartData.length - 1)) * innerW;
        const y = pad.t + (1 - (v - min) / range) * innerH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF7A00';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [activeTab]);

  // Copy ID trigger
  const handleCopyId = () => {
    navigator.clipboard.writeText('ds_ec_crawl_92e85a');
    alert('Dataset ID copied to clipboard: ds_ec_crawl_92e85a');
  };

  // Quick Action: Export trigger
  const handleQuickExport = (format: string) => {
    alert(`Processing quick-export in background. Target format: ${format.toUpperCase()}`);
  };

  // Quick Action: Share trigger
  const handleShare = () => {
    alert('Link to details page workspace copied to clipboard. Secure role validation enforced for external sharing.');
  };

  // Quick Action: Delete trigger
  const handleDelete = () => {
    const consent = confirm('CAUTION: You are about to permanently delete the active schema and delete compiled S3 Parquet tables for ecommerce-crawl-v3. This action CANNOT be undone. Are you sure you want to proceed?');
    if (consent) {
      alert('Mock Request Submitted: Dataset deletion request added to agent job queue.');
      onBack();
    }
  };

  // Full Export Panel download triggers
  const handleExportDownload = (format: string) => {
    if (isExporting) return;
    setIsExporting(format);

    // Add temporary loader log row
    const timestamp = new Date().toLocaleString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });

    const newRowId = Math.random().toString();
    const tempRow = {
      id: newRowId,
      file: `ds_ec_crawl_92e85a_downloading.${format.toLowerCase()}`,
      time: timestamp,
      format,
      size: '--',
      trigger: 'Alex Rivera',
      status: 'Preparing file...'
    };

    setExportHistory(prev => [tempRow, ...prev]);

    // Simulate S3 Packaging download complete
    setTimeout(() => {
      setExportHistory(prev => 
        prev.map(row => 
          row.file.includes('downloading') && row.format === format
            ? { ...row, file: `ds_ec_crawl_92e85a_${format.toLowerCase()}.gz`, size: format === 'Parquet' ? '86.8 MB' : '142.4 MB', status: 'Downloaded' }
            : row
        )
      );
      setIsExporting(null);
      alert(`Download completed for ${format} package. File: ds_ec_crawl_92e85a_${format.toLowerCase()}.gz`);
    }, 1800);
  };

  // --- Search / Filter Data Processing ---
  // Schema Filtering
  const filteredSchema = mockSchemaFields.filter(f => 
    f.name.toLowerCase().includes(schemaSearch.toLowerCase()) ||
    f.type.toLowerCase().includes(schemaSearch.toLowerCase()) ||
    f.desc.toLowerCase().includes(schemaSearch.toLowerCase())
  );

  // Preview filtering
  const handlePreviewFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsPreviewScanning(true);
    setPreviewFilter(e.target.value as any);
    setPreviewPage(1);
    setTimeout(() => setIsPreviewScanning(false), 250);
  };

  const handlePreviewSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewSearch(e.target.value);
    setPreviewPage(1);
  };

  let processedPreview = [...mockPreviewData];
  if (previewFilter === 'with_issues') {
    processedPreview = processedPreview.filter(r => r.price < 0 || r.rating > 5);
  } else if (previewFilter === 'high_rating') {
    processedPreview = processedPreview.filter(r => r.rating >= 4.5);
  } else if (previewFilter === 'low_stock') {
    processedPreview = processedPreview.filter(r => r.price < 50.00);
  }

  if (previewSearch.trim()) {
    const q = previewSearch.toLowerCase().trim();
    processedPreview = processedPreview.filter(r => 
      r.product_id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q)
    );
  }

  const previewTotalPages = Math.ceil(processedPreview.length / previewPageSize) || 1;
  const previewStartIdx = (previewPage - 1) * previewPageSize;
  const previewEndIdx = Math.min(previewStartIdx + previewPageSize, processedPreview.length);
  const pagePreviewRows = processedPreview.slice(previewStartIdx, previewEndIdx);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-mono">
        <button 
          onClick={onBack}
          className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Datasets
        </button>
        <span className="text-text-muted">/</span>
        <span className="text-text-primary font-semibold">ecommerce-crawl-v3</span>
      </div>

      {/* Detail Metadata Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 pb-1">
        <div className="space-y-2 max-w-4xl">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
              {datasetId}
            </h1>
            <span className="chip chip-live shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Running
            </span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            High-fidelity crawl of active e-commerce catalogs including product SKUs, pricing distributions, descriptions, ratings, and image assets.
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-[11px] font-mono text-text-tertiary">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-text-muted" />
              <span>Owner:</span>
              <span className="text-text-secondary font-semibold">Alex Rivera (Data Ops)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span>Created:</span>
              <span className="text-text-secondary">June 08, 2026</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-text-muted" />
              <span>Updated:</span>
              <span className="text-text-secondary">2 min ago</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-text-muted" />
              <span>ID:</span>
              <code className="text-accent bg-background-tertiary px-1.5 py-0.5 rounded border border-white/[0.04]">
                ds_ec_crawl_92e85a
              </code>
              <button 
                onClick={handleCopyId}
                className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                title="Copy ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button 
            onClick={() => handleQuickExport('csv')}
            className="btn btn-outline btn-sm text-[12px] font-medium"
          >
            Export CSV
          </button>
          <button 
            onClick={() => handleQuickExport('json')}
            className="btn btn-outline btn-sm text-[12px] font-medium"
          >
            Export JSON
          </button>
          <button 
            onClick={handleShare}
            className="btn btn-outline btn-sm text-[12px] font-medium"
          >
            <Share2 className="w-3.5 h-3.5 mr-1" />
            Share
          </button>
          <button 
            onClick={handleDelete}
            className="btn btn-outline btn-sm text-[12px] font-medium text-danger border-danger/20 hover:bg-danger/5 hover:border-danger/40"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs Selector Bar */}
      <div className="flex items-center gap-6 border-b border-white/[0.06] overflow-x-auto scrollbar-none shrink-0">
        {[
          { id: 'overview', label: 'Overview', icon: Database },
          { id: 'schema', label: 'Schema', icon: Table },
          { id: 'preview', label: 'Data Preview', icon: FileText },
          { id: 'quality', label: 'Quality', icon: LineChart },
          { id: 'lineage', label: 'Lineage', icon: Layers },
          { id: 'export', label: 'Export', icon: Download }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                group flex items-center gap-2 py-3 border-b-2 font-mono text-[11px] font-semibold tracking-wide cursor-pointer transition-all duration-200
                ${isActive 
                  ? 'border-accent text-accent' 
                  : 'border-transparent text-text-secondary hover:text-text-primary'
                }
              `}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels content */}
      <div className="space-y-6">
        
        {/* OVERVIEW PANEL */}
        {activeTab === 'overview' && (
          <motion.div 
            initial={{ opacity: 0, y: 4 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6"
          >
            {/* KPI metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Total Records', val: '1,872,441', delta: '↑ 8,400 last batch (1 hr ago)', type: 'accent' },
                { title: 'Total Columns', val: '48 Columns', delta: '2 auto-inferred on import', type: 'info' },
                { title: 'Dataset Size', val: '814.2 MB', delta: 'Compressed Parquet format', type: 'cyan' },
                { title: 'Quality Score', val: '98.2%', delta: '↑ 0.1 pts from previous crawl', type: 'success' },
                { title: 'Missing Values', val: '0.8%', delta: 'Below anomaly threshold (1.5%)', type: 'warning' },
                { title: 'Last Refresh', val: '2 min ago', delta: 'Frequency: Hourly schedule', type: 'accent' }
              ].map((card, idx) => (
                <div key={idx} className="stat-card relative overflow-hidden group">
                  <span className="stat-label">{card.title}</span>
                  <span 
                    className="stat-value block mt-1"
                    style={{ 
                      color: card.type === 'success' ? 'var(--color-success)' : card.type === 'warning' ? 'var(--color-warning)' : 'inherit'
                    }}
                  >
                    {card.val}
                  </span>
                  <span className="stat-delta mt-1 block">{card.delta}</span>
                  <div 
                    className={`
                      absolute bottom-0 left-0 right-0 h-[3px] opacity-20 transition-all duration-300 group-hover:opacity-40
                      ${card.type === 'success' ? 'bg-success' : card.type === 'warning' ? 'bg-warning' : card.type === 'info' ? 'bg-info' : card.type === 'cyan' ? 'bg-cyan' : 'bg-accent'}
                    `}
                  />
                </div>
              ))}
            </div>

            {/* Throughput chart and specs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="panel lg:col-span-2">
                <div className="panel-header justify-between">
                  <span className="t-h3 font-semibold text-text-primary">Throughput Performance (rec/s)</span>
                  <span className="chip chip-live">
                    <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                    Live stream
                  </span>
                </div>
                <div className="panel-body p-4">
                  <div className="h-[140px] relative">
                    <canvas ref={canvasRef} />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-text-tertiary mt-2">
                    <span>2 hours ago</span>
                    <span>1 hour ago</span>
                    <span>Just now (2,840 rec/s)</span>
                  </div>
                </div>
              </div>

              {/* System Diagnostics specs */}
              <div className="panel">
                <div className="panel-header">
                  <span className="t-h3 font-semibold text-text-primary font-mono text-[12px]">System Diagnostics</span>
                </div>
                <div className="panel-body p-4 space-y-4 font-mono text-[11px]">
                  <div>
                    <span className="text-text-muted text-[10px] uppercase tracking-wider block">Ingestion Source</span>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="badge badge-info text-[9px]">Web Scraper API</span>
                      <span className="text-text-secondary truncate">https://api.shop.co/v3</span>
                    </div>
                  </div>
                  <hr className="border-white/[0.04]" />
                  <div>
                    <span className="text-text-muted text-[10px] uppercase tracking-wider block">Active Processing Agent</span>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="badge badge-primary text-[9px]">Crawler-Agent-04</span>
                      <span className="text-success flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        Active
                      </span>
                    </div>
                  </div>
                  <hr className="border-white/[0.04]" />
                  <div>
                    <span className="text-text-muted text-[10px] uppercase tracking-wider block">Target Storage Directory</span>
                    <div className="text-text-tertiary mt-1.5 leading-relaxed break-all">
                      s3://dataforge-parquet/prod/ecommerce-crawl-v3/
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* SCHEMA TAB PANEL */}
        {activeTab === 'schema' && (
          <motion.div 
            initial={{ opacity: 0, y: 4 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="panel"
          >
            <div className="panel-header justify-between flex-wrap gap-4">
              <span className="t-h3 font-semibold text-text-primary">Schema Fields Definition</span>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="search" 
                    value={schemaSearch}
                    onChange={(e) => setSchemaSearch(e.target.value)}
                    placeholder="Filter fields..." 
                    className="input pl-9 pr-3 py-1.5 text-xs w-[180px]"
                  />
                </div>
                <span className="badge badge-muted font-mono text-[10px]">
                  {filteredSchema.length} fields
                </span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Data Type</th>
                    <th>Nullable</th>
                    <th>Unique</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchema.length > 0 ? (
                    filteredSchema.map((field, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                        <td>
                          <span className="font-mono text-text-primary font-semibold text-[12px]">{field.name}</span>
                        </td>
                        <td>
                          <span className="badge badge-info font-mono text-[10px]">{field.type}</span>
                        </td>
                        <td>
                          <span className={`badge text-[10px] font-mono mr-2 ${field.nullable ? 'badge-warn' : 'badge-ok'}`}>
                            {field.nullable ? 'Nullable' : 'Required'}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-[12px] text-success font-medium">{field.unique}</span>
                        </td>
                        <td className="text-text-secondary text-sm">
                          {field.desc}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-text-muted text-sm font-mono">
                        No schema fields match the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* DATA PREVIEW TAB PANEL */}
        {activeTab === 'preview' && (
          <motion.div 
            initial={{ opacity: 0, y: 4 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="panel"
          >
            <div className="panel-header justify-between flex-wrap gap-4">
              <div>
                <span className="t-h3 font-semibold text-text-primary">First 100 Records Preview</span>
                <p className="text-[11px] text-text-muted mt-1 leading-relaxed">Showing real-time parsed entries. Complete raw dataset is accessible via the Export panel.</p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <select 
                  value={previewFilter}
                  onChange={handlePreviewFilterChange}
                  className="input px-2.5 py-1.5 text-xs bg-background border-white/[0.06] text-text-secondary focus:border-accent"
                >
                  <option value="all">All Records</option>
                  <option value="with_issues">With Issues</option>
                  <option value="high_rating">Rating &gt;= 4.5</option>
                  <option value="low_stock">Price &lt; 50.00</option>
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="search" 
                    value={previewSearch}
                    onChange={handlePreviewSearchChange}
                    placeholder="Search preview data..." 
                    className="input pl-9 pr-3 py-1.5 text-xs w-[180px]"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto relative">
              {/* Scan effect */}
              {isPreviewScanning && (
                <div className="table-scan-overlay" style={{ display: 'block' }}>
                  <div className="table-scan-line" />
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Rating</th>
                    <th>Stock</th>
                    <th>Brand</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {pagePreviewRows.length > 0 ? (
                    pagePreviewRows.map((row, idx) => {
                      const isPriceAnomaly = row.price < 0;
                      const isRatingAnomaly = row.rating > 5;
                      return (
                        <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                          <td>
                            <span className="font-mono text-[12px] font-semibold text-text-primary">{row.product_id}</span>
                          </td>
                          <td className="text-text-primary font-medium">{row.name}</td>
                          <td>
                            <span className="badge badge-muted text-[10px] font-mono">{row.category}</span>
                          </td>
                          <td className="font-mono text-[12px]">
                            {isPriceAnomaly ? (
                              <span className="text-danger font-semibold flex items-center gap-1">
                                ${row.price}
                                <span className="badge badge-err text-[8px] px-1 py-0 border-none">negative</span>
                              </span>
                            ) : (
                              <span>${row.price.toFixed(2)}</span>
                            )}
                          </td>
                          <td className="font-mono text-[12px]">
                            {isRatingAnomaly ? (
                              <span className="text-danger font-semibold flex items-center gap-1">
                                {row.rating}
                                <span className="badge badge-err text-[8px] px-1 py-0 border-none">out range</span>
                              </span>
                            ) : (
                              <span>⭐ {row.rating.toFixed(1)}</span>
                            )}
                          </td>
                          <td className="font-mono text-[12px]">
                            <span className={row.stock_count < 100 ? 'text-warning font-semibold' : 'text-text-secondary'}>
                              {row.stock_count}
                            </span>
                          </td>
                          <td className="text-text-secondary text-sm">{row.brand}</td>
                          <td>
                            <span className="font-mono text-[11px] text-text-tertiary">{row.created_at}</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-text-muted text-sm font-mono">
                        No records match your search or filter options.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {processedPreview.length > 0 && (
              <div className="flex items-center justify-between p-4 border-t border-white/[0.06] text-xs font-mono text-text-secondary">
                <div>
                  Showing {previewStartIdx + 1}-{previewEndIdx} of {processedPreview.length} rows
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={previewPage === 1}
                    onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                    className="btn btn-outline btn-sm px-2.5 py-1 text-[11px] disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: Math.min(5, previewTotalPages) }).map((_, i) => {
                    // Stagger numbers surrounding active page
                    let pageNum = i + 1;
                    if (previewPage > 3) {
                      pageNum = previewPage - 3 + i;
                    }
                    if (pageNum + (4 - i) > previewTotalPages) {
                      pageNum = Math.max(1, previewTotalPages - 4 + i);
                    }
                    if (pageNum > previewTotalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPreviewPage(pageNum)}
                        className={`btn btn-sm px-2.5 py-1 text-[11px] ${pageNum === previewPage ? 'btn-primary' : 'btn-outline'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    disabled={previewPage === previewTotalPages}
                    onClick={() => setPreviewPage(p => Math.min(previewTotalPages, p + 1))}
                    className="btn btn-outline btn-sm px-2.5 py-1 text-[11px] disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* QUALITY PANEL */}
        {activeTab === 'quality' && (
          <motion.div 
            initial={{ opacity: 0, y: 4 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Circular Radial Quality Score */}
              <div className="panel">
                <div className="panel-header">
                  <span className="t-h3 font-semibold text-text-primary">Quality Verification Gauge</span>
                </div>
                <div className="panel-body p-5 flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative w-[120px] h-[120px] shrink-0">
                    <svg width="120" height="120" viewBox="0 0 120 120" className="rotate-[-90deg]">
                      <circle cx="60" cy="60" r="50" fill="transparent" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="8" />
                      <circle 
                        cx="60" 
                        cy="60" 
                        r="50" 
                        fill="transparent" 
                        stroke="var(--color-success)" 
                        strokeWidth="8" 
                        strokeDasharray="314.15" 
                        strokeDashoffset="5.6" 
                        className="transition-all duration-1000 ease-out" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-text-primary">98.2%</span>
                      <span className="text-[9px] font-bold text-success uppercase tracking-wider">Excellent</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-center sm:text-left">
                    <h4 className="text-sm font-semibold text-text-primary">Quality Health Analysis</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      The Quality Score is calculated based on schema compliance, null boundaries, value constraints, and uniqueness guarantees across <strong>1.87M ingested records</strong>.
                    </p>
                    <div className="flex justify-center sm:justify-start gap-2 pt-1">
                      <span className="badge badge-ok text-[9px]">Passed 45 Checks</span>
                      <span className="badge badge-warn text-[9px]">3 Warnings</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bars metrics */}
              <div className="panel">
                <div className="panel-header">
                  <span className="t-h3 font-semibold text-text-primary">Constraint Diagnostics</span>
                </div>
                <div className="panel-body p-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-text-secondary">Completeness (Field Population)</span>
                      <span className="text-success font-semibold">99.2%</span>
                    </div>
                    <div className="progress"><div className="progress-fill ok" style={{ width: '99.2%' }}></div></div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-text-secondary">Format Conformance (Types & Schemas)</span>
                      <span className="text-success font-semibold">99.8%</span>
                    </div>
                    <div className="progress"><div className="progress-fill ok" style={{ width: '99.8%' }}></div></div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-text-secondary">Uniqueness Guarantees</span>
                      <span className="text-success font-semibold">99.9%</span>
                    </div>
                    <div className="progress"><div className="progress-fill ok" style={{ width: '99.9%' }}></div></div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-text-secondary">Range Outlier & Boundary Validations</span>
                      <span className="text-warning font-semibold">94.1%</span>
                    </div>
                    <div className="progress"><div className="progress-fill warn" style={{ width: '94.1%' }}></div></div>
                  </div>
                </div>
              </div>

            </div>

            {/* Checklist items */}
            <div className="panel">
              <div className="panel-header">
                <span className="t-h3 font-semibold text-text-primary">Validation Rules Checklist</span>
              </div>
              <div className="flex flex-col font-mono text-[11px]">
                {[
                  { field: 'product_id', rule: 'matches regex SKU-[0-9]{5}-[A-Z]', status: 'ok', text: 'Passed (100% compliant)' },
                  { field: 'price', rule: 'must be positive numeric (price >= 0)', status: 'warn', text: '3 Outliers corrected' },
                  { field: 'rating', rule: 'enforces range 0.0 to 5.0', status: 'ok', text: 'Passed (100% compliant)' },
                  { field: 'image_url', rule: 'resolves to active static image host (CDN check)', status: 'ok', text: 'Passed (99.7% active)' }
                ].map((rule, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 border-b border-white/[0.04] hover:bg-white/[0.01] transition-colors last:border-b-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {rule.status === 'ok' ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                      )}
                      <span className="text-text-primary font-semibold">{rule.field}</span>
                      <span className="text-text-tertiary">{rule.rule}</span>
                    </div>
                    <span className={`badge ${rule.status === 'ok' ? 'badge-ok' : 'badge-warn'} text-[9px]`}>
                      {rule.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* LINEAGE PANEL */}
        {activeTab === 'lineage' && (
          <motion.div 
            initial={{ opacity: 0, y: 4 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="panel"
          >
            <div className="panel-header justify-between">
              <span className="t-h3 font-semibold text-text-primary">Data Lineage & Agent Flow Map</span>
              <span className="badge badge-muted text-[10px] font-mono">Visual execution path</span>
            </div>
            
            <div className="panel-body p-8 bg-background-secondary overflow-x-auto flex flex-col items-center">
              
              {/* Node paths canvas / SVG structure */}
              <div className="relative w-[880px] h-[100px] flex justify-between items-center select-none">
                
                {/* Connecting SVG lines */}
                <svg className="absolute top-0 left-0 w-100 h-100 z-0 pointer-events-none">
                  {/* Node 1 to 2 */}
                  <path d="M 100 50 L 260 50" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" fill="none" />
                  <path d="M 100 50 L 260 50" className="lineage-flow-line stroke-accent" strokeWidth="3" fill="none" />
                  
                  {/* Node 2 to 3 */}
                  <path d="M 280 50 L 440 50" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" fill="none" />
                  <path d="M 280 50 L 440 50" className="lineage-flow-line stroke-accent" strokeWidth="3" fill="none" style={{ animationDelay: '-0.3s' }} />
                  
                  {/* Node 3 to 4 */}
                  <path d="M 460 50 L 620 50" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" fill="none" />
                  <path d="M 460 50 L 620 50" className="lineage-flow-line stroke-accent" strokeWidth="3" fill="none" style={{ animationDelay: '-0.6s' }} />
                  
                  {/* Node 4 to 5 */}
                  <path d="M 640 50 L 800 50" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" fill="none" />
                  <path d="M 640 50 L 800 50" className="lineage-flow-line stroke-accent" strokeWidth="3" fill="none" style={{ animationDelay: '-0.9s' }} />
                </svg>

                {/* Nodes */}
                <div className="panel w-[140px] h-[80px] z-10 p-3 flex flex-col justify-center items-center text-center bg-surface border-white/[0.06]">
                  <span className="text-xl">🌐</span>
                  <span className="text-xs font-semibold text-text-primary mt-1">Web Source</span>
                  <span className="text-[9px] font-mono text-info mt-0.5">Shopify/Amazon</span>
                </div>

                <div className="panel w-[140px] h-[80px] z-10 p-3 flex flex-col justify-center items-center text-center bg-surface border-white/[0.06]">
                  <span className="text-xl">🤖</span>
                  <span className="text-xs font-semibold text-text-primary mt-1">Extraction</span>
                  <span className="text-[9px] font-mono text-accent mt-0.5">Crawler-Agent-04</span>
                </div>

                <div className="panel w-[140px] h-[80px] z-10 p-3 flex flex-col justify-center items-center text-center bg-surface border-white/[0.06]">
                  <span className="text-xl">🛡</span>
                  <span className="text-xs font-semibold text-text-primary mt-1">Validation</span>
                  <span className="text-[9px] font-mono text-success mt-0.5">Schema Guard</span>
                </div>

                <div className="panel w-[140px] h-[80px] z-10 p-3 flex flex-col justify-center items-center text-center bg-surface border-white/[0.06]">
                  <span className="text-xl">🧹</span>
                  <span className="text-xs font-semibold text-text-primary mt-1">Cleaning</span>
                  <span className="text-[9px] font-mono text-success mt-0.5">De-duplication</span>
                </div>

                <div className="panel w-[140px] h-[80px] z-10 p-3 flex flex-col justify-center items-center text-center bg-surface border-accent shadow-glow-accent">
                  <span className="text-xl">📦</span>
                  <span className="text-xs font-bold text-accent mt-1">Dataset Output</span>
                  <span className="text-[9px] font-mono text-text-tertiary mt-0.5">Parquet Store</span>
                </div>

              </div>

              <div className="mt-8 max-w-2xl text-center text-xs text-text-secondary leading-relaxed font-mono">
                This lineage tracks data provenance from the initial endpoints through autonomous extraction, type validation checklists, cleaning nodes, and final Parquet conversion. Clicking any node logs detailed step metrics in the diagnostic console.
              </div>
            </div>
          </motion.div>
        )}

        {/* EXPORT TAB PANEL */}
        {activeTab === 'export' && (
          <motion.div 
            initial={{ opacity: 0, y: 4 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6"
          >
            <h4 className="text-sm font-semibold text-text-primary font-mono text-[11px] uppercase tracking-wider">Select Download Format</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { format: 'CSV', label: 'Comma Separated Values (.csv)', emoji: '📄', desc: 'Standard table schema export. Text-delimited.' },
                { format: 'JSON', label: 'JSON Records Array (.json)', emoji: '🗂', desc: 'Hierarchical documents. Best for web apps.' },
                { format: 'Parquet', label: 'Apache Parquet (.parquet)', emoji: '⚙', desc: 'Columnar bin files. Highly compressed, ideal for ML models.' },
                { format: 'Excel', label: 'Microsoft Excel (.xlsx)', emoji: '📊', desc: 'Spreadsheet structure. Ready for BI analysis.' }
              ].map(tile => (
                <button
                  key={tile.format}
                  onClick={() => handleExportDownload(tile.format)}
                  disabled={isExporting !== null}
                  className={`
                    group p-5 bg-background-secondary border border-white/[0.06] rounded-xl text-left transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                    hover:border-accent hover:bg-white/[0.02] hover:translate-y-[-2px] hover:shadow-lg
                  `}
                >
                  <span className="text-2xl block mb-2">{tile.emoji}</span>
                  <span className="text-xs font-bold text-text-primary block font-mono">{tile.label}</span>
                  <span className="text-[11px] text-text-muted mt-2 block leading-relaxed">{tile.desc}</span>
                </button>
              ))}
            </div>

            {/* Export history logs */}
            <div className="panel">
              <div className="panel-header justify-between">
                <span className="t-h3 font-semibold text-text-primary">Export and Download History</span>
                {isExporting && (
                  <span className="badge badge-primary text-[10px] font-mono animate-pulse">
                    Compiling {isExporting}...
                  </span>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Target Dataset File</th>
                      <th>Request Time</th>
                      <th>Format</th>
                      <th>Compressed Size</th>
                      <th>Triggered By</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportHistory.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                        <td>
                          <span className="font-mono text-[11px] font-semibold text-text-primary">{row.file}</span>
                        </td>
                        <td>
                          <span className="text-[11px] text-text-secondary">{row.time}</span>
                        </td>
                        <td>
                          <span className="badge badge-info text-[10px] font-mono">{row.format}</span>
                        </td>
                        <td>
                          <span className="font-mono text-[12px] text-text-secondary">{row.size}</span>
                        </td>
                        <td>
                          <span className="text-[11px] text-text-secondary">{row.trigger}</span>
                        </td>
                        <td>
                          <span 
                            className={`
                              badge text-[10px] font-mono
                              ${row.status === 'Downloaded' ? 'badge-ok' : row.status === 'Uploaded S3' ? 'badge-ok' : 'badge-primary animate-pulse'}
                            `}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
