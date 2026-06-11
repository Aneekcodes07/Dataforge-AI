import { motion } from 'motion/react';
import {
  Globe, FileText, Plug, ScanEye, Sparkles, BarChart3, Brain, MessageSquare, Network,
} from 'lucide-react';
import { LANDING_FEATURES, type LandingFeatureTier } from '@/lib/constants';
import { scrollReveal, scrollRevealItem } from '@/styles/animations';
import LandingSectionHeader from './LandingSectionHeader';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Globe, FileText, Plug, ScanEye, Sparkles, BarChart3, Brain, MessageSquare, Network,
};

const tierStyles: Record<LandingFeatureTier, string> = {
  featured:
    'col-span-1 sm:col-span-2 p-6 sm:p-8 border-white/[0.06] bg-[#0D0D0D]',
  standard: 'p-5 bg-[#0D0D0D]',
  supporting: 'p-4 bg-[#0D0D0D] opacity-90',
};

const tierTitleStyles: Record<LandingFeatureTier, string> = {
  featured: 'text-sm sm:text-base font-bold font-mono uppercase tracking-tight',
  standard: 'text-xs font-bold font-mono uppercase tracking-tight',
  supporting: 'text-xs font-semibold font-mono uppercase tracking-tight',
};

const tierDescStyles: Record<LandingFeatureTier, string> = {
  featured: 'text-xs sm:text-sm text-text-secondary leading-relaxed',
  standard: 'text-xs text-text-secondary leading-relaxed',
  supporting: 'text-[11px] text-text-secondary leading-relaxed',
};

export default function FeaturesGrid() {
  const featured = LANDING_FEATURES.filter((f) => f.tier === 'featured');
  const standard = LANDING_FEATURES.filter((f) => f.tier === 'standard');
  const supporting = LANDING_FEATURES.filter((f) => f.tier === 'supporting');

  const renderCard = (feature: (typeof LANDING_FEATURES)[number]) => {
    const Icon = iconMap[feature.icon] || Globe;

    return (
      <motion.div
        key={feature.title}
        variants={scrollRevealItem}
        className={cn(
          'rounded-md border border-white/[0.04] transition-colors hover:border-accent/20 flex flex-col justify-between',
          tierStyles[feature.tier]
        )}
      >
        <div>
          <div
            className={cn(
              'rounded-md flex items-center justify-center mb-5 border border-white/[0.04]',
              feature.tier === 'featured' ? 'w-10 h-10' : feature.tier === 'standard' ? 'w-8 h-8' : 'w-7 h-7'
            )}
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
          >
            <Icon
              className={cn(
                feature.tier === 'featured' ? 'w-5 h-5' : feature.tier === 'standard' ? 'w-4 h-4' : 'w-3.5 h-3.5'
              )}
              style={{ color: '#FF7A00' }}
            />
          </div>

          {feature.tier === 'featured' && (
            <span className="text-[9px] font-mono uppercase tracking-widest text-accent mb-2 block">
              [SYSTEM_CAPABILITY]
            </span>
          )}

          <h3 className={cn('text-text-primary mb-2', tierTitleStyles[feature.tier])}>
            {feature.title}
          </h3>
          <p className={cn(tierDescStyles[feature.tier])}>
            {feature.description}
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <section className="landing-section relative bg-[#050505] border-b border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <LandingSectionHeader
          eyebrow="Platform specs"
          title="Engineered for data operations"
          description="A dense ecosystem of automated extractors, formatters, quality score checks, and export pipelines."
        />

        <motion.div
          variants={scrollReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.08 }}
          className="space-y-4"
        >
          {/* Featured row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map(renderCard)}
          </div>

          {/* Standard row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {standard.map(renderCard)}
          </div>

          {/* Supporting row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {supporting.map(renderCard)}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
