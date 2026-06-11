import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, Terminal } from 'lucide-react';
import { scrollReveal, scrollRevealItem } from '@/styles/animations';
import LandingSectionHeader from './LandingSectionHeader';
import { cn } from '@/lib/utils';

type AgentStatus = 'idle' | 'running' | 'completed';

interface AgentNodeData {
  id: string;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  delay: number;
  isHub?: boolean;
}

const agents: AgentNodeData[] = [
  { id: 'ingestion', label: 'Ingestion', subtitle: 'SQL', x: 80, y: 150, delay: 0, isHub: true },
  { id: 'ocr', label: 'OCR', subtitle: 'SQL', x: 250, y: 80, delay: 0.2 },
  { id: 'extractor', label: 'Extractor', subtitle: 'GILE', x: 250, y: 220, delay: 0.35 },
  { id: 'schema', label: 'Schema', subtitle: 'GILE', x: 420, y: 150, delay: 0.5 },
  { id: 'validator', label: 'Validator', subtitle: 'RLL', x: 590, y: 80, delay: 0.65 },
  { id: 'cleaner', label: 'Cleaner', subtitle: 'GILE', x: 590, y: 220, delay: 0.8 },
  { id: 'ml', label: 'ML Export', subtitle: 'CALE', x: 760, y: 150, delay: 1.0 },
];

const connections = [
  { from: 'ingestion', to: 'ocr' },
  { from: 'ingestion', to: 'extractor' },
  { from: 'ocr', to: 'schema' },
  { from: 'extractor', to: 'schema' },
  { from: 'schema', to: 'validator' },
  { from: 'schema', to: 'cleaner' },
  { from: 'validator', to: 'ml' },
  { from: 'cleaner', to: 'ml' },
];

const PIPELINE_ORDER = ['ingestion', 'ocr', 'extractor', 'schema', 'validator', 'cleaner', 'ml'];

const LIVE_LOGS = [
  { agent: 'INGESTION', message: 'Connected to source — streaming 2,847 rows' },
  { agent: 'OCR', message: 'Layout nodes parsed — 12 table regions detected' },
  { agent: 'SCHEMA', message: 'Inferred 12 columns with strict typing' },
  { agent: 'VALIDATOR', message: 'Quality score: 96.0% — 3 warnings flagged' },
  { agent: 'ML', message: 'Export ready — parquet dataset generated' },
];

function getAgent(id: string) {
  return agents.find((a) => a.id === id)!;
}

function AgentSymbol({ id }: { id: string }) {
  switch (id) {
    case 'ingestion':
      return (
        <g stroke="currentColor" strokeWidth="1.5" fill="none">
          <path d="M-8,-4 L8,-4 L8,4 L-8,4 Z" />
          <line x1="-4" y1="-4" x2="-4" y2="4" />
          <line x1="0" y1="-4" x2="0" y2="4" />
          <line x1="4" y1="-4" x2="4" y2="4" />
        </g>
      );
    case 'ocr':
      return (
        <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M-8,-8 L-12,-8 L-12,-4 M12,-4 L12,-8 L8,-8 M8,8 L12,8 L12,4 M-12,4 L-12,8 L-8,8" />
          <line x1="-5" y1="0" x2="5" y2="0" strokeWidth="2" />
        </g>
      );
    case 'extractor':
      return (
        <g stroke="currentColor" strokeWidth="1.5" fill="none">
          <path d="M-9,-6 C-9,-8.5 9,-8.5 9,-6 C9,-3.5 -9,-3.5 -9,-6 Z" />
          <path d="M-9,-6 L-9,0 C-9,2 9,2 9,0 L9,-6" />
          <path d="M-9,0 L-9,6 C-9,8 9,8 9,6 L9,0" />
        </g>
      );
    case 'schema':
      return (
        <g stroke="currentColor" strokeWidth="1.5" fill="none">
          <rect x="-8" y="-8" width="16" height="16" rx="1.5" />
          <line x1="-8" y1="-2" x2="8" y2="-2" />
          <line x1="-8" y1="3" x2="8" y2="3" />
          <line x1="-2" y1="-8" x2="-2" y2="8" />
        </g>
      );
    case 'validator':
      return (
        <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-9,-8 L0,-11 L9,-8 L9,-1 C9,4 3,9 0,11 C-3,9 -9,4 -9,-1 Z" />
          <path d="M-4,0 L-1,3 L4,-3" strokeWidth="2" />
        </g>
      );
    case 'cleaner':
      return (
        <g fill="currentColor">
          <path d="M-6,-2 C-3,-2 -2,-3 -2,-6 C-2,-3 -1,-2 2,-2 C-1,-2 -2,-1 -2,2 C-2,-1 -3,-2 -6,-2 Z" />
          <path d="M4,4 C6,4 7,3 7,1 C7,3 8,4 10,4 C8,4 7,5 7,7 C7,5 6,4 4,4 Z" />
        </g>
      );
    case 'ml':
      return (
        <g stroke="currentColor" strokeWidth="1.5" fill="none">
          <circle cx="-6" cy="-5" r="1.5" fill="currentColor" />
          <circle cx="-6" cy="5" r="1.5" fill="currentColor" />
          <circle cx="6" cy="0" r="1.5" fill="currentColor" />
          <line x1="-4.5" y1="-3.8" x2="4.5" y2="-1" />
          <line x1="-4.5" y1="3.8" x2="4.5" y2="1" />
        </g>
      );
    default:
      return <circle cx="0" cy="0" r="4" fill="currentColor" />;
  }
}

