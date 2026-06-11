import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import { staggerContainer, staggerItem } from '@/styles/animations';
import ProductPreview from './ProductPreview';

const PRODUCT_METRICS = [
  { value: '7', label: 'Specialized AI agents' },
  { value: '6', label: 'Ingestion source types' },
  { value: '94.2%', label: 'Avg. data quality score' },
];

export default function HeroSection() {
  return (
    <section className="landing-section relative overflow-hidden border-b border-white/[0.04] bg-background">
      {/* Subtle background — no particles or heavy glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-background" />
        <div
          className="absolute top-0 right-0 w-[min(600px,80vw)] h-[min(600px,60vh)] opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle at 70% 20%, rgba(255,122,0,0.4) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '72px 72px',
          }}
        />
      </div>

      {/* Top nav */}
      <header className="relative z-20 max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-text-primary tracking-tight">
            Data<span className="text-accent">Forge</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden sm:inline-flex text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="btn-primary text-sm px-4 py-2"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero content */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="relative z-10 max-w-7xl mx-auto px-6 pt-6 pb-12 lg:pt-8 lg:pb-16 flex flex-col items-center"
      >
        {/* Copy */}
        <div className="text-center max-w-[700px] flex flex-col items-center mb-12">
          <motion.p
            variants={staggerItem}
            className="text-accent text-xs font-semibold uppercase tracking-[0.14em] mb-4"
          >
            Data engineering platform
          </motion.p>

          <motion.h1
            variants={staggerItem}
            className="font-hero text-text-primary mb-6"
          >
            Extract, clean, and ship{' '}
            <span className="text-accent">ML-ready datasets</span>
          </motion.h1>

          <motion.p
            variants={staggerItem}
            className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl mb-8"
          >
            Connect any source — URLs, PDFs, APIs, spreadsheets — and let a coordinated
            agent network handle extraction, validation, and export.
          </motion.p>

          <motion.div variants={staggerItem} className="flex flex-col sm:flex-row justify-center gap-3 mb-8 w-full sm:w-auto">
            <Link
              to="/signup"
              className="btn-primary text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2 group font-semibold"
            >
              Start free workspace
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="btn-secondary text-sm px-5 py-2.5 inline-flex items-center justify-center font-medium"
            >
              View demo account
            </Link>
          </motion.div>

          {/* Believable product metrics */}
          <motion.div
            variants={staggerItem}
            className="flex flex-wrap justify-center gap-6 pt-6 border-t border-white/[0.04] w-full"
          >
            {PRODUCT_METRICS.map((stat) => (
              <div key={stat.label} className="min-w-[120px] max-w-[200px] flex-1 text-center font-mono">
                <p className="text-3xl font-extrabold text-accent tabular-nums">{stat.value}</p>
                <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-2">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Product preview */}
        <motion.div variants={staggerItem} className="w-full flex justify-center">
          <ProductPreview />
        </motion.div>
      </motion.div>
    </section>
  );
}
