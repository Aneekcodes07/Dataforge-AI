import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Globe, FileText, Table, Sheet, Plug, Image, ArrowRight } from 'lucide-react';
import { SOURCE_TYPES } from '@/lib/constants';
import { scrollReveal, scrollRevealItem } from '@/styles/animations';

const iconMap: Record<string, React.ElementType> = {
  Globe,
  FileText,
  Table,
  Sheet,
  Plug,
  Image,
};

export default function QuickStart() {
  const navigate = useNavigate();

  return (
    <motion.div
      variants={scrollReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className="card"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight">Select Data Source</h3>
          <p className="text-xs text-text-tertiary mt-1">Choose a connector to configure a new extraction pipeline</p>
        </div>
        <button
          onClick={() => navigate('/extraction')}
          className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
        >
          View all sources
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {SOURCE_TYPES.map((source) => {
          const Icon = iconMap[source.icon] || Globe;

          return (
            <motion.button
              key={source.id}
              variants={scrollRevealItem}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/extraction')}
              className="relative flex flex-col items-center gap-3 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer group text-center overflow-hidden"
            >
              {/* Top color accent */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `linear-gradient(90deg, ${source.color}, transparent)` }}
              />

              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all"
                style={{
                  backgroundColor: `${source.color}10`,
                  border: `1px solid ${source.color}18`,
                }}
              >
                <Icon
                  className="w-5 h-5 transition-colors"
                  style={{ color: source.color }}
                />
              </div>
              <div>
                <span className="text-[12px] font-semibold text-text-secondary group-hover:text-text-primary transition-colors block">
                  {source.label}
                </span>
                <span className="text-[10px] text-text-muted mt-0.5 block leading-tight">
                  {source.description}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
