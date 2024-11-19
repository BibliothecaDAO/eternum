import { IS_MOBILE } from "@/ui/config";
import { motion } from "framer-motion";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import { ExpandableOSInterface, OSInterface } from "./Config";

export const OSWindow = ({
  onClick,
  show,
  title,
  children,
  height = "h-72",
  width = "400px",
  hintSection,
}: OSInterface) => {
  return (
    <>
      {show && (
        <SecondaryPopup className={IS_MOBILE ? "h-screen w-screen" : ""} name={title}>
          <SecondaryPopup.Head onClose={() => onClick()} hintSection={hintSection}>
            {title}
          </SecondaryPopup.Head>
          <SecondaryPopup.Body height={IS_MOBILE ? "h-screen" : height} width={IS_MOBILE ? "100%" : width}>
            {children}
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </>
  );
};

export const ExpandableOSWindow = ({
  onClick,
  show,
  title,
  children,
  childrenExpanded,
  height = "h-72",
  width = "400px",
  widthExpanded = "400px",
  hintSection,
  isExpanded = false,
}: ExpandableOSInterface) => {
  return (
    <>
      {show && (
        <SecondaryPopup className={IS_MOBILE ? "h-screen w-screen" : ""} name={title}>
          <SecondaryPopup.Head onClose={() => onClick()} hintSection={hintSection}>
            {title}
          </SecondaryPopup.Head>
          <SecondaryPopup.Body
            height={IS_MOBILE ? "h-screen" : height}
            width={IS_MOBILE ? "100%" : isExpanded ? "" : width}
          >
            <div className="relative flex overflow-hidden">
              <div className="flex-shrink-0" style={{ width: IS_MOBILE ? "50%" : width }}>
                {children}
              </div>

              <motion.div
                className="border-l border-gray-gold"
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: isExpanded ? (IS_MOBILE ? "50%" : parseInt(widthExpanded)) : 0,
                  opacity: isExpanded ? 1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  opacity: { duration: 0.2 },
                }}
              >
                <div className="w-full h-full" style={{ width: IS_MOBILE ? "100%" : parseInt(widthExpanded) }}>
                  {childrenExpanded}
                </div>
              </motion.div>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </>
  );
};
