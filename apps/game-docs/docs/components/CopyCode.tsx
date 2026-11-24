import { useState } from "react";

export const CopyCode = ({ children, wrap = false }: { children: string; wrap?: boolean }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={wrap ? "docs-snippet docs-snippet-wrap" : "docs-snippet"}>
      <button type="button" className="docs-snippet-copy" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
};
