import { HeadContent } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function RouterHead() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(<HeadContent />, document.head);
}
