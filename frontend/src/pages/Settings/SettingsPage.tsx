import { useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Shield, Key, Save, Plus, CheckCircle2 } from 'lucide-react';
import { staggerContainer } from '@/styles/animations';
import { cn } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created: string;
  status: 'active' | 'revoked';
}

export default function SettingsPage() {
  const [workspaceName, setWorkspaceName] = useState('DataForge Operations Core');
  const [organization, setOrganization] = useState('DataForge AI Dev Team');
  const [debugLevel, setDebugLevel] = useState('INFO');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: 'key_1', name: 'Production Scraper Daemon', prefix: 'df_live_a8f9...', created: '2026-05-12', status: 'active' },
    { id: 'key_2', name: 'Local Ingest Dev Key', prefix: 'df_dev_9b1c...', created: '2026-06-01', status: 'active' },
  ]);
  const [newKeyName, setNewKeyName] = useState('');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const newKey: ApiKey = {
      id: `key_${Date.now()}`,
      name: newKeyName,
      prefix: 'df_live_' + Math.random().toString(36).substring(2, 6) + '...',
      created: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    setApiKeys([...apiKeys, newKey]);
    setNewKeyName('');
  };

  const handleRevokeKey = (id: string) => {
    setApiKeys(apiKeys.map((k) => k.id === id ? { ...k, status: 'revoked' as const } : k));
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="page-section max-w-[1440px] mx-auto text-left"
    >
      {/* Header */}
      <div className="page-header border-b border-white/[0.04] pb-4 mb-4">
        <h1 className="font-dashboard-title text-text-primary font-mono uppercase tracking-wider">[WORKSPACE_SETTINGS_NODE]</h1>
        <p className="text-xs text-text-secondary mt-1">
          Configure security authorization keys, workspace scopes, and system diagnostics overrides.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
        {/* Left Column: General Configuration Forms */}
        <div className="space-y-6">
          {/* Workspace Settings form */}
          <div className="card bg-[#0D0D0D] border border-white/[0.04] rounded-md !p-6">
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-white/[0.04]">
              <div className="w-8 h-8 rounded bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                <Settings className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold font-mono uppercase text-text-primary tracking-wider">[SYS_PROPERTIES]</h2>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="settings-workspace-name" className="block text-xs font-mono font-semibold text-text-secondary uppercase">Workspace Identifier</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="input-base"
                    required
                    id="settings-workspace-name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="settings-org-name" className="block text-xs font-mono font-semibold text-text-secondary uppercase">Parent Organization</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="input-base"
                    required
                    id="settings-org-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="settings-debug-level" className="block text-xs font-mono font-semibold text-text-secondary uppercase">Stdout Diagnostic Level</label>
                <select
                  value={debugLevel}
                  onChange={(e) => setDebugLevel(e.target.value)}
                  className="input-base bg-[#151515] h-[38px] py-1 cursor-pointer"
                  id="settings-debug-level"
                >
                  <option value="DEBUG">DEBUG (All events + packet logs)</option>
                  <option value="INFO">INFO (Default system status logs)</option>
                  <option value="WARN">WARN (Only validation alerts & errors)</option>
                  <option value="ERROR">ERROR (Strict failure events only)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                {saveSuccess && (
                  <span className="text-xs text-success font-mono flex items-center gap-1.5 animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    PROPERTIES_UPDATED
                  </span>
                )}
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-xs font-semibold font-mono uppercase tracking-wide inline-flex items-center gap-2 rounded-md ml-auto"
                >
                  <Save className="w-3.5 h-3.5" />
                  [COMMIT_CHANGES]
                </button>
              </div>
            </form>
          </div>

          {/* API Keys Configuration */}
          <div className="card bg-[#0D0D0D] border border-white/[0.04] rounded-md !p-6">
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-white/[0.04]">
              <div className="w-8 h-8 rounded bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                <Key className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold font-mono uppercase text-text-primary tracking-wider">[API_AUTHORIZATION_KEYS]</h2>
            </div>

            <form onSubmit={handleGenerateKey} className="flex gap-3 items-end mb-6">
              <div className="flex-1 space-y-2 text-left">
                <label htmlFor="key-name-input" className="block text-xs font-mono font-semibold text-text-secondary uppercase">New key identifier</label>
                <input
                  type="text"
                  placeholder="e.g. Scraper Daemon #3"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="input-base"
                  id="key-name-input"
                />
              </div>
              <button
                type="submit"
                className="btn-primary py-2.5 px-4 text-xs font-semibold font-mono uppercase tracking-wide inline-flex items-center gap-1.5 rounded-md h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" />
                [GENERATE]
              </button>
            </form>

            {/* Keys Table list */}
            <div className="space-y-1 overflow-x-auto">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_80px] gap-4 px-3 py-2 text-[10px] font-bold font-mono text-text-secondary uppercase tracking-widest border-b border-white/[0.04] bg-[#151515] rounded mb-2">
                <span>Key Label</span>
                <span>Prefix</span>
                <span>Created</span>
                <span className="text-right">Action</span>
              </div>
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className={cn(
                    'grid grid-cols-[1.5fr_1fr_1fr_80px] gap-4 px-3 py-2.5 items-center border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01]',
                    k.status === 'revoked' && 'opacity-50'
                  )}
                >
                  <span className="text-xs font-mono font-bold text-text-primary truncate">{k.name}</span>
                  <span className="text-xs font-mono text-text-secondary">{k.prefix}</span>
                  <span className="text-xs font-mono text-text-secondary">{k.created}</span>
                  <div className="text-right">
                    {k.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleRevokeKey(k.id)}
                        className="text-[9px] font-mono border border-danger/20 text-danger hover:bg-danger/5 px-2 py-0.5 rounded transition-all"
                      >
                        REVOKE
                      </button>
                    ) : (
                      <span className="text-[9px] font-mono text-text-tertiary">REVOKED</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Security Diagnostics panel */}
        <div className="card bg-[#0D0D0D] border border-white/[0.04] rounded-md !p-6 flex flex-col justify-between min-h-[420px]">
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-white/[0.04]">
              <div className="w-8 h-8 rounded bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                <Shield className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold font-mono uppercase text-text-primary tracking-wider">[SECURITY_STATUS]</h2>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="flex justify-between border-b border-white/[0.02] pb-2">
                <span className="text-text-secondary uppercase">SOC2 Compliance</span>
                <span className="text-success font-bold">VERIFIED_SECURE</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.02] pb-2">
                <span className="text-text-secondary uppercase">Ingestion Sandbox</span>
                <span className="text-success font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.02] pb-2">
                <span className="text-text-secondary uppercase">Transport Encryption</span>
                <span className="text-text-primary">TLS_1.3_AES_256</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.02] pb-2">
                <span className="text-text-secondary uppercase">Active Node ID</span>
                <span className="text-accent font-bold">df_node_west_01</span>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] text-text-secondary font-mono leading-relaxed bg-black/30 border border-white/[0.04] p-3 rounded">
                WARNING: API keys grant complete write permissions to the extraction registry. Never commit keys directly to public repositories or expose in client scripts.
              </p>
            </div>
          </div>

          <div className="text-[9px] font-mono text-text-secondary border-t border-white/[0.04] pt-3">
            SYSTEM_UPTIME: 142 hours normal ops.
          </div>
        </div>
      </div>
    </motion.div>
  );
}
