import {
  LayoutDashboard,
  Globe,
  Database,
  BarChart3,
  Brain,
  Network,
  MessageSquare,
  Download,
  Users,
  History,
  Bell,
  type LucideIcon,
} from 'lucide-react';

/* ===== Navigation ===== */
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
  group: 'core' | 'analysis' | 'ai' | 'workspace';
}

export const NAV_ITEMS: NavItem[] = [
  // Core
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', group: 'core' },
  { id: 'extraction', label: 'Extraction', icon: Globe, path: '/extraction', badge: 3, group: 'core' },
  { id: 'datasets', label: 'Datasets', icon: Database, path: '/datasets', group: 'core' },
  // Analysis
  { id: 'eda', label: 'EDA', icon: BarChart3, path: '/eda', group: 'analysis' },
  { id: 'ml', label: 'ML Insights', icon: Brain, path: '/ml', group: 'analysis' },
  // AI
  { id: 'agents', label: 'Agent Network', icon: Network, path: '/agents', group: 'ai' },
  { id: 'copilot', label: 'Copilot', icon: MessageSquare, path: '/copilot', group: 'ai' },
  // Workspace
  { id: 'export', label: 'Export', icon: Download, path: '/export', group: 'workspace' },
  { id: 'team', label: 'Team', icon: Users, path: '/team', group: 'workspace' },
  { id: 'history', label: 'History', icon: History, path: '/history', group: 'workspace' },
  { id: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications', group: 'workspace' },
];

export const NAV_GROUPS: { key: string; label: string }[] = [
  { key: 'core', label: 'Core' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'ai', label: 'AI' },
  { key: 'workspace', label: 'Workspace' },
];

/* ===== Mock Users ===== */
export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: '1',
    name: 'Aneek Manna',
    email: 'aneek@dataforge.ai',
    role: 'Admin',
  },
  {
    id: '2',
    name: 'Demo User',
    email: 'demo@dataforge.ai',
    role: 'Member',
  },
];

/* ===== Mock Dashboard Stats ===== */
export interface StatCardData {
  id: string;
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  iconName: 'database' | 'loader' | 'shield' | 'brain';
  color: string;
  sparklineData: number[];
}

export const MOCK_STATS: StatCardData[] = [
  {
    id: 'total-datasets',
    label: 'Total Datasets',
    value: '24',
    change: 12,
    changeLabel: '+12% this month',
    iconName: 'database',
    color: '#A78BFA',
    sparklineData: [12, 15, 13, 18, 16, 20, 22, 24],
  },
  {
    id: 'active-extractions',
    label: 'Active Extractions',
    value: '3',
    change: 0,
    changeLabel: 'Running now',
    iconName: 'loader',
    color: '#22D3EE',
    sparklineData: [1, 2, 1, 3, 2, 4, 2, 3],
  },
  {
    id: 'data-quality',
    label: 'Data Quality',
    value: '94.2%',
    change: 2.1,
    changeLabel: '+2.1% improvement',
    iconName: 'shield',
    color: '#22C55E',
    sparklineData: [88, 89, 91, 90, 92, 93, 93, 94],
  },
  {
    id: 'ml-models',
    label: 'ML Models Ready',
    value: '8',
    change: 3,
    changeLabel: '+3 this week',
    iconName: 'brain',
    color: '#FF7A00',
    sparklineData: [3, 3, 4, 5, 5, 6, 7, 8],
  },
];

/* ===== Mock Projects ===== */
export interface MockProject {
  id: string;
  name: string;
  sourceType: 'url' | 'pdf' | 'csv' | 'api' | 'excel' | 'image';
  status: 'completed' | 'in_progress' | 'failed' | 'queued';
  rowCount: number;
  columnCount: number;
  lastModified: Date;
  qualityScore: number;
}

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: 'p1',
    name: 'E-commerce Products',
    sourceType: 'url',
    status: 'completed',
    rowCount: 2847,
    columnCount: 12,
    lastModified: new Date(Date.now() - 1000 * 60 * 5),
    qualityScore: 96,
  },
  {
    id: 'p2',
    name: 'Financial Report Q4',
    sourceType: 'pdf',
    status: 'in_progress',
    rowCount: 1543,
    columnCount: 8,
    lastModified: new Date(Date.now() - 1000 * 60 * 15),
    qualityScore: 88,
  },
  {
    id: 'p3',
    name: 'Customer Survey Data',
    sourceType: 'csv',
    status: 'completed',
    rowCount: 12500,
    columnCount: 24,
    lastModified: new Date(Date.now() - 1000 * 60 * 60),
    qualityScore: 92,
  },
  {
    id: 'p4',
    name: 'Weather API Feed',
    sourceType: 'api',
    status: 'completed',
    rowCount: 8760,
    columnCount: 15,
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 3),
    qualityScore: 99,
  },
  {
    id: 'p5',
    name: 'Inventory Spreadsheet',
    sourceType: 'excel',
    status: 'failed',
    rowCount: 0,
    columnCount: 0,
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 6),
    qualityScore: 0,
  },
  {
    id: 'p6',
    name: 'Receipt OCR Batch',
    sourceType: 'image',
    status: 'queued',
    rowCount: 0,
    columnCount: 0,
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 12),
    qualityScore: 0,
  },
];

