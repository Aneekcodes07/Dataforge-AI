import { motion } from 'motion/react';
import { Upload, Cpu, Download } from 'lucide-react';
import { scrollReveal, scrollRevealItem } from '@/styles/animations';
import LandingSectionHeader from './LandingSectionHeader';

const steps = [
  {
    icon: Upload,
    title: 'Connect raw source',
    description: 'Point at a URL, database, API endpoint, or drop static documents. Schema parser resolves headers dynamically.',
    step: '[STEP_01]',
  },
  {
    icon: Cpu,
    title: 'Agent routing execution',
    description: 'The coordinated AI network runs validation, structure inferring, and cleaning layers in parallel.',
    step: '[STEP_02]',
  },
  {
    icon: Download,
    title: 'Ship ML-Ready Parquet',
    description: 'Download parquet files or stream directly to target warehouses. Every batch emits a verifiable quality score.',
    step: '[STEP_03]',
  },
];

export default function HowItWorks() {
  return (
    <section className="landing-section bg-[#050505] border-b border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <LandingSectionHeader
          eyebrow="Operations logic"
          title="Data pipeline automation workflow"
          description="A deterministic ingestion system managed by autonomous agents. No glue code. No maintenance."
        />

        <motion.div
          variants={scrollReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                variants={scrollRevealItem}
                className="border border-white/[0.04] bg-[#0D0D0D] p-6 rounded-md hover:border-accent/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-mono text-accent uppercase tracking-widest">{step.step}</span>
                    <div className="w-8 h-8 rounded-md bg-accent/5 flex items-center justify-center border border-accent/10">
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold font-mono uppercase text-text-primary tracking-tight mb-2">{step.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
