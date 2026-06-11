import { motion } from 'motion/react';
import { scrollReveal, scrollRevealItem } from '@/styles/animations';
import { cn } from '@/lib/utils';

interface LandingSectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'center' | 'left';
  className?: string;
}

export default function LandingSectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: LandingSectionHeaderProps) {
  const isCenter = align === 'center';

  return (
    <motion.div
      variants={scrollReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className={cn(
        'mb-12 lg:mb-16',
        isCenter ? 'text-center mx-auto max-w-2xl' : 'text-left max-w-xl',
        className
      )}
    >
      <motion.p
        variants={scrollRevealItem}
        className="text-accent text-xs font-semibold uppercase tracking-[0.14em] mb-3"
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        variants={scrollRevealItem}
        className="font-section-header text-text-primary mb-4"
      >
        {title}
      </motion.h2>
      <motion.p
        variants={scrollRevealItem}
        className={cn(
          'text-base sm:text-lg text-text-secondary leading-relaxed',
          isCenter && 'mx-auto'
        )}
      >
        {description}
      </motion.p>
    </motion.div>
  );
}
