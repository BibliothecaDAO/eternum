import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { SecondaryPopup } from "../elements/SecondaryPopup";

interface ExpandablePopupProps {
  title: string;
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  isExpanded: boolean;
  onClose: () => void;
  hintSection?: string;
  width?: string;
  expandedWidth?: string;
}

export const ExpandablePopup: React.FC<ExpandablePopupProps> = ({
  title,
  children,
  expandedContent,
  isExpanded,
  hintSection,
  onClose,
  width,
  expandedWidth,
}) => {
  const expandedWidthInt = parseInt(expandedWidth ?? "0");
  const initialWidthInt = parseInt(width ?? "0");

  const slideLeft = {
    hidden: { x: "-100%" },
    visible: { x: "0%", transition: { duration: 0.3 } },
  };

  return (
    <SecondaryPopup name={title} width={isExpanded ? expandedWidth : width}>
      <SecondaryPopup.Head onClose={onClose} hintSection={hintSection}>
        {title}
      </SecondaryPopup.Head>
      <SecondaryPopup.Body height={"min-h-72"} width={isExpanded ? expandedWidth : width}>
        <div className="flex ">
          <div className={`w-[${width}] transition-all duration-300`}>{children}</div>
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.div
                variants={slideLeft}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: expandedWidthInt - initialWidthInt, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden border-l border-gray-gold pl-4"
              >
                {expandedContent}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
