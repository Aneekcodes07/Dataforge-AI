import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  FileText,
  Table,
  Sheet,
  Plug,
  Image,
  Database,
  Terminal,
  Search,
  Check,
  ArrowRight,
  ArrowLeft,
  Upload,
  Sliders,
  Settings,
  Save,
  AlertTriangle,
  Play,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useAgentStore } from '@/stores/agentStore';
import { cn } from '@/lib/utils';

type SourceId = 'url' | 'pdf' | 'csv' | 'excel' | 'api' | 'image' | 'database' | 'json';

const SOURCE_SELECTIONS = [
  { id: 'url', label: 'Website Scraper', icon: Globe, desc: 'Extract dynamic data from public HTML sites', color: '#6366F1' },
  { id: 'pdf', label: 'PDF Extractor', icon: FileText, desc: 'Parse scanning blocks or layout PDFs', color: '#EF4444' },
  { id: 'csv', label: 'CSV Importer', icon: Table, desc: 'Upload standard delimited tables', color: '#10B981' },
  { id: 'excel', label: 'Spreadsheet Loader', icon: Sheet, desc: 'Parse sheet tabs or Excel workbooks', color: '#22C55E' },
  { id: 'api', label: 'API Connector', icon: Plug, desc: 'Connect endpoints and fetch JSON payloads', color: '#F59E0B' },
  { id: 'image', label: 'Image OCR Reader', icon: Image, desc: 'Read receipts, layouts, or chart graphics', color: '#8B5CF6' },
  { id: 'database', label: 'Database Sync', icon: Database, desc: 'Sync direct Postgres, MySQL, or Mongo targets', color: '#EC4899' },
  { id: 'json', label: 'JSON Parser', icon: Terminal, desc: 'Parse custom raw JSON files or string blobs', color: '#14B8A6' },
] as const;

// Preset definitions
const PRESETS = {
  custom: { label: 'Custom Configuration', fields: '', depth: 2, limit: 100, format: 'json', schedule: 'once' },
  quick: { label: 'Quick Scraper', fields: 'title, description, price, url', depth: 1, limit: 50, format: 'json', schedule: 'once' },
  deep: { label: 'Deep Crawl Audit', fields: 'product_id, name, sku, price, rating, reviews_count, specs_metadata', depth: 3, limit: 500, format: 'parquet', schedule: 'daily' },
  ocr: { label: 'OCR heavy parsing', fields: 'invoice_id, billing_date, item_description, amount_due, tax_rate, vendor_address', depth: 1, limit: 100, format: 'csv', schedule: 'weekly' },
} as const;

interface MockSchemaField {
  name: string;
  type: 'string' | 'float' | 'integer' | 'boolean';
  status: 'valid' | 'warning' | 'fixed';
  details?: string;
}

