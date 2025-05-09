import { useState, useEffect, useRef } from "react";

export function useCountAnimation(end: number, duration: number = 2) {
  const [count, setCount] = useState(0);
  const nodeRef = useRef(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const progress = Math.min(
        (now - startTime.current) / (duration * 1000),
        1
      );

      if (progress < 1) {
        nodeRef.current = Math.floor(end * progress);
        setCount(nodeRef.current);
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);
    return () => {
      nodeRef.current = 0;
      startTime.current = Date.now();
    };
  }, [end, duration]);

  return count;
}
