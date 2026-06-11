import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Plus,
  Bookmark,
  Sparkles,
  Terminal,
  Sliders,
  AlertTriangle,
  XCircle,
  Play,
  Download,
  Activity,
  Bot,
  User,
  Shield,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { wsService } from '@/lib/websocketService';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  cardType?: 'pipeline' | 'dataset' | 'agent' | 'optimization' | 'activity' | 'cleaning';
}

interface SavedPrompt {
  id: string;
  text: string;
  label: string;
}

interface RecentChat {
  id: string;
  title: string;
  date: string;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);

  const [savedPrompts] = useState<SavedPrompt[]>([
    { id: 'p_1', label: 'Failed Jobs Log', text: 'Show failed pipelines' },
    { id: 'p_2', label: 'Dataset Quality check', text: 'Find low-quality datasets' },
    { id: 'p_3', label: 'Cleaning Rules suggest', text: 'Suggest data cleaning rules' },
    { id: 'p_4', label: 'Optimal Pipeline specs', text: 'Recommend pipeline optimizations' },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat area
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Load or create copilot session on mount
  useEffect(() => {
    async function initSession() {
      try {
        const sessions = await api.get<any[]>('/copilot/sessions');
        let activeSession = sessions[0];

        if (!activeSession) {
          activeSession = await api.post<any>('/copilot/sessions', { title: 'Default Session' });
          sessions.push(activeSession);
        }

        setSessionId(activeSession.id);

        // Fetch session history messages
        const dbMessages = await api.get<any[]>(`/copilot/sessions/${activeSession.id}/messages`);
        const mapped = dbMessages.map((m) => ({
          id: m.id,
          sender: m.sender as 'user' | 'ai',
          text: m.text,
          timestamp: new Date(m.createdAt),
          cardType: m.cardType || undefined,
        }));
        setMessages(mapped);

        // Update sessions sidebar list
        const chats = sessions.map((s) => ({
          id: s.id,
          title: s.title,
          date: new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setRecentChats(chats);

      } catch (err) {
        console.error('Failed to initialize copilot session:', err);
      }
    }
    initSession();
  }, []);

  // Handle session selection
  const handleSelectSession = async (sId: string) => {
    try {
      setSessionId(sId);
      setIsThinking(true);
      const dbMessages = await api.get<any[]>(`/copilot/sessions/${sId}/messages`);
      const mapped = dbMessages.map((m) => ({
        id: m.id,
        sender: m.sender as 'user' | 'ai',
        text: m.text,
        timestamp: new Date(m.createdAt),
        cardType: m.cardType || undefined,
      }));
      setMessages(mapped);
      setIsThinking(false);
    } catch (err) {
      console.error('Failed to load session messages:', err);
      setIsThinking(false);
    }
  };

  // Create a new dialogue session
  const handleNewSession = async () => {
    try {
      const newSession = await api.post<any>('/copilot/sessions', { 
        title: `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      });
      setSessionId(newSession.id);
      setMessages([]);
      setRecentChats((prev) => [
        {
          id: newSession.id,
          title: newSession.title,
          date: 'Just now'
        },
        ...prev
      ]);
    } catch (err) {
      console.error('Failed to create new session:', err);
    }
  };

  // Handle starter prompt click
  const handlePromptClick = (text: string) => {
    setInputText(text);
    setShowLeftSidebar(false);
  };

  // Send message action via WebSockets
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isThinking || !sessionId) return;

    setShowLeftSidebar(false);
    setShowRightSidebar(false);

    const userQuery = inputText;
    const userMsgId = `u_${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: userQuery,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    // AI streaming message placeholder
    const aiMsgId = `ai_${Date.now()}`;
    const streamMsg: Message = {
      id: aiMsgId,
      sender: 'ai',
      text: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, streamMsg]);

    // Subscribe to copilot.streaming events on WebSocket
    const unsubscribe = wsService.subscribe('copilot.streaming', (payload) => {
      // Check session context matches
      if (payload.sessionId !== sessionId) return;

      setIsThinking(false);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? {
                ...msg,
                text: payload.text,
                isStreaming: !payload.done,
                cardType: payload.done ? payload.cardType : undefined,
              }
            : msg
        )
      );

      if (payload.done) {
        unsubscribe();
        
        // Refresh sidebar sessions updatedAt timestamps
        api.get<any[]>('/copilot/sessions').then((sessions) => {
          const chats = sessions.map((s) => ({
            id: s.id,
            title: s.title,
            date: new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setRecentChats(chats);
        });
      }
    });

    // Send query to WebSocket Gateway
    wsService.send('copilot.query', {
      sessionId: sessionId,
      text: userQuery
    });
  };

  // Quick action mock alerts
  const handleQuickAction = (actionLabel: string) => {
    alert(`[ACTION_EXECUTED]: "${actionLabel}" triggered. Pipeline and agent network states synced.`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] gap-0 h-[calc(100vh-4rem)] bg-background text-left relative overflow-hidden -mx-6 md:-mx-10 lg:-mx-12 -my-8 md:-my-10">
      
      {/* Backdrop overlay for mobile */}
      {(showLeftSidebar || showRightSidebar) && (
        <div 
          className="fixed inset-0 top-0 bg-black/60 z-30 lg:hidden" 
          onClick={() => { setShowLeftSidebar(false); setShowRightSidebar(false); }} 
        />
      )}

      {/* 1. LEFT SIDEBAR PANEL */}
      <aside className={cn(
        "absolute lg:static top-0 bottom-0 left-0 z-40 w-[240px] border-r border-white/[0.04] bg-[#070707] flex flex-col justify-between p-4 transition-transform duration-300 lg:translate-x-0 h-full min-h-0",
        showLeftSidebar ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="space-y-6">
          {/* Mobile close button header */}
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-white/[0.04]">
            <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">Sessions</span>
            <button 
              onClick={() => setShowLeftSidebar(false)} 
              className="text-text-secondary hover:text-text-primary p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleNewSession}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-accent text-black font-semibold font-mono text-xs uppercase tracking-wide rounded-md hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>

          {/* Recent sessions */}
          <div className="space-y-2">
            <span className="text-[9px] font-mono font-bold text-text-tertiary uppercase tracking-wider block px-1.5">
              Recent Chats
            </span>
            <div className="space-y-1">
              {recentChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => { handleSelectSession(chat.id); setShowLeftSidebar(false); }}
                  className={cn(
                    "w-full flex flex-col text-left py-2 px-2.5 rounded-lg hover:bg-white/[0.02] text-xs transition-colors group cursor-pointer",
                    chat.id === sessionId ? "bg-white/[0.03]" : ""
                  )}
                >
                  <span className="text-text-secondary group-hover:text-text-primary truncate font-medium">{chat.title}</span>
                  <span className="text-[9px] text-text-tertiary font-mono mt-0.5">{chat.date}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Saved prompt cards */}
          <div className="space-y-2">
            <span className="text-[9px] font-mono font-bold text-text-tertiary uppercase tracking-wider block px-1.5">
              Saved Templates
            </span>
            <div className="space-y-1">
              {savedPrompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePromptClick(p.text)}
                  className="w-full text-left py-2 px-2.5 rounded-lg border border-transparent hover:border-white/[0.04] hover:bg-white/[0.01] text-xs text-text-secondary hover:text-text-primary transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-accent/60 shrink-0" />
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.04] pt-3 text-[9px] font-mono text-text-tertiary block">
          SYS_COPILOT: v2.4-LLM
        </div>
      </aside>

      {/* 2. CENTER CHAT INTERFACE AREA */}
      <main className="flex flex-col justify-between h-full bg-[#050505] min-w-0 w-full">
        {/* Mobile Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-[#080808] shrink-0 lg:hidden">
          <button
            onClick={() => setShowLeftSidebar(true)}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded hover:bg-white/[0.04] cursor-pointer"
            title="Toggle Sidebar"
          >
            <Bot className="w-5 h-5 text-accent" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-primary">
              Copilot Agent [Online]
            </span>
          </div>

          <button
            onClick={() => setShowRightSidebar(true)}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded hover:bg-white/[0.04] cursor-pointer"
            title="Toggle Context"
          >
            <Activity className="w-5 h-5 text-accent" />
          </button>
        </header>
        {/* Messages Feed panel */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 space-y-6">
          {messages.length === 0 ? (
            // Premium Empty State
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center max-w-xl mx-auto py-12">
              <div className="w-12 h-12 rounded-xl bg-accent/5 border border-accent/15 flex items-center justify-center text-accent animate-pulse">
                <Bot className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold font-mono text-text-primary uppercase tracking-wider">[ASK_DATAFORGE_INTELLIGENCE]</h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  DataForge AI Copilot is online. Ask diagnostics query reports, validate S3 schemas, suggest regex cleaners, or inspect agent loads.
                </p>
              </div>

              {/* Starter Prompts grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-4 text-left">
                {[
                  { label: 'Show failed pipelines', desc: 'Find timeout errors in history logs' },
                  { label: 'Suggest data cleaning rules', desc: 'Create JSON data format cleaning schemas' },
                  { label: 'Which agents are overloaded?', desc: 'Review active worker load sizes' },
                  { label: 'Recommend pipeline optimizations', desc: 'Compute allocations to accelerate parsing' },
                ].map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePromptClick(s.label)}
                    className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:border-accent/30 hover:bg-accent/[0.01] transition-all cursor-pointer group"
                  >
                    <p className="text-xs font-mono font-bold text-text-primary group-hover:text-accent flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-accent" />
                      {s.label}
                    </p>
                    <p className="text-[10px] text-text-secondary mt-1">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Active message dialogue stream
            <div className="space-y-6">
              {messages.map((msg) => {
                const isAI = msg.sender === 'ai';
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-4 items-start p-4 rounded-xl border transition-all duration-200 text-left',
                      isAI ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-accent/[0.01] border-accent/15'
                    )}
                  >
                    {/* User or AI Icon wrapper */}
                    <div className={cn(
                      'w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 text-xs font-bold font-mono',
                      isAI ? 'bg-accent/10 border-accent/25 text-accent' : 'bg-white/[0.04] border-white/[0.08] text-text-primary'
                    )}>
                      {isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>

                    {/* Content pane */}
                    <div className="flex-1 min-w-0 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                        <span className="text-xs font-bold font-mono uppercase tracking-wider text-text-primary">
                          {isAI ? 'DATAFORGE_COPILOT' : 'USER_ANEEK'}
                        </span>
                        <span className="text-[9px] font-mono text-text-tertiary">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Text content markdown format styling simulation */}
                      <div className="text-xs text-text-secondary leading-relaxed space-y-3 whitespace-pre-wrap">
                        {/* Custom parsing logic to format code snippets or bold text in UI */}
                        {msg.text.split('\n').map((line, lIdx) => {
                          if (line.startsWith('```')) return null; // Hide raw block wrapper
                          
                          // Format bold texts
                          let element: React.ReactNode = line;
                          if (line.includes('**')) {
                            const parts = line.split('**');
                            element = parts.map((p, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-text-primary">{p}</strong> : p);
                          }
                          
                          // Format inline codes
                          if (line.includes('`')) {
                            const parts = line.split('`');
                            element = parts.map((p, pIdx) => pIdx % 2 === 1 ? <code key={pIdx} className="px-1.5 py-0.5 rounded bg-white/[0.06] text-accent font-mono text-[10px]">{p}</code> : p);
                          }

                          return <p key={lIdx}>{element}</p>;
                        })}
                      </div>

                      {/* Rich Action Intelligence Card injection */}
                      {msg.cardType === 'pipeline' && (
                        <div className="card bg-white/[0.01] border border-danger/20 rounded-xl p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-danger animate-pulse" />
                            <h4 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide">Ingestion Failure Diagnostics</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                            <div className="p-2 bg-white/[0.02] border border-white/[0.04] rounded">
                              <span className="text-text-secondary block">IMPACT LEVEL</span>
                              <span className="text-danger font-bold text-xs uppercase tracking-wide mt-1 block">Critical Error</span>
                            </div>
                            <div className="p-2 bg-white/[0.02] border border-white/[0.04] rounded">
                              <span className="text-text-secondary block">CONFIDENCE RATE</span>
                              <span className="text-accent font-bold text-xs mt-1 block">96% Accuracy</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-text-secondary leading-relaxed">
                            Recommendation: Retry active crawl node. Bypassing validation or rate-limiting is not suggested.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickAction('Restart Ingest pl_ec_crawl_8321')}
                              className="btn-primary py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide rounded"
                            >
                              Restart Ingest Node
                            </button>
                            <button
                              onClick={() => handleQuickAction('Download Logs pl_ec_crawl_8321')}
                              className="btn-secondary py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide rounded"
                            >
                              Download Log File
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.cardType === 'dataset' && (
                        <div className="card bg-white/[0.01] border border-warning/20 rounded-xl p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-warning" />
                            <h4 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide">Data Quality Audit Summary</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                            <div className="p-2 bg-white/[0.02] border border-white/[0.04] rounded">
                              <span className="text-text-secondary block">QUALITY COMPLIANCE</span>
                              <span className="text-warning font-bold text-xs mt-1 block">91.5% score</span>
                            </div>
                            <div className="p-2 bg-white/[0.02] border border-white/[0.04] rounded">
                              <span className="text-text-secondary block">ANOMALY WEIGHT</span>
                              <span className="text-text-primary font-bold text-xs mt-1 block">219 issues detected</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickAction('Auto-impute missing values')}
                              className="btn-primary py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide rounded"
                            >
                              Apply Smart cleaner Fixes
                            </button>
                            <button
                              onClick={() => handleQuickAction('Export datasets logs')}
                              className="btn-secondary py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide rounded"
                            >
                              Verify schema rules
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.cardType === 'cleaning' && (
                        <div className="card bg-white/[0.01] border border-accent/20 rounded-xl p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                            <h4 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide">Auto-Cleaner Rules Config</h4>
                          </div>
                          <pre className="text-[10px] font-mono bg-black/60 border border-white/[0.04] p-3 rounded leading-relaxed text-text-tertiary select-all">
{`{
  "imputations": [
    { "field": "description", "method": "default", "fill_value": "" }
  ],
  "coercions": [
    { "field": "price", "rule": "numeric_float_absolute" }
  ]
}`}
                          </pre>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickAction('Inject cleaning config')}
                              className="btn-primary py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide rounded"
                            >
                              Inject Rules schema
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.cardType === 'agent' && (
                        <div className="card bg-white/[0.01] border border-white/[0.04] rounded-xl p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-accent" />
                            <h4 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide">Worker Node Load Profile</h4>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[9px] text-center">
                            <div className="bg-white/[0.01] border border-white/[0.04] p-2 rounded">
                              <span className="text-text-tertiary block uppercase">CPU core load</span>
                              <span className="text-danger font-bold text-xs mt-1 block">92%</span>
                            </div>
                            <div className="bg-white/[0.01] border border-white/[0.04] p-2 rounded">
                              <span className="text-text-tertiary block uppercase">latency</span>
                              <span className="text-danger font-bold text-xs mt-1 block">114ms</span>
                            </div>
                            <div className="bg-white/[0.01] border border-white/[0.04] p-2 rounded">
                              <span className="text-text-tertiary block uppercase">queue size</span>
                              <span className="text-text-primary font-bold text-xs mt-1 block">14 items</span>
                            </div>
                            <div className="bg-white/[0.01] border border-white/[0.04] p-2 rounded">
                              <span className="text-text-tertiary block uppercase">throughput</span>
                              <span className="text-text-primary font-bold text-xs mt-1 block">2.8K rec/s</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickAction('De-allocate core slots')}
                              className="btn-secondary py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide rounded w-full"
                            >
                              De-allocate worker threads
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.cardType === 'optimization' && (
                        <div className="card bg-white/[0.01] border border-accent/20 rounded-xl p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-accent" />
                            <h4 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide">Pipeline Optimizer Settings</h4>
                          </div>
                          <div className="space-y-2 font-mono text-[10px]">
                            <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                              <span className="text-text-secondary">ESTIMATED SPEED BOOST</span>
                              <span className="text-success font-bold">+24% Throughput</span>
                            </div>
                            <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                              <span className="text-text-secondary">RECOMMENDED INSTANCE</span>
                              <span className="text-text-primary">df.t4.large</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickAction('Apply optimizations')}
                              className="btn-primary py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide rounded"
                            >
                              Apply Optimizations
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.cardType === 'activity' && (
                        <div className="card bg-white/[0.01] border border-white/[0.04] rounded-xl p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-accent" />
                            <h4 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide">Operations Log stats</h4>
                          </div>
                          <div className="space-y-2 font-mono text-[10px]">
                            <div className="flex justify-between border-b border-white/[0.02] pb-1">
                              <span className="text-text-secondary">ACTIVE PIPELINES</span>
                              <span className="text-text-primary">3 Running</span>
                            </div>
                            <div className="flex justify-between border-b border-white/[0.02] pb-1">
                              <span className="text-text-secondary">SYSTEM UPTIME</span>
                              <span className="text-success">142h (Normal)</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">ALERTS ACTIVE</span>
                              <span className="text-warning font-bold">1 warning, 0 critical</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Thinking typewriter simulator */}
              {isThinking && (
                <div className="flex gap-4 items-start p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] text-left">
                  <div className="w-8 h-8 rounded-lg border border-accent/25 bg-accent/10 flex items-center justify-center text-accent shrink-0 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-text-primary">
                      <span>Analyzing pipeline registry</span>
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                      </span>
                    </div>
                    <div className="h-3 bg-white/[0.03] rounded w-2/3 animate-pulse" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar Footer */}
        <div className="p-4 border-t border-white/[0.04] bg-[#0A0A0A]">
          <form onSubmit={handleSendMessage} className="relative flex gap-3 items-end">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask Copilot to optimize crawling slots, debug logs, or generate JSON cleaning rules..."
              className="input-base pr-12 pl-4 py-3 min-h-[44px] max-h-[120px] resize-none bg-surface/40 border border-white/5"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className="absolute right-2.5 bottom-2.5 w-8 h-8 rounded-lg bg-accent text-black hover:bg-accent-hover transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* 3. RIGHT CONTEXT SIDEBAR PANEL */}
      <aside className={cn(
        "absolute lg:static top-0 bottom-0 right-0 z-40 w-[320px] border-l border-white/[0.04] bg-[#070707] p-5 space-y-6 flex flex-col justify-between overflow-y-auto transition-transform duration-300 lg:translate-x-0 h-full",
        showRightSidebar ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="space-y-6">
          {/* Mobile close button header */}
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-white/[0.04]">
            <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">References & Health</span>
            <button 
              onClick={() => setShowRightSidebar(false)} 
              className="text-text-secondary hover:text-text-primary p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Header context */}
          <div className="pb-4 border-b border-white/[0.04]">
            <span className="text-[10px] font-mono font-bold text-text-tertiary uppercase tracking-widest block">
              Workspace Context
            </span>
            <div className="flex items-center gap-2.5 mt-3">
              <div className="w-7 h-7 rounded bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-primary">Aneek Manna</h4>
                <p className="text-[9px] font-mono text-text-secondary uppercase">System Admin Node</p>
              </div>
            </div>
          </div>

          {/* Active Context variables */}
          <div className="space-y-2 text-xs">
            <span className="text-[9px] font-mono font-bold text-text-tertiary uppercase tracking-widest block px-1">
              Live References
            </span>
            <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg space-y-2.5 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-text-secondary">WORKSPACE</span>
                <span className="text-text-primary truncate max-w-[140px]" title="DATAFORGE_AI">DATAFORGE_AI</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">ACTIVE DATASET</span>
                <span className="text-text-primary truncate max-w-[140px]" title="ecommerce-catalog">ecommerce-catalog</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">ACTIVE PIPELINE</span>
                <span className="text-text-primary truncate max-w-[140px]" title="ecommerce-crawl-v3">ecommerce-crawl-v3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">NODE INSTANCE</span>
                <span className="text-accent font-bold">df_node_west_01</span>
              </div>
            </div>
          </div>

          {/* Active Agent Network grid */}
          <div className="space-y-2">
            <span className="text-[9px] font-mono font-bold text-text-tertiary uppercase tracking-widest block px-1">
              Active Agents Health
            </span>
            
            <div className="space-y-2">
              {[
                { name: 'Ingestion Agent', status: 'Completed', tput: '1.2MB/s', col: 'text-success border-success/25 bg-success/5' },
                { name: 'Extractor Agent', status: 'Processing', tput: '2.8K rec/s', col: 'text-accent border-accent/25 bg-accent/5 animate-pulse' },
                { name: 'Validator Agent', status: 'Failed', tput: '0.0MB/s', col: 'text-danger border-danger/25 bg-danger/5' },
                { name: 'ML Export Agent', status: 'Idle', tput: 'Standby', col: 'text-text-tertiary border-white/5 bg-white/[0.01]' },
              ].map((agent, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-white/[0.01] border border-white/[0.04] rounded-lg">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-text-primary truncate">{agent.name}</p>
                    <p className="text-[9px] text-text-secondary mt-0.5 font-mono">Rate: {agent.tput}</p>
                  </div>
                  <span className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border', agent.col)}>
                    {agent.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions panel */}
        <div className="space-y-2 border-t border-white/[0.04] pt-4">
          <span className="text-[9px] font-mono font-bold text-text-tertiary uppercase tracking-widest block px-1 mb-1">
            System Operations
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickAction('Run Pipeline')}
              className="btn-secondary py-1.5 px-2 text-[10px] font-mono uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer"
            >
              <Play className="w-3 h-3 text-success fill-success/10" />
              Run Ingest
            </button>
            <button
              onClick={() => handleQuickAction('Export Dataset')}
              className="btn-secondary py-1.5 px-2 text-[10px] font-mono uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3 text-accent" />
              Export
            </button>
            <button
              onClick={() => handleQuickAction('Open Logs')}
              className="btn-secondary py-1.5 px-2 text-[10px] font-mono uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer col-span-2"
            >
              <Terminal className="w-3 h-3 text-accent" />
              Open Ingest Logs
            </button>
          </div>
        </div>

      </aside>

    </div>
  );
}
