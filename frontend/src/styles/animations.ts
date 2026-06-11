import type { Variants, Transition } from 'motion/react';

/* ===== Spring Physics Constants ===== */
export const springs = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 1 } as Transition,
  smooth: { type: 'spring', stiffness: 300, damping: 30, mass: 1 } as Transition,
  bouncy: { type: 'spring', stiffness: 400, damping: 15, mass: 1 } as Transition,
  gentle: { type: 'spring', stiffness: 200, damping: 20, mass: 1 } as Transition,
  slow: { type: 'spring', stiffness: 100, damping: 20, mass: 1 } as Transition,
};

/* ===== Page Transitions ===== */
export const pageTransition: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    filter: 'blur(4px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { ...springs.smooth, staggerChildren: 0.08 },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(4px)',
    transition: { duration: 0.2 },
  },
};

/* ===== Stagger Containers ===== */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: springs.smooth,
  },
};

/* ===== Scale Animations ===== */
export const scaleIn: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springs.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

/* ===== Slide Animations ===== */
export const slideInLeft: Variants = {
  initial: {
    opacity: 0,
    x: -30,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: springs.smooth,
  },
  exit: {
    opacity: 0,
    x: -30,
    transition: { duration: 0.2 },
  },
};

export const slideInRight: Variants = {
  initial: {
    opacity: 0,
    x: 30,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: springs.smooth,
  },
  exit: {
    opacity: 0,
    x: 30,
    transition: { duration: 0.2 },
  },
};

export const slideInUp: Variants = {
  initial: {
    opacity: 0,
    y: 30,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: springs.smooth,
  },
};

/* ===== Agent Node Animations ===== */
export const pulseGlow: Variants = {
  idle: {
    scale: 1,
    boxShadow: '0 0 8px rgba(99, 102, 241, 0.3)',
  },
  active: {
    scale: [1, 1.05, 1],
    boxShadow: [
      '0 0 8px rgba(99, 102, 241, 0.3)',
      '0 0 24px rgba(99, 102, 241, 0.6)',
      '0 0 8px rgba(99, 102, 241, 0.3)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/* ===== Data Flow Particle ===== */
export const flowParticle: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: {
    pathLength: 1,
    opacity: [0, 1, 1, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

/* ===== Hover / Tap Micro-interactions ===== */
export const hoverScale = {
  whileHover: { scale: 1.03, transition: springs.snappy },
  whileTap: { scale: 0.98, transition: springs.snappy },
};

export const hoverLift = {
  whileHover: { y: -4, transition: springs.snappy },
  whileTap: { y: 0, transition: springs.snappy },
};

export const hoverGlow = {
  whileHover: {
    boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
    transition: springs.snappy,
  },
};

/* ===== Fade Variants ===== */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/* ===== Scroll-triggered Variants ===== */
export const scrollReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...springs.smooth,
      staggerChildren: 0.1,
    },
  },
};

export const scrollRevealItem: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.smooth,
  },
};
