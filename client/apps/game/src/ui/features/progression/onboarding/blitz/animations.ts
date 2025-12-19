import type { Variants } from "framer-motion";

// Shared fade-in-up animation for sections
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// Button interaction variants
export const buttonVariants: Variants = {
  idle: {
    scale: 1,
    rotate: 0,
  },
  hover: {
    scale: 1.1,
    rotate: [0, -2, 2, -2, 2, 0],
    transition: {
      scale: { duration: 0.2 },
      rotate: { duration: 0.6, repeat: Infinity },
    },
  },
  tap: {
    scale: 0.9,
    rotate: 0,
    transition: { duration: 0.1 },
  },
};

// Number counter animation
export const numberVariants: Variants = {
  enter: {
    scale: 2,
    opacity: 0,
    rotate: 180,
  },
  center: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: {
      type: "spring",
      damping: 12,
      stiffness: 100,
      duration: 0.8,
    },
  },
  breathing: {
    scale: [1, 1.05, 1],
    y: [0, -2, 0],
    transition: {
      duration: 1.8,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Ripple effect for buttons
export const rippleVariants: Variants = {
  pulse: {
    scale: [1, 1.5, 1],
    opacity: [0.6, 0, 0.6],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeOut",
    },
  },
};

// Progress step animation
export const stepVariants: Variants = {
  inactive: {
    scale: 1,
    opacity: 0.5,
  },
  active: {
    scale: 1.1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20,
    },
  },
  complete: {
    scale: 1,
    opacity: 1,
  },
};

// Card hover animation
export const cardVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  hover: {
    y: -2,
    transition: { duration: 0.2 },
  },
};

// Stagger children animation
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Loader spin animation (for use with animate prop directly)
export const spinAnimation = {
  rotate: 360,
  transition: { duration: 1, repeat: Infinity, ease: "linear" },
};