function statusColor(status: AgentStatus) {
  switch (status) {
    case 'running':
      return '#F97316';
    case 'completed':
      return '#22C55E';
    default:
      return '#52525B';
  }
}

export default function AgentPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % PIPELINE_ORDER.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % LIVE_LOGS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const agentStatuses: Record<string, AgentStatus> = {};
  PIPELINE_ORDER.forEach((id, i) => {
    if (i < activeIndex) agentStatuses[id] = 'completed';
    else if (i === activeIndex) agentStatuses[id] = 'running';
    else agentStatuses[id] = 'idle';
  });

  const runningAgent = agents.find((a) => a.id === PIPELINE_ORDER[activeIndex]);
  const progress = Math.round(((activeIndex + 1) / PIPELINE_ORDER.length) * 100);

  return (
    <section id="agent-network" className="landing-section relative bg-[#060606] border-b border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <LandingSectionHeader
          eyebrow="Core differentiator"
          title="Agent network that runs your pipeline"
          description="Seven specialized agents process data in sequence — ingestion through ML export — with live status, progress tracking, and terminal output."
          align="left"
          className="max-w-2xl"
        />

        <motion.div
          variants={scrollReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] overflow-hidden"
        >
          {/* Status bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.06] bg-[#111111]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
                <Activity className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-medium text-accent">Pipeline active</span>
              </div>
              {runningAgent && (
                <span className="text-sm text-text-secondary">
                  Processing: <span className="text-text-primary font-medium">{runningAgent.label}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 min-w-[140px]">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <span className="text-xs font-mono text-text-tertiary tabular-nums w-8">{progress}%</span>
            </div>
          </div>

          {/* Network canvas */}
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div
              className="absolute inset-0 opacity-[0.025] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />

            <svg viewBox="0 0 840 300" className="w-full h-auto relative z-10" aria-label="Agent network diagram">
              {connections.map((conn) => {
                const from = getAgent(conn.from);
                const to = getAgent(conn.to);
                const fromStatus = agentStatuses[from.id];
                const isFlowing = fromStatus === 'completed' || fromStatus === 'running';

                return (
                  <g key={`${conn.from}-${conn.to}`}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={fromStatus === 'completed' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)'}
                      strokeWidth="1.5"
                    />
                    {isFlowing && (
                      <>
                        <motion.line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="rgba(249,115,22,0.35)"
                          strokeWidth="1.5"
                          strokeDasharray="5 5"
                          animate={{ strokeDashoffset: [0, -20] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        />
                        <motion.circle
                          cx={from.x}
                          cy={from.y}
                          r="2"
                          fill="#F97316"
                          animate={{
                            cx: [from.x, to.x],
                            cy: [from.y, to.y],
                            opacity: [0, 1, 0],
                          }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </>
                    )}
                  </g>
                );
              })}

              {agents.map((agent) => {
                const status = agentStatuses[agent.id];
                const nodeColor = statusColor(status);
                const nodeR = agent.isHub ? 28 : 24;

                return (
                  <g key={agent.id}>
                    {status === 'running' && (
                      <motion.g
                        style={{ transformOrigin: `${agent.x}px ${agent.y}px` }}
                        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.35, 0.15] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <circle
                          cx={agent.x}
                          cy={agent.y}
                          r={nodeR + 8}
                          fill="none"
                          stroke="#F97316"
                          strokeWidth="1"
                        />
                      </motion.g>
                    )}

                    <circle
                      cx={agent.x}
                      cy={agent.y}
                      r={nodeR}
                      fill="#0c0c0c"
                      stroke={nodeColor}
                      strokeWidth={agent.isHub ? 2.5 : 2}
                    />

                    {status === 'completed' && (
                      <circle cx={agent.x + nodeR - 4} cy={agent.y - nodeR + 4} r="5" fill="#22C55E" />
                    )}

                    <g transform={`translate(${agent.x}, ${agent.y})`} className="text-accent">
                      <AgentSymbol id={agent.id} />
                    </g>

                    <text
                      x={agent.x}
                      y={agent.y + nodeR + 18}
                      textAnchor="middle"
                      className={cn(
                        'text-[12px] font-semibold select-none',
                        status === 'running' ? 'fill-accent' : 'fill-text-primary'
                      )}
                    >
                      {agent.label}
                    </text>

                    <rect
                      x={agent.x - 20}
                      y={agent.y + nodeR + 24}
                      width="40"
                      height="14"
                      rx="3"
                      fill="#151515"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <text
                      x={agent.x}
                      y={agent.y + nodeR + 34}
                      textAnchor="middle"
                      className="fill-text-tertiary font-mono text-[8px] select-none uppercase"
                    >
                      {status === 'running' ? 'active' : status === 'completed' ? 'done' : agent.subtitle}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Live terminal */}
          <div className="border-t border-white/[0.06] bg-[#080808] px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-xs font-medium text-text-secondary">Terminal output</span>
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse ml-1" />
            </div>
            <motion.div
              key={logIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-[11px] text-text-tertiary"
            >
              <span className="text-accent">[{LIVE_LOGS[logIndex].agent}]</span>{' '}
              {LIVE_LOGS[logIndex].message}
            </motion.div>
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div
          variants={scrollRevealItem}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-wrap gap-6 mt-8 text-sm text-text-tertiary"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success" /> Completed
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> Processing
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-text-muted" /> Queued
          </span>
        </motion.div>
      </div>
    </section>
  );
}
