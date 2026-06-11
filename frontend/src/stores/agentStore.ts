import { create } from 'zustand';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface AgentLog {
  id: string;
  agentId: string;
  message: string;
  timestamp: string;
}

export interface ExtractionStats {
  rowCount: number;
  columnCount: number;
  qualityScore: number;
}

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed';

interface AgentState {
  activePipeline: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  agentStatuses: Record<string, AgentStatus>;
  logs: AgentLog[];
  stats: ExtractionStats | null;
  socket: WebSocket | null;

  connectWebSocket: (projectId: string, onComplete?: (stats: ExtractionStats) => void) => void;
  disconnectWebSocket: () => void;
  resetStore: () => void;

  // Real-time Event Handlers
  handlePipelineStarted: (data: { pipelineId: string; runId: string }) => void;
  handlePipelineProgress: (data: { progress: number; pipelineId: string; runId: string }) => void;
  handlePipelineCompleted: (data: {
    pipelineId: string;
    runId: string;
    rowCount: number;
    columnCount: number;
    qualityScore: number;
    durationSeconds: number;
  }) => void;
  handlePipelineFailed: (data: { pipelineId: string; runId: string; errorMessage: string }) => void;
  handleAgentStatusChanged: (data: { agent: string; status: AgentStatus }) => void;
  handleAgentQueueUpdated: (data: { agent: string; queueSize: number }) => void;
  handleAgentHealthUpdated: (data: { agent: string; health: string; latency: string; throughput: string }) => void;
  handlePipelineLog: (data: { id?: string; agentId: string; message: string; timestamp?: string }) => void;
}

const getWebSocketUrl = (projectId: string) => {
  const isAbsolute = BASE_URL.startsWith('http://') || BASE_URL.startsWith('https://');
  const socketBase = isAbsolute
    ? BASE_URL.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${BASE_URL}`;
  return `${socketBase}/extraction/ws/${projectId}`;
};

const initialAgentStatuses = {
  ingestion: 'idle' as AgentStatus,
  ocr: 'idle' as AgentStatus,
  extractor: 'idle' as AgentStatus,
  schema: 'idle' as AgentStatus,
  validator: 'idle' as AgentStatus,
  cleaner: 'idle' as AgentStatus,
  ml: 'idle' as AgentStatus,
};

export const useAgentStore = create<AgentState>((set, get) => ({
  activePipeline: 'idle',
  progress: 0,
  agentStatuses: { ...initialAgentStatuses },
  logs: [],
  stats: null,
  socket: null,

  connectWebSocket: (projectId, onComplete) => {
    // Clean up existing socket
    get().disconnectWebSocket();

    set({
      activePipeline: 'running',
      progress: 0,
      agentStatuses: { ...initialAgentStatuses },
      logs: [],
      stats: null,
    });

    const url = getWebSocketUrl(projectId);
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'status') {
          get().handleAgentStatusChanged({ agent: data.agent, status: data.status });
        } else if (data.type === 'progress') {
          get().handlePipelineProgress({ progress: data.progress, pipelineId: '', runId: '' });
        } else if (data.type === 'log') {
          get().handlePipelineLog({ agentId: data.agent, message: data.message });
        } else if (data.type === 'completed') {
          const statsPayload = {
            pipelineId: '',
            runId: '',
            rowCount: data.row_count,
            columnCount: data.column_count,
            qualityScore: data.quality_score,
            durationSeconds: 0,
          };
          get().handlePipelineCompleted(statsPayload);
          if (onComplete) {
            onComplete({
              rowCount: data.row_count,
              columnCount: data.column_count,
              qualityScore: data.quality_score,
            });
          }
        } else if (data.type === 'failed') {
          get().handlePipelineFailed({ pipelineId: '', runId: '', errorMessage: data.message || '' });
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      set({ socket: null });
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      set({ activePipeline: 'failed' });
    };

    set({ socket: ws });
  },

  disconnectWebSocket: () => {
    const ws = get().socket;
    if (ws) {
      ws.close();
    }
    set({ socket: null });
  },

  resetStore: () => {
    get().disconnectWebSocket();
    set({
      activePipeline: 'idle',
      progress: 0,
      agentStatuses: { ...initialAgentStatuses },
      logs: [],
      stats: null,
    });
  },

  // Event Handlers
  handlePipelineStarted: (_data) => {
    set({
      activePipeline: 'running',
      progress: 0,
      stats: null,
      agentStatuses: { ...initialAgentStatuses },
      logs: [],
    });
  },

  handlePipelineProgress: (data) => {
    set({ progress: data.progress });
  },

  handlePipelineCompleted: (data) => {
    set({
      activePipeline: 'completed',
      progress: 100,
      stats: {
        rowCount: data.rowCount,
        columnCount: data.columnCount,
        qualityScore: data.qualityScore,
      },
    });
  },

  handlePipelineFailed: (_data) => {
    set({
      activePipeline: 'failed',
    });
  },

  handleAgentStatusChanged: (data) => {
    set((state) => ({
      agentStatuses: {
        ...state.agentStatuses,
        [data.agent]: data.status,
      },
    }));
  },

  handleAgentQueueUpdated: (_data) => {
    // Realtime queue monitoring stats
  },

  handleAgentHealthUpdated: (_data) => {
    // Health metric aggregates
  },

  handlePipelineLog: (data) => {
    const newLog: AgentLog = {
      id: data.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId: data.agentId,
      message: data.message,
      timestamp: data.timestamp || new Date().toISOString(),
    };
    set((state) => ({
      logs: [...state.logs, newLog],
    }));
  },
}));
