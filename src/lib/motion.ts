import { Variants } from 'framer-motion';

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16,0.8,0.24,1] } }
};

export const staggerContainer = (stagger: number = 0.08, delay: number = 0): Variants => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: stagger,
      delayChildren: delay
    }
  }
});

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22,1,0.36,1] } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.25 } }
};

export const slideFade: Variants = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16,0.8,0.24,1] } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
};