export default function ExtractionPage() {
  const navigate = useNavigate();
  const { createProject } = useProjectStore();
  const { connectWebSocket } = useAgentStore();

  // Wizard state machine
  const [step, setStep] = useState(1);
  const [savedDraftAlert, setSavedDraftAlert] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Step 1 states
  const [selectedSource, setSelectedSource] = useState<SourceId>('url');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 configurations
  const [projectName, setProjectName] = useState('');
  const [targetFields, setTargetFields] = useState('title, description, price');
  const [crawlDepth, setCrawlDepth] = useState(2);
  const [crawlLimit, setCrawlLimit] = useState(100);
  const [dataFormat, setDataFormat] = useState<'parquet' | 'csv' | 'json'>('json');
  const [schedule, setSchedule] = useState<'once' | 'hourly' | 'daily' | 'weekly'>('once');
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof PRESETS>('custom');
  const [advancedMode, setAdvancedMode] = useState(false);
  
  // Advanced configuration states
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [requestDelay, setRequestDelay] = useState(500);
  const [customUserAgent, setCustomUserAgent] = useState('Mozilla/5.0 (compatible; DataForge-Scraper/2.0)');

  // Step 3 states: Selected AI Agents
  const [selectedAgents, setSelectedAgents] = useState({
    ocr: false,
    extractor: true,
    validator: true,
    cleaner: true,
    eda: false,
    export: true,
  });

  // Step 4 states: Data Validation
  const [qualityScore, setQualityScore] = useState(89.5);
  const [schemaFields, setSchemaFields] = useState<MockSchemaField[]>([
    { name: 'product_id', type: 'string', status: 'valid' },
    { name: 'price', type: 'float', status: 'warning', details: 'Contains currency signs ($) or text ranges' },
    { name: 'rating', type: 'float', status: 'valid' },
    { name: 'stock_count', type: 'integer', status: 'valid' },
    { name: 'description', type: 'string', status: 'warning', details: 'Null rates exceed 12%' },
  ]);
  const [fixesApplied, setFixesApplied] = useState({
    coerceFloat: false,
    fillMuted: false,
  });

  // Step 6 states: Pipeline launch animations
  const [launchStage, setLaunchStage] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 500 * 1024 * 1024) {
        setFileError('File size exceeds 500MB maximum limit');
        setUploadedFile(null);
      } else {
        setFileError('');
        setUploadedFile({ name: file.name, size: file.size });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 500 * 1024 * 1024) {
        setFileError('File size exceeds 500MB maximum limit');
        setUploadedFile(null);
      } else {
        setFileError('');
        setUploadedFile({ name: file.name, size: file.size });
      }
    }
  };

  // Preset auto-fill logic
  const handlePresetSelect = (presetKey: keyof typeof PRESETS) => {
    setSelectedPreset(presetKey);
    const config = PRESETS[presetKey];
    if (presetKey !== 'custom') {
      setTargetFields(config.fields);
      setCrawlDepth(config.depth);
      setCrawlLimit(config.limit);
      setDataFormat(config.format as 'parquet' | 'csv' | 'json');
      setSchedule(config.schedule as 'once' | 'hourly' | 'daily' | 'weekly');
    }
  };

  // Toggle OCR Agent automatically based on source type selection
  useEffect(() => {
    if (selectedSource === 'pdf' || selectedSource === 'image') {
      setSelectedAgents((prev) => ({ ...prev, ocr: true }));
    } else {
      setSelectedAgents((prev) => ({ ...prev, ocr: false }));
    }
  }, [selectedSource]);

  // Load wizard draft from localstorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('df-wizard-draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.selectedSource) setSelectedSource(draft.selectedSource);
        if (draft.projectName) setProjectName(draft.projectName);
        if (draft.targetFields) setTargetFields(draft.targetFields);
        if (draft.crawlDepth) setCrawlDepth(draft.crawlDepth);
        if (draft.crawlLimit) setCrawlLimit(draft.crawlLimit);
        if (draft.dataFormat) setDataFormat(draft.dataFormat);
        if (draft.schedule) setSchedule(draft.schedule);
        if (draft.selectedAgents) setSelectedAgents(draft.selectedAgents);
      } catch (err) {
        console.error('Failed to parse wizard state draft', err);
      }
    }
  }, []);

  // Save Draft logic
  const handleSaveDraft = () => {
    const draft = {
      selectedSource,
      projectName,
      targetFields,
      crawlDepth,
      crawlLimit,
      dataFormat,
      schedule,
      selectedAgents,
    };
    localStorage.setItem('df-wizard-draft', JSON.stringify(draft));
    setSavedDraftAlert(true);
    setTimeout(() => setSavedDraftAlert(false), 3000);
  };

  // Apply quick fix suggestion logic
  const handleApplyFix = (type: 'coerceFloat' | 'fillMuted') => {
    if (type === 'coerceFloat') {
      setFixesApplied((f) => ({ ...f, coerceFloat: true }));
      setSchemaFields((prev) =>
        prev.map((field) =>
          field.name === 'price' ? { ...field, status: 'fixed', type: 'float', details: 'Regular expression mapping active: [\\d.]+' } : field
        )
      );
      setQualityScore((score) => Math.min(score + 4.2, 100));
    } else if (type === 'fillMuted') {
      setFixesApplied((f) => ({ ...f, fillMuted: true }));
      setSchemaFields((prev) =>
        prev.map((field) =>
          field.name === 'description' ? { ...field, status: 'fixed', details: 'Null values imputed with default fallback string: ""' } : field
        )
      );
      setQualityScore((score) => Math.min(score + 5.1, 100));
    }
  };

  // Launch pipeline setup animation step triggers
  const triggerLaunchFlow = async () => {
    setStep(6);
    setLaunchStage(0);
    setTerminalLogs([]);

    const addLog = (msg: string, delay: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setTerminalLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
          resolve();
        }, delay);
      });
    };

    await addLog('[INIT] Handshaking extraction target node...', 300);
    await addLog('[SYS_NODE] Connecting ingestion connector source...', 400);
    setLaunchStage(1);
    await addLog('[SUCCESS] Target connector source handshake confirmed.', 300);

    if (selectedAgents.ocr) {
      await addLog('[SYS_NODE] Spawning Tesseract-OCR parser worker instance...', 500);
      setLaunchStage(2);
      await addLog('[OCR] Loading image bounding layout checkpoints...', 400);
      await addLog('[SUCCESS] OCR extraction framework started successfully.', 300);
    } else {
      await addLog('[OCR] Skip OCR parsing agent. Continuing to LLM core extractor...', 200);
      setLaunchStage(2);
    }

    await addLog('[SYS_NODE] Launching autonomous extraction agent: gpt-4o-mini...', 500);
    setLaunchStage(3);
    await addLog('[LLM] Compiling structural schemas and target query prompt constraints...', 400);
    await addLog('[LLM] Ingestion token allocation: 1.2M query space mapped.', 300);

    await addLog('[SYS_NODE] Activating schema guard validation parameters...', 500);
    setLaunchStage(4);
    await addLog('[VALIDATOR] Quality score checking: target price formatting...', 400);
    if (fixesApplied.coerceFloat || fixesApplied.fillMuted) {
      await addLog('[VALIDATOR] Resolving auto-fix anomalies: applied custom data cleaning overrides.', 300);
    }

    await addLog('[SYS_NODE] Initializing ML Parquet S3 database exporter pipelines...', 600);
    setLaunchStage(5);
    await addLog('[EXPORTER] Compiling binary columnar output tables in Apache Parquet...', 400);

    // Call store action
    const defaultName = projectName || `Pipeline - ${selectedSource.toUpperCase()} [${new Date().toLocaleDateString()}]`;
    const config = {
      target_fields: targetFields.split(',').map((f) => f.trim()),
      depth: crawlDepth,
      limit: crawlLimit,
      format: dataFormat,
      schedule,
      agents: selectedAgents,
      advanced: {
        proxyEnabled,
        requestDelay,
        customUserAgent,
      },
    };
    
    const project = await createProject(defaultName, selectedSource as any, config);
    if (project) {
      connectWebSocket(project.id);
      await addLog('[SUCCESS] Ingestion pipeline launched successfully!', 300);
      setLaunchStage(6);
    } else {
      await addLog('[ERROR] Backend creation payload validation failed. Check schema configuration.', 100);
    }
  };

  // Auto scroll terminal logs
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Compute resource details dynamically based on toggled agents
  const computeResourceEstimates = () => {
    let memory = 0.5; // GB
    let cost = 0.02; // $
    let speed = 140; // tokens/s

    if (selectedAgents.ocr) { memory += 1.5; cost += 0.08; speed -= 40; }
    if (selectedAgents.extractor) { memory += 0.8; cost += 0.12; speed -= 20; }
    if (selectedAgents.validator) { memory += 0.3; cost += 0.01; }
    if (selectedAgents.cleaner) { memory += 0.4; cost += 0.02; }
    if (selectedAgents.eda) { memory += 1.2; cost += 0.05; }
    if (selectedAgents.export) { memory += 0.5; cost += 0.01; }

    return {
      memory: memory.toFixed(1),
      cost: cost.toFixed(2),
      speed,
      cpu: Math.max(2, Math.round(memory * 2)),
    };
  };

  const resourceStats = computeResourceEstimates();

  // Search filter sources
  const filteredSources = SOURCE_SELECTIONS.filter((src) =>
    src.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    src.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-section max-w-[1440px] mx-auto text-left relative">
      {/* Draft Save Alert Banner */}
      <AnimatePresence>
        {savedDraftAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-50 bg-success/10 border border-success/30 px-5 py-3 rounded-lg flex items-center gap-2.5 text-success text-xs font-mono backdrop-blur-md shadow-lg"
          >
            <Check className="w-4 h-4" />
            [WIZARD_DRAFT_STATE_SAVED_LOCALSTORAGE]
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="page-header border-b border-white/[0.04] pb-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-dashboard-title text-text-primary font-mono uppercase tracking-wider">[PIPELINE_CREATION_WIZARD_V2]</h1>
          <p className="text-xs text-text-secondary mt-1">
            Build, test, and launch autonomous LLM agent data extraction workflows in structured stages.
          </p>
        </div>
        {step < 6 && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Auto-saved state
            </span>
            <button
              onClick={handleSaveDraft}
              className="btn-secondary py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide inline-flex items-center gap-1.5 rounded-md"
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </button>
          </div>
        )}
      </div>

      {/* Progress Stepper Tracker */}
      {step < 6 && (
        <div className="mb-8 overflow-x-auto pb-2 border-b border-white/[0.03]">
          <div className="flex items-center justify-between min-w-[760px] px-1">
            {(
              [
                { num: 1, label: 'Select Ingest Source' },
                { num: 2, label: 'Configure Extraction' },
                { num: 3, label: 'Orchestrate AI Agents' },
                { num: 4, label: 'Schema Validation' },
                { num: 5, label: 'Review Config' },
              ] as const
            ).map((s) => {
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              return (
                <div key={s.num} className="flex items-center gap-2">
                  <button
                    onClick={() => step < 6 && setStep(s.num)}
                    className={cn(
                      'flex items-center gap-2 text-xs font-mono focus:outline-none transition-all duration-200 cursor-pointer',
                      isActive ? 'text-accent font-semibold' : isCompleted ? 'text-success' : 'text-text-tertiary'
                    )}
                  >
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] border font-bold',
                        isActive
                          ? 'border-accent bg-accent/10 text-accent'
                          : isCompleted
                          ? 'border-success bg-success/10 text-success'
                          : 'border-white/10 text-text-tertiary'
                      )}
                    >
                      {isCompleted ? '✓' : s.num}
                    </span>
                    <span>{s.label}</span>
                  </button>
                  {s.num < 5 && <ChevronRightIcon className="w-3 h-3 text-text-muted" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Wizard Form Wrapper */}
      <div className="min-h-[460px]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
                {/* Search & Description bar */}
                <div className="space-y-5 text-left">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <input
                      type="text"
                      placeholder="Search source types..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-base pl-9 pr-3 w-full text-xs"
                    />
                  </div>
                  <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary">Connector Node</h3>
                    <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                      Choose where raw data originates. DataForge will automatically provision connection socket workers mapping to the selected source type.
                    </p>
                  </div>
                </div>

                {/* Sources list grid */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredSources.map((src) => {
                      const Icon = src.icon;
                      const isSelected = selectedSource === src.id;

                      return (
                        <button
                          key={src.id}
                          onClick={() => {
                            setSelectedSource(src.id);
                            setUploadedFile(null);
                            setFileError('');
                          }}
                          className={cn(
                            'p-4 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer min-h-[140px]',
                            isSelected
                              ? 'bg-accent/[0.02] border-accent shadow-sm'
                              : 'bg-surface/30 border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08]'
                          )}
                        >
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
                            style={{
                              borderColor: isSelected ? 'rgba(255, 122, 0, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                              backgroundColor: isSelected ? 'rgba(255, 122, 0, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                              color: isSelected ? '#FF7A00' : '#A1A1AA',
                            }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="mt-3">
                            <p className={cn('text-xs font-bold uppercase tracking-wide font-mono', isSelected ? 'text-accent' : 'text-text-primary')}>
                              {src.label}
                            </p>
                            <p className="text-[10px] text-text-secondary leading-snug mt-1 truncate">
                              {src.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Drag and drop panel for file-based connectors */}
                  {['pdf', 'csv', 'excel', 'image', 'json'].includes(selectedSource) && (
                    <div className="space-y-2 text-left">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">
                        Document Upload Block
                      </span>
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          'border border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer bg-surface/20',
                          'hover:bg-white/[0.03] hover:border-accent/40 transition-all duration-200 min-h-[180px]',
                          dragActive && 'border-accent bg-accent/[0.02]',
                          fileError && 'border-danger bg-danger/5'
                        )}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={
                            selectedSource === 'pdf'
                              ? '.pdf'
                              : selectedSource === 'csv'
                              ? '.csv'
                              : selectedSource === 'excel'
                              ? '.xls,.xlsx'
                              : selectedSource === 'image'
                              ? '.png,.jpg,.jpeg'
                              : '.json'
                          }
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center border',
                          fileError ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-white/[0.02] border-white/[0.06] text-text-secondary'
                        )}>
                          <Upload className="w-5 h-5" />
                        </div>
                        {uploadedFile ? (
                          <div className="text-center">
                            <p className="text-xs font-mono font-bold text-accent truncate max-w-sm">{uploadedFile.name}</p>
                            <p className="text-[10px] text-text-secondary mt-1">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        ) : fileError ? (
                          <div className="text-center">
                            <p className="text-xs font-bold text-danger">{fileError}</p>
                            <p className="text-[10px] text-danger/80 mt-1">Please select an allowed file size.</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-xs font-bold text-text-primary">Drag & drop your connector source here, or browse files</p>
                            <p className="text-[10px] text-text-tertiary mt-1">
                              Supports standard {selectedSource.toUpperCase()} files up to 500MB
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
                {/* Configuration presets selector */}
                <div className="space-y-4 text-left">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Config Presets</p>
                  <div className="space-y-2 bg-surface/30 p-2 rounded-xl border border-white/[0.04] backdrop-blur-md">
                    {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
                      <button
                        key={key}
                        onClick={() => handlePresetSelect(key)}
                        className={cn(
                          'w-full flex flex-col text-left px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 border cursor-pointer',
                          selectedPreset === key
                            ? 'bg-accent/10 border-accent/30 text-accent font-semibold'
                            : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-white/[0.02]'
                        )}
                      >
                        <span className="font-mono uppercase text-[10px] tracking-wider">
                          {key === 'custom' ? '[CUSTOM_CONFIG]' : `[PRESET_${key.toUpperCase()}]`}
                        </span>
                        <span className="text-[10px] text-text-tertiary mt-0.5 font-normal">
                          {PRESETS[key].label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form fields */}
                <div className="card bg-surface/20 border border-white/[0.04] rounded-xl !p-6 md:!p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                    {/* Project Name */}
                    <div className="space-y-2">
                      <label htmlFor="w-project-name" className="block text-xs font-mono font-bold text-text-secondary uppercase">Project Identifier</label>
                      <input
                        type="text"
                        id="w-project-name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="e.g. ecommerce-crawl-v4"
                        className="input-base text-xs"
                      />
                    </div>

                    {/* Output Format */}
                    <div className="space-y-2">
                      <label htmlFor="w-data-format" className="block text-xs font-mono font-bold text-text-secondary uppercase">Data Target Format</label>
                      <select
                        id="w-data-format"
                        value={dataFormat}
                        onChange={(e) => {
                          setSelectedPreset('custom');
                          setDataFormat(e.target.value as any);
                        }}
                        className="input-base bg-[#121212] h-[38px] text-xs cursor-pointer"
                      >
                        <option value="json">JSON format</option>
                        <option value="csv">CSV format</option>
                        <option value="parquet">Apache Parquet format (Recommended)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                    {/* Target Fields */}
                    <div className="space-y-2">
                      <label htmlFor="w-target-fields" className="block text-xs font-mono font-bold text-text-secondary uppercase">Fields Target Extraction</label>
                      <input
                        type="text"
                        id="w-target-fields"
                        value={targetFields}
                        onChange={(e) => {
                          setSelectedPreset('custom');
                          setTargetFields(e.target.value);
                        }}
                        placeholder="e.g. name, price, stock, sku"
                        className="input-base text-xs"
                      />
                      <p className="text-[10px] text-text-tertiary mt-0.5">Separate columns with commas. LLM agents will parse matching fields.</p>
                    </div>

                    {/* Ingestion Schedule */}
                    <div className="space-y-2">
                      <label htmlFor="w-schedule" className="block text-xs font-mono font-bold text-text-secondary uppercase">Execution Frequency</label>
                      <select
                        id="w-schedule"
                        value={schedule}
                        onChange={(e) => {
                          setSelectedPreset('custom');
                          setSchedule(e.target.value as any);
                        }}
                        className="input-base bg-[#121212] h-[38px] text-xs cursor-pointer"
                      >
                        <option value="once">On-demand (Run Once)</option>
                        <option value="hourly">Hourly sync pipeline</option>
                        <option value="daily">Daily database stream</option>
                        <option value="weekly">Weekly scheduler</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                    {/* Depth slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono font-bold text-text-secondary uppercase">
                        <span>Crawl Depth</span>
                        <span className="text-accent">{crawlDepth} layers</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={crawlDepth}
                        onChange={(e) => {
                          setSelectedPreset('custom');
                          setCrawlDepth(parseInt(e.target.value));
                        }}
                        className="w-full accent-accent h-1 bg-white/[0.04] rounded-lg appearance-none cursor-pointer mt-2"
                      />
                      <p className="text-[9px] text-text-tertiary leading-relaxed mt-1">
                        Determines deep ingestion recursion layers (websites links/nested schema maps).
                      </p>
                    </div>

                    {/* Crawl limit */}
                    <div className="space-y-2">
                      <label htmlFor="w-crawl-limit" className="block text-xs font-mono font-bold text-text-secondary uppercase">Maximum Record Limit</label>
                      <input
                        type="number"
                        id="w-crawl-limit"
                        value={crawlLimit}
                        onChange={(e) => {
                          setSelectedPreset('custom');
                          setCrawlLimit(parseInt(e.target.value) || 0);
                        }}
                        className="input-base text-xs"
                      />
                    </div>
                  </div>

                  {/* Advanced settings toggler */}
                  <div className="pt-2 text-left border-t border-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => setAdvancedMode(!advancedMode)}
                      className="text-xs font-mono font-bold text-text-secondary hover:text-accent inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      {advancedMode ? '[HIDE_ADVANCED_SETTINGS]' : '[SHOW_ADVANCED_SETTINGS]'}
                    </button>

                    <AnimatePresence>
                      {advancedMode && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-4 pt-4"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Proxy enable */}
                            <label className="flex items-start gap-3 cursor-pointer p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg">
                              <input
                                type="checkbox"
                                checked={proxyEnabled}
                                onChange={(e) => setProxyEnabled(e.target.checked)}
                                className="w-4 h-4 rounded border-white/25 bg-white/5 text-accent focus:ring-accent/30 mt-0.5"
                              />
                              <div>
                                <p className="text-xs font-mono font-bold text-text-primary">Enable Proxies</p>
                                <p className="text-[10px] text-text-secondary mt-0.5">Route pipeline crawling via dynamic proxy relays.</p>
                              </div>
                            </label>

                            {/* Request delay slider */}
                            <div className="space-y-1.5 p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="text-text-secondary uppercase">Request Delay</span>
                                <span className="text-accent font-bold">{requestDelay} ms</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="5000"
                                step="100"
                                value={requestDelay}
                                onChange={(e) => setRequestDelay(parseInt(e.target.value))}
                                className="w-full accent-accent h-1 bg-white/[0.04] rounded-lg appearance-none cursor-pointer mt-1"
                              />
                            </div>
                          </div>

                          {/* Custom User Agent */}
                          <div className="space-y-2">
                            <label htmlFor="w-user-agent" className="block text-xs font-mono font-bold text-text-secondary uppercase">Custom Scraper User-Agent</label>
                            <input
                              type="text"
                              id="w-user-agent"
                              value={customUserAgent}
                              onChange={(e) => setCustomUserAgent(e.target.value)}
                              className="input-base text-xs font-mono"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
                {/* Agent Selection Controls */}
                <div className="space-y-4 text-left">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Configure Active AI Agents</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(
                      [
                        { id: 'ocr', name: 'OCR parsing node', desc: 'Pre-parses pdf and image document layers', icon: FileText, req: true },
                        { id: 'extractor', name: 'Entity LLM Extractor', desc: 'Identifies schema properties using gpt-4o-mini', icon: Play, active: true },
                        { id: 'validator', name: 'Schema Guard validator', desc: 'Checks data integrity limits & data typings', icon: AlertTriangle, active: true },
                        { id: 'cleaner', name: 'Imputer Normalization cleaner', desc: 'Resolves price warnings & missing descriptions', icon: Sparkles, active: true },
                        { id: 'eda', name: 'EDA Analyzer', desc: 'Plots correlations and insights metrics charts', icon: Sliders },
                        { id: 'export', name: 'Apache Parquet exporter', desc: 'Stores columnar target files in S3 buckets', icon: Database, active: true },
                      ] as const
                    ).map((agent) => {
                      const Icon = agent.icon;
                      const isChecked = (selectedAgents as any)[agent.id];

                      return (
                        <div
                          key={agent.id}
                          onClick={() => setSelectedAgents((prev: any) => ({ ...prev, [agent.id]: !prev[agent.id] }))}
                          className={cn(
                            'p-4 rounded-xl border flex gap-3.5 items-start cursor-pointer transition-all duration-200 bg-surface/30 select-none',
                            isChecked ? 'border-accent bg-accent/[0.015]' : 'border-white/[0.04] hover:bg-white/[0.02]'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by div onClick
                            className="w-4.5 h-4.5 rounded border-white/20 bg-white/5 text-accent focus:ring-accent/30 mt-0.5 shrink-0"
                          />
                          <div className={cn("p-1.5 rounded-lg border border-white/[0.04] bg-white/[0.01] shrink-0", isChecked ? 'text-accent border-accent/20' : 'text-text-secondary')}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-text-primary uppercase">{agent.name}</span>
                              {agent.id === 'extractor' && (
                                <span className="text-[8px] font-mono font-bold text-accent bg-accent/10 border border-accent/20 px-1 rounded">Required</span>
                              )}
                            </div>
                            <p className="text-[10px] text-text-secondary leading-snug mt-1">{agent.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Render Visual pipeline node map */}
                  <div className="card bg-surface/10 border border-white/[0.04] rounded-xl p-4 mt-6">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary mb-4">Ingestion flow pipeline visualization</p>
                    <div className="relative overflow-x-auto py-3">
                      <div className="flex items-center justify-between min-w-[620px] px-4">
                        {/* Source node */}
                        <div className="flex flex-col items-center gap-2 bg-surface border border-white/10 p-2.5 rounded-lg w-24">
                          <span className="text-[10px] font-mono font-bold text-text-tertiary">INGEST</span>
                          <span className="text-xs font-mono font-semibold uppercase text-accent">{selectedSource}</span>
                        </div>

                        {/* Arrows / selected agent nodes */}
                        {(
                          [
                            { id: 'ocr', label: 'OCR' },
                            { id: 'extractor', label: 'EXTRACT' },
                            { id: 'validator', label: 'VALIDATE' },
                            { id: 'cleaner', label: 'CLEAN' },
                            { id: 'eda', label: 'EDA' },
                            { id: 'export', label: 'S3_STORE' },
                          ] as const
                        ).map((node) => {
                          const active = (selectedAgents as any)[node.id];
                          return (
                            <div key={node.id} className="flex items-center gap-2">
                              <div className="flex flex-col items-center">
                                <div
                                  className={cn(
                                    'w-1.5 h-1.5 rounded-full',
                                    active ? 'bg-accent animate-pulse' : 'bg-white/5'
                                  )}
                                />
                                <span className="text-[16px] text-white/10 select-none">→</span>
                              </div>
                              <div
                                className={cn(
                                  'flex flex-col items-center justify-center p-2 rounded-lg border w-24 min-h-[48px] transition-all duration-200',
                                  active
                                    ? 'bg-accent/5 border-accent text-accent font-bold'
                                    : 'bg-white/[0.01] border-white/[0.04] text-text-tertiary opacity-40'
                                )}
                              >
                                <span className="text-[9px] font-mono">{node.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Side Resource Estimate */}
                <div className="card bg-[#0A0A0A] border border-white/[0.04] rounded-xl p-5 md:p-6 space-y-6 text-left">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/[0.04]">
                    <Sliders className="w-4 h-4 text-accent animate-pulse" />
                    <h3 className="text-xs font-bold font-mono text-text-primary uppercase tracking-wider">Resource Estimation</h3>
                  </div>

                  <div className="space-y-4 font-mono">
                    <div className="flex justify-between border-b border-white/[0.02] pb-2 text-xs">
                      <span className="text-text-secondary">MEMORY BOUND</span>
                      <span className="text-text-primary font-bold">{resourceStats.memory} GB RAM</span>
                    </div>
                    <div className="flex justify-between border-b border-white/[0.02] pb-2 text-xs">
                      <span className="text-text-secondary">ALLOCATED CORES</span>
                      <span className="text-text-primary font-bold">{resourceStats.cpu} Cores</span>
                    </div>
                    <div className="flex justify-between border-b border-white/[0.02] pb-2 text-xs">
                      <span className="text-text-secondary">LLM THROUGHPUT</span>
                      <span className="text-text-primary font-bold">{resourceStats.speed} tokens/s</span>
                    </div>
                    <div className="flex justify-between border-b border-white/[0.02] pb-2 text-xs">
                      <span className="text-text-secondary">ESTIMATED RUNTIME</span>
                      <span className="text-text-primary font-bold">~2m 45s</span>
                    </div>
                    <div className="flex justify-between pt-1 text-xs">
                      <span className="text-text-secondary">HOURLY SYS COST</span>
                      <span className="text-accent font-bold">${resourceStats.cost}/hr</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg">
                    <p className="text-[9px] font-mono text-text-tertiary leading-relaxed">
                      [INFO] DataForge orchestrator maps CPU allocations to node sockets. Costs reflect active tokens and server instance uptimes.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
                {/* Schema validation preview tables */}
                <div className="space-y-4 text-left">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Inferred Target Schema preview</p>
                  
                  <div className="card bg-surface/20 border border-white/[0.04] rounded-xl p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Field Key Name</th>
                            <th>Inferred Datatype</th>
                            <th>Validation Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                          {schemaFields.map((field) => (
                            <tr key={field.name} className="hover:bg-white/[0.01]">
                              <td className="font-mono text-xs font-bold text-text-primary">{field.name}</td>
                              <td className="font-mono text-xs text-text-secondary">{field.type}</td>
                              <td>
                                {field.status === 'valid' ? (
                                  <span className="chip chip-success text-[9px] py-0.5 px-2">VALID</span>
                                ) : field.status === 'fixed' ? (
                                  <span className="chip chip-purple text-[9px] py-0.5 px-2">✓ FIXED</span>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <span className="chip chip-failed text-[9px] py-0.5 px-2 w-max">WARN_DETECTED</span>
                                    {field.details && <span className="text-[9px] text-danger/80 leading-snug">{field.details}</span>}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Quality dials + quick fixes suggestions list */}
                <div className="space-y-6 text-left">
                  {/* Quality Score Indicator */}
                  <div className="card bg-surface/30 border border-white/[0.04] rounded-xl p-5 md:p-6 text-center space-y-4">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Predicted Data Quality</span>
                    <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                      {/* SVG Gauge */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="72" cy="72" r="62" stroke="rgba(255,255,255,0.03)" strokeWidth="6" fill="none" />
                        <circle
                          cx="72"
                          cy="72"
                          r="62"
                          stroke={qualityScore > 95 ? '#22C55E' : '#FF7A00'}
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={2 * Math.PI * 62}
                          strokeDashoffset={2 * Math.PI * 62 * (1 - qualityScore / 100)}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-2xl font-bold text-text-primary font-mono">{qualityScore.toFixed(1)}%</span>
                        <p className="text-[9px] font-mono text-text-tertiary uppercase mt-1">Compliance index</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick fixes */}
                  <div className="card bg-surface/30 border border-white/[0.04] rounded-xl p-5 md:p-6 space-y-4">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Smart suggestions solver</p>
                    
                    <div className="space-y-3">
                      {/* Fix 1: coerce price */}
                      <div className={cn(
                        'p-3 rounded-lg border text-xs leading-relaxed flex flex-col gap-2.5 transition-all duration-200',
                        fixesApplied.coerceFloat ? 'bg-success/5 border-success/20 opacity-80' : 'bg-white/[0.01] border-white/[0.04]'
                      )}>
                        <div>
                          <p className="font-semibold text-text-primary flex items-center gap-1.5">
                            {fixesApplied.coerceFloat ? <Check className="w-3.5 h-3.5 text-success" /> : <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                            Price column values check
                          </p>
                          <p className="text-[10px] text-text-secondary mt-1">
                            Inconsistent currency strings detected (e.g. "$120.00"). LLM float parsing may warn.
                          </p>
                        </div>
                        {!fixesApplied.coerceFloat && (
                          <button
                            onClick={() => handleApplyFix('coerceFloat')}
                            className="btn-secondary py-1 px-2 text-[10px] font-mono uppercase tracking-wide rounded w-max self-start"
                          >
                            Apply float coercion fix
                          </button>
                        )}
                      </div>

                      {/* Fix 2: fill descriptions */}
                      <div className={cn(
                        'p-3 rounded-lg border text-xs leading-relaxed flex flex-col gap-2.5 transition-all duration-200',
                        fixesApplied.fillMuted ? 'bg-success/5 border-success/20 opacity-80' : 'bg-white/[0.01] border-white/[0.04]'
                      )}>
                        <div>
                          <p className="font-semibold text-text-primary flex items-center gap-1.5">
                            {fixesApplied.fillMuted ? <Check className="w-3.5 h-3.5 text-success" /> : <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                            Null column mapping check
                          </p>
                          <p className="text-[10px] text-text-secondary mt-1">
                            12.8% of incoming document paragraphs are missing values in "description" field.
                          </p>
                        </div>
                        {!fixesApplied.fillMuted && (
                          <button
                            onClick={() => handleApplyFix('fillMuted')}
                            className="btn-secondary py-1 px-2 text-[10px] font-mono uppercase tracking-wide rounded w-max self-start"
                          >
                            Apply defaults imputer fix
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="card bg-surface/20 border border-white/[0.04] rounded-xl p-6 md:p-8 space-y-8 text-left">
                <div>
                  <h3 className="text-sm font-bold font-mono text-text-primary uppercase tracking-wider border-b border-white/[0.04] pb-3">
                    [PIPELINE_FINAL_SPECIFICATIONS_REVIEW]
                  </h3>
                  <p className="text-xs text-text-secondary mt-2">
                    Review and confirm target parameters before booting. Editing any section redirects back to that wizard page.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Column 1 */}
                  <div className="space-y-6">
                    {/* Ingestion Source */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-text-secondary uppercase">Ingestion source node</span>
                        <button onClick={() => setStep(1)} className="text-[10px] font-mono text-accent hover:underline">Edit</button>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg flex items-center justify-between">
                        <span className="text-xs font-bold text-text-primary capitalize">{selectedSource} connector</span>
                        {uploadedFile && <span className="text-[10px] font-mono text-text-secondary truncate max-w-xs">{uploadedFile.name}</span>}
                      </div>
                    </div>

                    {/* Target Configs */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-text-secondary uppercase">Extraction configurations</span>
                        <button onClick={() => setStep(2)} className="text-[10px] font-mono text-accent hover:underline">Edit</button>
                      </div>
                      <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-lg space-y-2.5 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Project ID</span>
                          <span className="text-text-primary">{projectName || 'Unnamed Ingestion'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Output Format</span>
                          <span className="text-text-primary uppercase">{dataFormat}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Crawl limit</span>
                          <span className="text-text-primary">{crawlLimit} records max</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Schedule</span>
                          <span className="text-text-primary capitalize">{schedule} execution</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-6">
                    {/* AI Agents */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-text-secondary uppercase">Selected pipeline agents</span>
                        <button onClick={() => setStep(3)} className="text-[10px] font-mono text-accent hover:underline">Edit</button>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg flex flex-wrap gap-1.5">
                        {selectedAgents.ocr && <span className="chip chip-purple text-[9px] py-0.5 px-2">OCR PARSER</span>}
                        {selectedAgents.extractor && <span className="chip chip-cyan text-[9px] py-0.5 px-2">GPT-4O EXTRACTOR</span>}
                        {selectedAgents.validator && <span className="chip chip-success text-[9px] py-0.5 px-2">SCHEMA GUARD</span>}
                        {selectedAgents.cleaner && <span className="chip chip-purple text-[9px] py-0.5 px-2">NORMALIZATION</span>}
                        {selectedAgents.eda && <span className="chip chip-cyan text-[9px] py-0.5 px-2">EDA STATS</span>}
                        {selectedAgents.export && <span className="chip chip-success text-[9px] py-0.5 px-2">S3 EXPORTER</span>}
                      </div>
                    </div>

                    {/* Validation */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-text-secondary uppercase">Quality & validation checks</span>
                        <button onClick={() => setStep(4)} className="text-[10px] font-mono text-accent hover:underline">Edit</button>
                      </div>
                      <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-lg space-y-2.5 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Predicted Compliance</span>
                          <span className="text-success font-bold">{qualityScore.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Auto-fix overrides</span>
                          <span className="text-text-primary">{fixesApplied.coerceFloat || fixesApplied.fillMuted ? 'Applied' : 'None'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Schema elements</span>
                          <span className="text-text-primary">{schemaFields.length} attributes detected</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex gap-4 font-mono text-[10px] text-text-secondary">
                    <div>
                      <span>RUN COST:</span> <span className="text-accent font-bold">${resourceStats.cost}/hr</span>
                    </div>
                    <div>
                      <span>ESTIMATED RUNTIME:</span> <span className="text-text-primary font-bold">~2m 45s</span>
                    </div>
                  </div>
                  <button
                    onClick={triggerLaunchFlow}
                    className="btn-primary py-3 px-6 text-xs font-semibold font-mono uppercase tracking-wide inline-flex items-center gap-2 rounded-md hover:shadow-glow-accent cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    [LAUNCH_INGEST_PIPELINE]
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div
              key="step-6"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="card bg-[#060606] border border-white/[0.04] rounded-xl p-6 md:p-8 space-y-6 max-w-4xl mx-auto text-left relative overflow-hidden min-h-[500px]">
                {/* Visual grid blueprint background overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                  backgroundImage: 'linear-gradient(to right, #FF7A00 1px, transparent 1px), linear-gradient(to bottom, #FF7A00 1px, transparent 1px)',
                  backgroundSize: '30px 30px'
                }} />

                <div>
                  <h3 className="text-sm font-bold font-mono text-text-primary uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-accent animate-pulse" />
                    [AUTONOMOUS_PIPELINE_PROVISIONS_CONSOLE]
                  </h3>
                  <p className="text-[10px] text-text-secondary mt-1">
                    System logs container. Activating server slots, parsing nodes, and loading schema validations.
                  </p>
                </div>

                {/* Animated status list */}
                <div className="space-y-3.5 max-w-lg">
                  {[
                    { text: 'Source target connected & authenticated', activeStage: 1 },
                    { text: 'OCR line bounding box parser initialized', activeStage: 2, condition: selectedAgents.ocr },
                    { text: 'LLM extractor entities mappings allocated', activeStage: 3 },
                    { text: 'Validation schema checks resolved', activeStage: 4 },
                    { text: 'Parquet column commits initialized', activeStage: 5 },
                  ].map((stage, i) => {
                    if (stage.condition === false) return null;
                    const isCompleted = launchStage > stage.activeStage;
                    const isActive = launchStage === stage.activeStage;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="font-mono text-xs text-text-tertiary select-none">0{i+1}.</span>
                        <div
                          className={cn(
                            'w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 text-[8px] font-bold font-mono transition-all',
                            isCompleted
                              ? 'bg-success/15 border-success text-success'
                              : isActive
                              ? 'bg-accent/15 border-accent text-accent animate-pulse'
                              : 'bg-white/[0.01] border-white/10 text-text-tertiary'
                          )}
                        >
                          {isCompleted ? '✓' : isActive ? '●' : ''}
                        </div>
                        <span className={cn(
                          'text-xs font-mono transition-all',
                          isCompleted ? 'text-success' : isActive ? 'text-accent font-semibold' : 'text-text-secondary'
                        )}>
                          {stage.text}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated Scrolling Terminal output log box */}
                <div className="space-y-1">
                  <span className="text-[9px] font-mono font-semibold text-text-tertiary uppercase">Console Standard Out</span>
                  <div
                    ref={terminalRef}
                    className="h-[180px] overflow-y-auto font-mono text-[10px] text-text-secondary space-y-1 bg-black border border-white/[0.04] p-4 rounded-lg text-left"
                  >
                    {terminalLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                    {launchStage < 6 && (
                      <span className="inline-block w-1.5 h-3.5 bg-accent/60 ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[9px] text-text-secondary uppercase">
                    <span>Provisioning progress</span>
                    <span>{Math.min(100, Math.round((launchStage / 6) * 100))}%</span>
                  </div>
                  <div className="h-2 border border-white/5 bg-white/[0.01] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-300"
                      style={{ width: `${(launchStage / 6) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Completed Action button */}
                <AnimatePresence>
                  {launchStage === 6 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-2 flex justify-center"
                    >
                      <button
                        onClick={() => navigate('/agents')}
                        className="btn-primary py-3 px-6 text-xs font-semibold font-mono uppercase tracking-wide inline-flex items-center gap-2 rounded-md hover:shadow-glow-accent cursor-pointer"
                      >
                        [GO_TO_COORDINATION_MONITOR]
                        <ExternalLink className="w-3.5 h-3.5 text-black" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Nav Controls */}
      {step < 5 && (
        <div className="mt-8 pt-4 border-t border-white/[0.04] flex items-center justify-between">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1}
            className="btn-secondary py-2 px-4 text-xs font-mono uppercase tracking-wide inline-flex items-center gap-1.5 rounded-md disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          
          <button
            onClick={() => setStep(step + 1)}
            className="btn-primary py-2 px-5 text-xs font-semibold font-mono uppercase tracking-wide inline-flex items-center gap-1.5 rounded-md cursor-pointer"
          >
            Next
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="mt-8 pt-4 border-t border-white/[0.04] flex items-center justify-between">
          <button
            onClick={() => setStep(4)}
            className="btn-secondary py-2 px-4 text-xs font-mono uppercase tracking-wide inline-flex items-center gap-1.5 rounded-md cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
      )}
    </div>
  );
}

// Custom simple ChevronRight icon to avoid lucide imports conflicts
function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
