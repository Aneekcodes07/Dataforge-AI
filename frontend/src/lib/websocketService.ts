import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useAgentStore } from '@/stores/agentStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getWebSocketUrl(): string {
  const isAbsolute = BASE_URL.startsWith('http://') || BASE_URL.startsWith('https://');
  const socketBase = isAbsolute
    ? BASE_URL.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${BASE_URL}`;
  return `${socketBase}/ws`;
}

type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'offline';
type EventCallback = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimeoutId: any = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private isConnecting = false;
  private pingIntervalId: any = null;
  private callbacks: Map<string, Set<EventCallback>> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  // Event Subscription
  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }
    this.callbacks.get(event)!.add(callback);
    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event: string, callback: EventCallback) {
    const eventCallbacks = this.callbacks.get(event);
    if (eventCallbacks) {
      eventCallbacks.delete(callback);
      if (eventCallbacks.size === 0) {
        this.callbacks.delete(event);
      }
    }
  }

  private emit(event: string, data: any) {
    const eventCallbacks = this.callbacks.get(event);
    if (eventCallbacks) {
      eventCallbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in event callback for ${event}:`, err);
        }
      });
    }
  }

  // Core Connection Control
  connect() {
    if (this.socket || this.isConnecting) {
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      this.updateState('disconnected');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState('offline');
      return;
    }

    this.isConnecting = true;
    const url = `${getWebSocketUrl()}?token=${encodeURIComponent(token)}`;
    console.log('[WS] Connecting...');

    try {
      this.socket = new WebSocket(url);
      this.socket.onopen = this.handleOpen;
      this.socket.onmessage = this.handleMessage;
      this.socket.onclose = this.handleClose;
      this.socket.onerror = this.handleError;
    } catch (err) {
      console.error('[WS] Connection attempt failed:', err);
      this.handleClose();
    }
  }

  disconnect() {
    this.clearTimers();
    if (this.socket) {
      // Remove event handlers to prevent loops/reconnects on manual disconnect
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
    this.isConnecting = false;
    this.updateState('disconnected');
  }

  send(event: string, data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event, ...data }));
    } else {
      console.warn('[WS] Cannot send message, socket not open');
    }
  }

  // Connection State Update
  private updateState(state: ConnectionState) {
    useUIStore.getState().setConnectionState(state);
  }

  // Timers Cleanup
  private clearTimers() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  // Event Handlers
  private handleOpen = () => {
    console.log('[WS] Connected');
    this.isConnecting = false;
    this.reconnectDelay = 1000; // Reset exponential backoff
    this.updateState('connected');

    // Heartbeat Loop (30 seconds ping)
    this.clearTimers();
    this.pingIntervalId = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send('ping');
      }
    }, 30000);
  };

  private handleMessage = (event: MessageEvent) => {
    if (event.data === 'pong') {
      return;
    }

    try {
      const payload = JSON.parse(event.data);
      const { event: eventName, data } = payload;
      
      if (!eventName) return;

      console.log(`[WS] Event received: ${eventName}`, data);

      // Emit to direct subscribers
      this.emit(eventName, data);

      // Dispatch to global Zustand stores
      this.dispatchToStores(eventName, data);

    } catch (err) {
      console.error('[WS] Failed to parse message', err);
    }
  };

  private handleClose = () => {
    console.log('[WS] Closed');
    this.socket = null;
    this.isConnecting = false;
    this.clearTimers();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState('offline');
    } else {
      this.updateState('reconnecting');
      this.scheduleReconnect();
    }
  };

  private handleError = (err: any) => {
    console.error('[WS] Error:', err);
    // Let onclose handle reconnects
  };

  private scheduleReconnect() {
    this.clearTimers();
    const delay = this.reconnectDelay + Math.random() * 500; // Add jitter
    console.log(`[WS] Reconnecting in ${Math.round(delay)}ms...`);
    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private handleOnline = () => {
    console.log('[WS] Browser back online');
    this.reconnectDelay = 1000;
    this.connect();
  };

  private handleOffline = () => {
    console.log('[WS] Browser went offline');
    this.disconnect();
    this.updateState('offline');
  };

  // Zustand stores event routing
  private dispatchToStores(event: string, data: any) {
    switch (event) {
      // Notifications
      case 'notification.created':
        useUIStore.getState().addNotificationRealtime({
          id: data.id,
          type: data.type,
          title: data.title,
          message: data.message,
          timestamp: new Date(data.timestamp),
          read: data.read
        });
        break;

      case 'notification.read':
        useUIStore.getState().markAsReadRealtime(data.id);
        break;

      // Dashboard Activities
      case 'activity.created':
        useUIStore.getState().addActivityRealtime({
          id: data.id,
          type: data.type || 'extraction',
          message: data.message,
          timestamp: new Date(data.timestamp),
          projectName: data.projectName
        });
        break;

      // Pipeline Run Lifecycle
      case 'pipeline.started':
        useAgentStore.getState().handlePipelineStarted(data);
        break;

      case 'pipeline.progress':
        useAgentStore.getState().handlePipelineProgress(data);
        break;

      case 'pipeline.completed':
        useAgentStore.getState().handlePipelineCompleted(data);
        break;

      case 'pipeline.failed':
        useAgentStore.getState().handlePipelineFailed(data);
        break;

      // Agent Telemetry
      case 'agent.status.changed':
        useAgentStore.getState().handleAgentStatusChanged(data);
        break;

      case 'agent.queue.updated':
        useAgentStore.getState().handleAgentQueueUpdated(data);
        break;

      case 'agent.health.updated':
        useAgentStore.getState().handleAgentHealthUpdated(data);
        break;

      case 'pipeline.log':
        useAgentStore.getState().handlePipelineLog(data);
        break;

      default:
        // Other events can be handled by direct subscribers (e.g. Copilot streaming)
        break;
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;
