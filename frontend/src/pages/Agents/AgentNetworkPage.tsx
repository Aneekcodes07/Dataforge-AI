import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useAgentStore, type AgentStatus } from '@/stores/agentStore';
import { useProjectStore } from '@/stores/projectStore';
import { Terminal, RefreshCw, CheckCircle2, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentNodeData {
  id: string;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  desc: string;
  model: string;
  prompt: string;
}

const agents: AgentNodeData[] = [
  {
    id: 'ingestion',
    label: 'Ingestion',
    subtitle: 'SQL',
    x: 80,
    y: 150,
    desc: 'Reads raw file bytes, downloads URLs, or connects to REST endpoints. Extracts document format schemas.',
    model: 'DataForge-Ingest-v1',
    prompt: 'INSPECT payload headers, DETERMINE encoding scheme, STREAM chunks to parsing layers.',
  },
  {
    id: 'ocr',
    label: 'OCR Parsing',
    subtitle: 'SQL',
    x: 220,
    y: 80,
    desc: 'Extracts structural layout nodes and OCR content from image blocks and layout documents.',
    model: 'Tesseract-LLM-Hybrid',
    prompt: 'PARSE boxes, RECONSTRUCT columns, EXTRACT text nodes, EMIT layout tables.',
  },
  {
    id: 'extractor',
    label: 'Extractor',
    subtitle: 'GILE',
    x: 220,
    y: 220,
    desc: 'Uses prompt parsing structures to extract raw text coordinates into json relational properties.',
    model: 'gpt-4o-mini',
    prompt: 'EXTRACT entities, MATCH schema keys, ALIGN column typings, DISCARD noisy layout text.',
  },
  {
    id: 'schema',
    label: 'Schema Builder',
    subtitle: 'GILE',
    x: 380,
    y: 150,
    desc: 'Maps properties into a standardized, unified schema table and infers column labels.',
    model: 'Llama-3-70b-Schema',
    prompt: 'INFER properties, ALIGN with base schema constraints, ASSIGN strict data types.',
  },
  {
    id: 'validator',
    label: 'Validator',
    subtitle: 'RLL',
    x: 540,
    y: 80,
    desc: 'Examines data types, missing records, range constraints, and flags structural quality alerts.',
    model: 'DataForge-Quality-v2',
    prompt: 'CHECK null values, REPORT standard deviations, SCORE row completions, EMIT warning logs.',
  },
  {
    id: 'cleaner',
    label: 'Cleaner',
    subtitle: 'GILE',
    x: 540,
    y: 220,
    desc: 'Cleans, formats, converts, and imputes null values to maximize downstream model training compatibility.',
    model: 'DataForge-Clean-v1',
    prompt: 'IMPUTE missing ranges, REMOVE duplicates, STANDARDIZE timestamps, NORMALIZE strings.',
  },
  {
    id: 'ml',
    label: 'ML Ready',
    subtitle: 'CALE',
    x: 700,
    y: 150,
    desc: 'Prepares final exports, computes feature importance levels, and exports to parquet datasets.',
    model: 'Feature-Engineer-v1',
    prompt: 'COMPUTE training weights, EVALUATE model readiness, EXPORT structured dataset files.',
  },
];

const connections = [
  { from: 'ingestion', to: 'ocr', latency: '24ms', throughput: '1.2MB/s' },
  { from: 'ingestion', to: 'extractor', latency: '35ms', throughput: '800KB/s' },
  { from: 'ocr', to: 'schema', latency: '12ms', throughput: '2.4MB/s' },
  { from: 'extractor', to: 'schema', latency: '18ms', throughput: '1.5MB/s' },
  { from: 'schema', to: 'validator', latency: '15ms', throughput: '3.1MB/s' },
  { from: 'schema', to: 'cleaner', latency: '20ms', throughput: '2.8MB/s' },
  { from: 'validator', to: 'ml', latency: '8ms', throughput: '4.5MB/s' },
  { from: 'cleaner', to: 'ml', latency: '10ms', throughput: '4.2MB/s' },
];

function getAgent(id: string) {
  return agents.find((a) => a.id === id)!;
}

export default function AgentNetworkPage() {
  const { activePipeline, progress, agentStatuses, logs, stats, disconnectWebSocket } = useAgentStore();
  const { currentProject } = useProjectStore();
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeData | null>(agents[0]);
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'running':
        return '#FF7A00';
      case 'completed':
        return '#22C55E';
      case 'failed':
        return '#EF4444';
      default:
        return '#52525B';
    }
  };

  return (
    <div className="page-section max-w-[1440px] mx-auto text-left">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.04] pb-4 mb-4">
        <div>
          <h1 className="font-dashboard-title text-text-primary font-mono uppercase tracking-wider">[AGENT_COORDINATION_NETWORK]</h1>
          <p className="text-xs text-text-secondary mt-1">
            {activePipeline === 'running'
              ? `PROCESSING PIPELINE HOST: ${currentProject?.name || 'Active Ingestion Node'}`
              : 'Diagnostics panel. Click on any network agent logic node to inspect or override settings.'}
          </p>
        </div>

        {activePipeline === 'running' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-accent/5 border border-accent/20 text-xs text-accent font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>PIPELINE_RUNNING ({progress}%)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
        {/* SVG Agent Visualization Canvas */}
        <div className="card bg-[#0D0D0D] border border-white/[0.04] rounded-md relative overflow-hidden flex flex-col justify-center min-h-[480px] lg:min-h-[520px]">
          {/* Diagnostic Blueprint Grid Overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.15 }}>
            <div className="absolute inset-0" style={{
              backgroundImage: 'linear-gradient(to right, rgba(255,122,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,122,0,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />
            {/* Draw blueprint crosshairs */}
            <span className="absolute top-4 left-4 text-[9px] font-mono text-text-secondary">GRID_REF: 42°N-84°W</span>
            <span className="absolute bottom-4 right-4 text-[9px] font-mono text-text-secondary">SYS_COORD_A1</span>
            <div className="absolute top-1/2 left-4 -translate-y-1/2 text-[9px] font-mono text-text-secondary">+</div>
            <div className="absolute top-1/2 right-4 -translate-y-1/2 text-[9px] font-mono text-text-secondary">+</div>
          </div>

          <svg viewBox="0 0 780 300" className="w-full h-auto relative z-10 overflow-visible">
            {/* Draw connections */}
            {connections.map((conn) => {
              const from = getAgent(conn.from);
              const to = getAgent(conn.to);
              const fromStatus = agentStatuses[from.id] || 'idle';
              const isFlowing = fromStatus === 'completed' || fromStatus === 'running';

              return (
                <g key={`${conn.from}-${conn.to}`}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={fromStatus === 'completed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth="1"
                  />

                  {/* Flow animation indicator */}
                  {isFlowing && (
                    <>
                      <motion.line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="rgba(255, 122, 0, 0.4)"
                        strokeWidth="1.2"
                        strokeDasharray="6 6"
                        initial={{ strokeDashoffset: 100 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      />
                      <motion.circle
                        cx={from.x}
                        cy={from.y}
                        r="2"
                        fill="#FFB347"
                        initial={{ cx: from.x, cy: from.y, opacity: 0 }}
                        animate={{
                          cx: [from.x, to.x],
                          cy: [from.y, to.y],
                          opacity: [0, 1, 1, 0],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </>
                  )}

                  {/* Path Diagnostic metrics text */}
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 6}
                    textAnchor="middle"
                    className="fill-text-secondary font-mono text-[7px] select-none uppercase font-semibold tracking-wider opacity-60"
                  >
                    {conn.latency}
                  </text>
                </g>
              );
            })}

            {/* Draw nodes */}
            {agents.map((agent) => {
              const status = agentStatuses[agent.id] || 'idle';
              const isSelected = selectedAgent?.id === agent.id;
              const nodeColor = getStatusColor(status);

              return (
                <g
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="cursor-pointer"
                >
                  {/* Outer Pulsing Glow */}
                  {status === 'running' && (
                    <motion.g
                      style={{ transformOrigin: `${agent.x}px ${agent.y}px` }}
                      animate={{ scale: [1, 1.25, 1], opacity: [0.1, 0.4, 0.1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    >
                      <rect
                        x={agent.x - 24}
                        y={agent.y - 24}
                        width="48"
                        height="48"
                        rx="2"
                        fill="none"
                        stroke="#FF7A00"
                        strokeWidth="1"
                      />
                    </motion.g>
                  )}

                  {/* Main Rectangle Node Shape (Hexagonal industrial feel) */}
                  <rect
                    x={agent.x - 20}
                    y={agent.y - 20}
                    width="40"
                    height="40"
                    rx="2"
                    fill={isSelected ? '#151515' : '#0D0D0D'}
                    stroke={isSelected ? '#FF7A00' : nodeColor}
                    strokeWidth={isSelected ? 2 : 1.5}
                    className="transition-all duration-200"
                  />

                  {/* Node icon placeholder letter */}
                  <text
                    x={agent.x}
                    y={agent.y + 4}
                    textAnchor="middle"
                    className={cn(
                      'font-mono text-[9px] font-bold select-none tracking-tighter',
                      isSelected ? 'fill-accent' : 'fill-text-primary'
                    )}
                  >
                    {agent.label.substring(0, 3).toUpperCase()}
                  </text>

                  {/* Agent Label */}
                  <text
                    x={agent.x}
                    y={agent.y + 34}
                    textAnchor="middle"
                    className={cn(
                      'text-[10px] font-bold font-mono uppercase select-none transition-colors tracking-tight',
                      isSelected ? 'fill-accent' : 'fill-text-primary'
                    )}
                  >
                    {agent.label}
                  </text>

                  {/* Subtitle Badge */}
                  <rect
                    x={agent.x - 16}
                    y={agent.y + 40}
                    width="32"
                    height="12"
                    rx="1"
                    fill="#151515"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <text
                    x={agent.x}
                    y={agent.y + 49}
                    textAnchor="middle"
                    className="fill-text-secondary text-[7px] font-mono select-none"
                  >
                    {agent.subtitle}
                  </text>

                  {/* Completed status indicator badge */}
                  {status === 'completed' && (
                    <rect
                      x={agent.x + 10}
                      y={agent.y - 24}
                      width="12"
                      height="8"
                      rx="1"
                      fill="#22C55E"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right side: Operations Terminal / Agent Tuning Controls */}
        <div className="space-y-6">
          {/* Active Terminal Stream */}
          {activePipeline !== 'idle' && (
            <div className="card flex flex-col min-h-[240px] !p-4 bg-[#0D0D0D] border border-white/[0.04] rounded-md">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 mb-3 text-text-primary">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider">Operational stdout</span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse ml-auto" />
              </div>

              {/* Scrolling Log Window */}
              <div className="flex-1 overflow-y-auto font-mono text-[10px] text-text-secondary space-y-2 bg-black/40 rounded border border-white/[0.04] p-3 text-left max-h-[160px]">
                {logs.length === 0 ? (
                  <p className="text-text-tertiary">[WAITING_DATA_INGEST_PACKETS]</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="leading-relaxed">
                      <span className="text-accent font-bold">[{log.agentId.toUpperCase()}]</span>{' '}
                      <span>{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>

              {/* Stats Summary upon completion */}
              {activePipeline === 'completed' && stats && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-success/5 border border-success/15 rounded"
                >
                  <p className="text-xs font-bold font-mono text-success flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    PIPELINE_COMPLETE_SUCCESS
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center font-mono">
                    <div className="bg-white/[0.02] border border-white/[0.04] p-1 rounded">
                      <p className="text-[8px] text-text-secondary uppercase">rows</p>
                      <p className="text-xs font-bold text-text-primary">{stats.rowCount}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] p-1 rounded">
                      <p className="text-[8px] text-text-secondary uppercase">cols</p>
                      <p className="text-xs font-bold text-text-primary">{stats.columnCount}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] p-1 rounded">
                      <p className="text-[8px] text-text-secondary uppercase">quality</p>
                      <p className="text-xs font-bold text-success">{stats.qualityScore}%</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Hyperparameter Tuner Panel */}
          <div className="card !p-5 md:!p-6 bg-[#0D0D0D] border border-white/[0.04] rounded-md text-left flex flex-col justify-between min-h-[300px]">
            {selectedAgent ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold font-mono text-text-primary uppercase tracking-wider">{selectedAgent.label} Tuner</h3>
                      <p className="text-[9px] font-mono text-text-secondary">{selectedAgent.model}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-white/[0.02] border border-white/[0.06] text-text-secondary px-1.5 py-0.5 rounded">
                    SYS_NODE_OK
                  </span>
                </div>

                {/* Hyperparameter tuning controls */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-text-secondary uppercase">LLM Temperature</span>
                      <span className="text-accent font-bold">{temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-accent h-1 bg-white/[0.04] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-text-secondary uppercase">Max Output Tokens</span>
                      <span className="text-accent font-bold">{maxTokens}</span>
                    </div>
                    <input
                      type="range"
                      min="256"
                      max="8192"
                      step="256"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-accent h-1 bg-white/[0.04] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-text-secondary uppercase">Chunk Size Overlap</span>
                      <span className="text-accent font-bold">{chunkOverlap} B</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                      className="w-full accent-accent h-1 bg-white/[0.04] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold font-mono text-text-secondary uppercase">Active System Instructions</span>
                    <pre className="text-[10px] font-mono bg-black/30 border border-white/[0.04] p-2 rounded max-h-[80px] overflow-y-auto leading-relaxed text-text-tertiary select-all">
                      {selectedAgent.prompt}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs font-mono text-text-secondary text-center my-auto">[SELECT_NODE_IN_BLUEPRINT]</p>
            )}

            <div className="mt-4 border-t border-white/[0.04] pt-3 text-[9px] font-mono text-text-secondary">
              SYSTEM_SECURE_NODE: DataForge Ops managed under SOC2.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
