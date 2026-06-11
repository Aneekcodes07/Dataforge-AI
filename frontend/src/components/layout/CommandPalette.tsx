import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  LayoutDashboard,
  Database,
  History as HistoryIcon,
  Sliders,
  Settings,
  Plus,
  Play,
  Download,
  Terminal,
  Sparkles,
  SearchCode,
  CornerDownLeft,
  X
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Datasets & Pipelines';
  icon: React.ElementType;
  shortcut?: string;
  action: (navigate: ReturnType<typeof useNavigate>, setOpen: (open: boolean) => void) => void;
}

const ALL_ITEMS: CommandItem[] = [
  // Navigation
  {
    id: 'nav-dashboard',
    title: 'Go to Dashboard',
    subtitle: 'System metrics and recent projects overview',
    category: 'Navigation',
    icon: LayoutDashboard,
    shortcut: '⌘ D',
    action: (nav, setOpen) => { nav('/dashboard'); setOpen(false); }
  },
  {
    id: 'nav-datasets',
    title: 'Go to Datasets',
    subtitle: 'Explore compiled tables and schemas',
    category: 'Navigation',
    icon: Database,
    shortcut: '⌘ S',
    action: (nav, setOpen) => { nav('/datasets'); setOpen(false); }
  },
  {
    id: 'nav-history',
    title: 'Go to Ingestion History',
    subtitle: 'Audit logs and previous execution states',
    category: 'Navigation',
    icon: HistoryIcon,
    shortcut: '⌘ H',
    action: (nav, setOpen) => { nav('/history'); setOpen(false); }
  },
  {
    id: 'nav-mission-control',
    title: 'Go to Mission Control',
    subtitle: 'Real-time pipeline monitoring interface',
    category: 'Navigation',
    icon: Sliders,
    shortcut: '⌘ M',
    action: (nav, setOpen) => { nav('/history?pipeline=p1'); setOpen(false); }
  },
  {
    id: 'nav-settings',
    title: 'Go to Settings',
    subtitle: 'Workspace preferences and API credentials',
    category: 'Navigation',
    icon: Settings,
    shortcut: '⌘ ,',
    action: (nav, setOpen) => { nav('/settings'); setOpen(false); }
  },
  {
    id: 'nav-copilot',
    title: 'Go to Copilot',
    subtitle: 'Chat with expert AI Data Engineer',
    category: 'Navigation',
    icon: Sparkles,
    shortcut: '⌘ C',
    action: (nav, setOpen) => { nav('/copilot'); setOpen(false); }
  },

  // Actions
  {
    id: 'act-create-pipeline',
    title: 'Create Ingest Pipeline',
    subtitle: 'Configure new scrapers and extractors',
    category: 'Actions',
    icon: Plus,
    shortcut: '⌥ N',
    action: (nav, setOpen) => { nav('/extraction'); setOpen(false); }
  },
  {
    id: 'act-create-dataset',
    title: 'Create Empty Dataset Schema',
    subtitle: 'Initialize metadata table container',
    category: 'Actions',
    icon: Sparkles,
    action: (nav, setOpen) => {
      alert("Opening New Schema Wizard dialog...");
      nav('/datasets');
      setOpen(false);
    }
  },
  {
    id: 'act-run-pipeline',
    title: 'Run Active Crawler Pipeline',
    subtitle: 'Triggers crawler extraction sync',
    category: 'Actions',
    icon: Play,
    action: (nav, setOpen) => {
      alert("Triggering production sync pipeline 'ecommerce-crawl-v3' (pl_ec_crawl_8321)...");
      nav('/history?pipeline=p1');
      setOpen(false);
    }
  },
  {
    id: 'act-export-dataset',
    title: 'Export Parquet Dataset Target',
    subtitle: 'Configure download formats',
    category: 'Actions',
    icon: Download,
    action: (nav, setOpen) => { nav('/datasets?action=export'); setOpen(false); }
  },
  {
    id: 'act-open-logs',
    title: 'Open Ingest Diagnostics Logs',
    subtitle: 'View active crawler console feed',
    category: 'Actions',
    icon: Terminal,
    action: (nav, setOpen) => { nav('/history?pipeline=p1'); setOpen(false); }
  },

  // Datasets & Pipelines Search Matches
  {
    id: 'dp-ecommerce',
    title: 'Pipeline: ecommerce-crawl-v3',
    subtitle: 'pl_ec_crawl_8321 • Web source • 1.87M rows',
    category: 'Datasets & Pipelines',
    icon: Terminal,
    action: (nav, setOpen) => { nav('/history?pipeline=p1'); setOpen(false); }
  },
  {
    id: 'dp-financial',
    title: 'Pipeline: financial-news-Q4',
    subtitle: 'pl_fin_report_4231 • PDF source • 340K rows',
    category: 'Datasets & Pipelines',
    icon: Terminal,
    action: (nav, setOpen) => { nav('/history?pipeline=p2'); setOpen(false); }
  },
  {
    id: 'dp-arxiv',
    title: 'Dataset: arxiv-ml-papers',
    subtitle: 'ds_arxiv_ml_921a • PDF source • 128K rows',
    category: 'Datasets & Pipelines',
    icon: Database,
    action: (nav, setOpen) => { nav('/datasets'); setOpen(false); }
  }
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [simulatedLoading, setSimulatedLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recents from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('df-cmd-recents');
      if (saved) {
        setRecentIds(JSON.parse(saved));
      } else {
        // Seed initial recents
        const seed = ['nav-dashboard', 'act-create-pipeline'];
        setRecentIds(seed);
        localStorage.setItem('df-cmd-recents', JSON.stringify(seed));
      }
    } catch (err) {
      console.error('Failed to load recent commands:', err);
    }
  }, []);

  // Keyboard listener to open palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
      setSimulatedLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Simulate remote loading indicator when query changes
  useEffect(() => {
    if (query) {
      setSimulatedLoading(true);
      setActiveIndex(0);
      const timer = setTimeout(() => {
        setSimulatedLoading(false);
      }, 180);
      return () => clearTimeout(timer);
    } else {
      setSimulatedLoading(false);
      setActiveIndex(0);
    }
  }, [query]);

  // Determine filtered list items
  const filteredItems = useMemo(() => {
    if (!query) {
      return ALL_ITEMS;
    }
    return ALL_ITEMS.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
      item.category.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  // Map active items for recent actions category
  const recentItems = useMemo(() => {
    return recentIds
      .map(id => ALL_ITEMS.find(item => item.id === id))
      .filter((item): item is CommandItem => !!item);
  }, [recentIds]);

  // Combined flat list representing what keyboard indices target
  const flatItemsForKeyboard = useMemo(() => {
    if (simulatedLoading) return [];
    if (query) return filteredItems;
    // If search is empty, show recents first, then all items
    return [...recentItems, ...ALL_ITEMS];
  }, [simulatedLoading, query, filteredItems, recentItems]);

  // Navigate keyboard selection index into scroll view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Intercept keyboard events in input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatItemsForKeyboard.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandPaletteOpen(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % flatItemsForKeyboard.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + flatItemsForKeyboard.length) % flatItemsForKeyboard.length);
        break;
      case 'Enter':
        e.preventDefault();
        triggerItem(flatItemsForKeyboard[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setCommandPaletteOpen(false);
        break;
    }
  };

  const triggerItem = (item: CommandItem) => {
    if (!item) return;
    
    // Add to recents
    const updated = [item.id, ...recentIds.filter(id => id !== item.id)].slice(0, 5);
    setRecentIds(updated);
    try {
      localStorage.setItem('df-cmd-recents', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save recent commands:', err);
    }

    // Run custom routing / alert action
    item.action(navigate, setCommandPaletteOpen);
  };

  // Click outside to close wrapper hook
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setCommandPaletteOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <div 
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-background/60 backdrop-blur-md transition-all"
        >
          {/* Main Card Dialog */}
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "w-full max-w-[560px] bg-neutral-950 border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[440px]",
              "data-[theme=light]:bg-white data-[theme=light]:border-neutral-200"
            )}
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] relative shrink-0">
              <Search className="w-4 h-4 text-text-tertiary" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search navigation, actions, or pipelines..."
                className="flex-1 bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-muted font-sans py-0.5"
              />
              <button 
                onClick={() => setCommandPaletteOpen(false)}
                className="p-1 rounded hover:bg-white/[0.04] text-text-tertiary hover:text-text-primary transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content List Area */}
            <div 
              ref={listRef}
              className="flex-1 overflow-y-auto min-h-0 bg-white/[0.01]"
            >
              {simulatedLoading ? (
                /* Sleek shimmer loader */
                <div className="p-4 space-y-3">
                  <div className="h-3 w-1/4 bg-white/[0.03] rounded animate-pulse" />
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-7 h-7 bg-white/[0.03] rounded animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-white/[0.03] rounded w-1/3 animate-pulse" />
                      <div className="h-2 bg-white/[0.02] rounded w-2/3 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-7 h-7 bg-white/[0.03] rounded animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-white/[0.03] rounded w-1/4 animate-pulse" />
                      <div className="h-2 bg-white/[0.02] rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                </div>
              ) : flatItemsForKeyboard.length === 0 ? (
                /* Premium Empty State */
                <div className="py-14 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-3 text-text-tertiary">
                    <SearchCode className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-xs font-semibold text-text-primary">No results found for "{query}"</p>
                  <p className="text-[10px] text-text-tertiary mt-1 max-w-[280px]">
                    Try refining your search terms or view recent navigation links.
                  </p>
                </div>
              ) : (
                /* Search listings divided by categories */
                <div className="py-2.5">
                  {/* Category: Recents */}
                  {!query && recentItems.length > 0 && (
                    <div className="mb-3">
                      <div className="px-4 py-1 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                        Recent Searches & Actions
                      </div>
                      <div className="mt-1">
                        {recentItems.map((item, idx) => {
                          const active = activeIndex === idx;
                          const ItemIcon = item.icon;
                          return (
                            <div
                              key={`recent-${item.id}`}
                              data-active={active}
                              onClick={() => triggerItem(item)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={cn(
                                "flex items-center justify-between px-4 py-2 cursor-pointer transition-all gap-3 text-xs select-none",
                                active ? "bg-accent-light border-l-[3px] border-accent pl-[13px]" : "hover:bg-white/[0.02]"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={cn(
                                  "w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/[0.04] bg-white/[0.02]",
                                  active && "text-accent"
                                )}>
                                  <ItemIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold text-text-primary block truncate">{item.title}</span>
                                  {item.subtitle && <span className="text-[10px] text-text-tertiary block truncate mt-0.5">{item.subtitle}</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category: Standard list items */}
                  {(() => {
                    const offset = !query ? recentItems.length : 0;
                    
                    // Group elements by category dynamically
                    const grouped = useMemo(() => {
                      const acc: Record<string, { item: CommandItem; globalIdx: number }[]> = {};
                      filteredItems.forEach((item, fIdx) => {
                        if (!acc[item.category]) acc[item.category] = [];
                        acc[item.category].push({ item, globalIdx: fIdx + offset });
                      });
                      return acc;
                    }, [filteredItems, offset]);

                    return Object.entries(grouped).map(([category, list]) => (
                      <div key={category} className="mb-4 last:mb-1">
                        <div className="px-4 py-1 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                          {category}
                        </div>
                        <div className="mt-1">
                          {list.map(({ item, globalIdx }) => {
                            const active = activeIndex === globalIdx;
                            const ItemIcon = item.icon;
                            return (
                              <div
                                key={item.id}
                                data-active={active}
                                onClick={() => triggerItem(item)}
                                onMouseEnter={() => setActiveIndex(globalIdx)}
                                className={cn(
                                  "flex items-center justify-between px-4 py-2 cursor-pointer transition-all gap-3 text-xs select-none",
                                  active ? "bg-accent-light border-l-[3px] border-accent pl-[13px]" : "hover:bg-white/[0.02]"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={cn(
                                    "w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/[0.04] bg-white/[0.02]",
                                    active ? "text-accent border-accent/20 bg-accent/5" : "text-text-secondary"
                                  )}>
                                    <ItemIcon className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-semibold text-text-primary block truncate">{item.title}</span>
                                    {item.subtitle && <span className="text-[10px] text-text-secondary block truncate mt-0.5">{item.subtitle}</span>}
                                  </div>
                                </div>
                                {item.shortcut && (
                                  <kbd className="text-[9px] font-mono text-text-muted bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5 rounded shadow-sm">
                                    {item.shortcut}
                                  </kbd>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Footer Legend */}
            <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-[10px] text-text-tertiary shrink-0">
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="bg-white/[0.03] border border-white/[0.05] px-1 py-0.25 rounded text-[8px]">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-white/[0.03] border border-white/[0.05] px-1 py-0.25 rounded text-[8px] flex items-center gap-0.5">
                    <CornerDownLeft className="w-2 h-2" />
                  </kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-white/[0.03] border border-white/[0.05] px-1 py-0.25 rounded text-[8px]">esc</kbd>
                  close
                </span>
              </div>
              <div className="font-mono text-[9px] text-text-muted">
                ⌘K to open
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
