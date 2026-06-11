import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { staggerContainer, staggerItem } from '@/styles/animations';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
    if (useAuthStore.getState().isAuthenticated) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Brand Side */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden items-center justify-center bg-[#050505] border-r border-white/[0.04]">
        {/* Technical Grid Backdrop */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(rgba(255, 122, 0, 0.06) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.005) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.005) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
        
        {/* Schematic corner annotations */}
        <div className="absolute inset-6 border border-white/[0.02] pointer-events-none flex flex-col justify-between p-6">
          <div className="flex justify-between text-[10px] font-mono text-text-tertiary">
            <span>[DATAFORGE_SYS_SEC]</span>
            <span>SYS_GATE_01 // SECURE_LAYER</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-text-tertiary">
            <span>LOC_COORD_37.7749_-122.4194</span>
            <span>AUTH_NODE_OK</span>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-[480px] px-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-[4px] border border-[#FF7A00]/30 bg-[#FF7A00]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#FF7A00]" />
            </div>
            <span className="text-xl font-bold font-mono tracking-wider text-text-primary uppercase">
              Data<span className="text-[#FF7A00]">Forge</span> <span className="text-[10px] text-text-tertiary font-normal">v1.0.0</span>
            </span>
          </div>

          <h2 className="text-2xl font-bold font-mono uppercase text-text-primary tracking-wide mb-4">
            [AI_DATA_PIPELINE_ENGINE]
          </h2>
          <p className="text-text-secondary font-mono text-xs leading-relaxed mb-8">
            Autonomous AI agents designed to extract, sanitize, analyze, and export schema-validated datasets from any public website, file document, or JSON API endpoint.
          </p>

          {/* Technical Telemetry Diagnostics */}
          <div className="space-y-3 font-mono">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block mb-1 text-left">
              // PIPELINE_SYS_STATUS
            </span>
            {[
              { label: 'OP_DATA_STREAM', value: '2,847 ROWS/SEC', status: 'ACTIVE' },
              { label: 'OP_QUALITY_SCORE', value: '99.1% VALID', status: 'STABLE' },
              { label: 'OP_AGENTS_ONLINE', value: '07 PIPELINES', status: 'READY' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center justify-between border border-white/[0.04] bg-[#0D0D0D] p-3 rounded-[4px] text-xs"
              >
                <span className="text-text-secondary">{stat.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-text-primary font-bold">{stat.value}</span>
                  <span className="text-[10px] text-[#FF7A00] bg-[#FF7A00]/5 border border-[#FF7A00]/20 px-1.5 py-0.5 rounded-[2px]">{stat.status}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form Side */}
      <div className="lg:w-[52%] flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="w-full max-w-[460px]"
        >
          {/* Mobile logo */}
          <motion.div variants={staggerItem} className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-[4px] border border-[#FF7A00]/30 bg-[#FF7A00]/10 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-[#FF7A00]" />
            </div>
            <span className="text-lg font-bold font-mono tracking-wider text-text-primary uppercase">
              Data<span className="text-[#FF7A00]">Forge</span>
            </span>
          </motion.div>

          <motion.div variants={staggerItem} className="border-b border-white/[0.04] pb-4 mb-6 text-left">
            <h1 className="font-mono text-sm font-bold uppercase tracking-wider text-text-primary">
              [USER_AUTHENTICATION]
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Enter credentials to initiate secure engineering environment session.
            </p>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 px-3.5 py-2.5 rounded-[4px] bg-[#EF4444]/5 border border-[#EF4444]/20 text-[#EF4444] text-xs font-mono flex items-start gap-2.5"
            >
              <Zap className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <span className="font-bold">[ERR_AUTH_FAILURE]:</span> {error}
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <motion.div variants={staggerItem} className="space-y-2 text-left font-mono">
              <label htmlFor="login-email" className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                // Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  placeholder="user@dataforge.ai"
                  className="input-base pl-10 rounded-[4px] font-mono text-xs"
                  required
                  id="login-email"
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div variants={staggerItem} className="space-y-2 text-left font-mono">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                  // Password
                </label>
                <a href="#" className="text-[11px] text-accent hover:text-[#EA580C] transition-colors">
                  Forgot credential?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  placeholder="••••••••••••"
                  className="input-base pl-10 pr-10 rounded-[4px] font-mono text-xs"
                  required
                  id="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>

            {/* Submit */}
            <motion.div variants={staggerItem} className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  'w-full py-3 bg-[#FF7A00] hover:bg-[#EA580C] text-black font-mono font-bold uppercase tracking-wider text-xs rounded-[4px] flex items-center justify-center gap-2 cursor-pointer transition-all duration-200',
                  isLoading && 'opacity-70 cursor-not-allowed'
                )}
                id="login-submit"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    [INITIATE_SESSION]
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          </form>

          {/* Divider */}
          <motion.div variants={staggerItem} className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/[0.04]" />
            <span className="text-[9px] font-mono text-text-tertiary uppercase tracking-widest">federated credentials</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </motion.div>

          {/* Social */}
          <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 font-mono">
            <button className="flex items-center justify-center gap-2 py-2.5 rounded-[4px] border border-white/[0.04] bg-[#0D0D0D] hover:bg-white/[0.02] text-xs text-text-primary cursor-pointer transition-colors duration-200">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              GOOGLE
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 rounded-[4px] border border-white/[0.04] bg-[#0D0D0D] hover:bg-white/[0.02] text-xs text-text-primary cursor-pointer transition-colors duration-200">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              GITHUB
            </button>
          </motion.div>

          {/* Sign up link */}
          <motion.p variants={staggerItem} className="text-center mt-8 text-xs text-text-secondary font-mono">
            Session path unregistered?{' '}
            <Link to="/signup" className="text-accent hover:text-[#EA580C] font-bold transition-colors">
              [REGISTER_NEW_NODE]
            </Link>
          </motion.p>

          {/* Demo credentials hint */}
          <motion.div variants={staggerItem} className="mt-8 border border-white/[0.04] bg-[#0D0D0D] p-3 rounded-[4px] text-left relative overflow-hidden font-mono text-[11px] text-text-tertiary">
            <div className="absolute top-0 right-0 bg-accent/10 border-b border-l border-accent/20 px-2 py-0.5 text-[8px] text-accent font-bold">
              DEMO_ACCESS
            </div>
            <p className="mb-1 text-text-secondary font-bold">// LOCAL_TEST_ENVIRONMENT_BYPASS:</p>
            <p>EMAIL: <span className="text-text-primary font-bold">aneek@dataforge.ai</span></p>
            <p>PASSWORD: <span className="text-text-primary font-bold">admin123</span></p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

