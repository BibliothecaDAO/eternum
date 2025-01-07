import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import style from "../../index.css?inline";

interface CustomIframeProps extends React.IframeHTMLAttributes<HTMLIFrameElement> {
  children: React.ReactNode;
}

const CustomIframe: React.FC<CustomIframeProps> = ({ children, ...props }) => {
  const [contentRef, setContentRef] = useState<HTMLIFrameElement | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (contentRef) {
      const iframeDocument = contentRef.contentDocument;
      const iframeWindow = contentRef.contentWindow;

      if (iframeDocument) {
        const styleTag = iframeDocument.createElement("style");
        styleTag.textContent = style;
        iframeDocument.head.appendChild(styleTag);
      }

      setMountNode(iframeDocument?.body || null);
    }
  }, [contentRef]);

  useEffect(() => {
    if (mountNode) {
      mountNode.style.overflow = "hidden";
      mountNode.style.backgroundColor = "transparent";
    }
  }, [mountNode]);

  return (
    <iframe {...props} ref={setContentRef} style={{ width: "100%", height: "100%", border: "none" }}>
      {mountNode && createPortal(children, mountNode)}
    </iframe>
  );
};

export default CustomIframe;
