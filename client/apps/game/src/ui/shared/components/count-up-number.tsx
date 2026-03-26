import { useEffect, useRef, useState } from "react";

const ANIMATION_DURATION_MS = 600;
const LARGE_CHANGE_THRESHOLD = 0.1; // 10% change considered "large"

interface CountUpNumberProps {
  value: number;
  format: (value: number) => string;
  className?: string;
  highlightClassName?: string;
}

/**
 * Animates number changes with a count-up effect.
 * When the value jumps significantly, it smoothly counts up from old to new
 * and briefly highlights the number to give tactile feedback.
 */
export const CountUpNumber = ({
  value,
  format,
  className = "",
  highlightClassName = "text-green",
}: CountUpNumberProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const fromRef = useRef(value);
  const toRef = useRef(value);

  useEffect(() => {
    const prevValue = prevValueRef.current;
    prevValueRef.current = value;

    // Skip animation on first render or when value hasn't changed
    if (prevValue === value) return;

    const delta = value - prevValue;
    const absDelta = Math.abs(delta);
    const isLargeChange = prevValue === 0 ? absDelta > 0 : absDelta / Math.abs(prevValue) > LARGE_CHANGE_THRESHOLD;

    // For small incremental changes (production ticks), just snap
    if (!isLargeChange) {
      setDisplayValue(value);
      return;
    }

    // Cancel any running animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // Animate from current display to new value
    fromRef.current = displayValue;
    toRef.current = value;
    startTimeRef.current = performance.now();
    setIsAnimating(true);

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);

      // Ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const current = fromRef.current + (toRef.current - fromRef.current) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
        setDisplayValue(toRef.current);
        // Keep highlight briefly after animation completes
        setTimeout(() => setIsAnimating(false), 300);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);

  return (
    <span
      className={`${className} ${isAnimating ? highlightClassName : ""} transition-colors duration-300`}
    >
      {format(displayValue)}
    </span>
  );
};