/* ===== Mock Activity Feed ===== */
export interface ActivityItem {
  id: string;
  type: 'extraction' | 'cleaning' | 'analysis' | 'ml' | 'export' | 'error';
  message: string;
  timestamp: Date;
  projectName?: string;
}

export const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: 'a1',
    type: 'extraction',
    message: 'Extraction completed: 2,847 rows from amazon.com',
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    projectName: 'E-commerce Products',
  },
  {
    id: 'a2',
    type: 'cleaning',
    message: 'Data cleaning finished — 99.1% quality score achieved',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    projectName: 'Customer Survey Data',
  },
  {
    id: 'a3',
    type: 'ml',
    message: 'New ML model recommendation: Random Forest (F1: 0.94)',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    projectName: 'Weather API Feed',
  },
  {
    id: 'a4',
    type: 'analysis',
    message: 'EDA report generated with 12 insights',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    projectName: 'Financial Report Q4',
  },
  {
    id: 'a5',
    type: 'export',
    message: 'Dataset exported as CSV (12,500 rows)',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    projectName: 'Customer Survey Data',
  },
  {
    id: 'a6',
    type: 'error',
    message: 'Extraction failed: Invalid file format detected',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
    projectName: 'Inventory Spreadsheet',
  },
];

/* ===== Source Types ===== */
export const SOURCE_TYPES = [
  { id: 'url', label: 'Website', icon: 'Globe', description: 'Scrape any website', color: '#6366F1' },
  { id: 'pdf', label: 'PDF', icon: 'FileText', description: 'Extract from PDFs', color: '#EF4444' },
  { id: 'csv', label: 'CSV', icon: 'Table', description: 'Import CSV files', color: '#10B981' },
  { id: 'excel', label: 'Excel', icon: 'Sheet', description: 'Import spreadsheets', color: '#22C55E' },
  { id: 'api', label: 'API', icon: 'Plug', description: 'Connect to APIs', color: '#F59E0B' },
  { id: 'image', label: 'Image', icon: 'Image', description: 'OCR from images', color: '#8B5CF6' },
] as const;

/* ===== Landing Page Features ===== */
export type LandingFeatureTier = 'featured' | 'standard' | 'supporting';

export const LANDING_FEATURES: ReadonlyArray<{
  title: string;
  description: string;
  icon: string;
  color: string;
  tier: LandingFeatureTier;
}> = [
  {
    title: 'Multi-Source Extraction',
    description:
      'Ingest from websites, documents, spreadsheets, APIs, and images. One workspace configures every source type with schema-aware extraction.',
    icon: 'Globe',
    color: '#F97316',
    tier: 'featured',
  },
  {
    title: 'Agent Pipeline',
    description:
      'Seven specialized agents orchestrate ingestion, OCR, schema mapping, validation, cleaning, and ML export — with live terminal monitoring.',
    icon: 'Network',
    color: '#F97316',
    tier: 'featured',
  },
  {
    title: 'PDF Extraction',
    description: 'OCR, table detection, and layout parsing for scanned and native PDFs.',
    icon: 'FileText',
    color: '#EF4444',
    tier: 'standard',
  },
  {
    title: 'API Connector',
    description: 'REST endpoints with custom headers, auth, and pagination support.',
    icon: 'Plug',
    color: '#F59E0B',
    tier: 'standard',
  },
  {
    title: 'Data Cleaning',
    description: 'Automated imputation, deduplication, type coercion, and outlier handling.',
    icon: 'Sparkles',
    color: '#22D3EE',
    tier: 'standard',
  },
  {
    title: 'EDA Dashboard',
    description: 'Correlation matrices, distributions, and insight reports on every dataset.',
    icon: 'BarChart3',
    color: '#10B981',
    tier: 'standard',
  },
  {
    title: 'Image OCR',
    description: 'Extract tables and text from receipts, scans, and layout images.',
    icon: 'ScanEye',
    color: '#8B5CF6',
    tier: 'supporting',
  },
  {
    title: 'ML Recommendations',
    description: 'Model suggestions, feature importance, and training readiness scores.',
    icon: 'Brain',
    color: '#EC4899',
    tier: 'supporting',
  },
  {
    title: 'Dataset Copilot',
    description: 'Ask questions about your data and generate visualizations in natural language.',
    icon: 'MessageSquare',
    color: '#FB923C',
    tier: 'supporting',
  },
] as const;
