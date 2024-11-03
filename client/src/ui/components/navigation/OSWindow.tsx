import { IS_MOBILE } from "@/ui/config";
import { ExpandablePopup } from "@/ui/elements/ExpandablePopup";
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
  width = "400px",
  expandedWidth = "600px",
  hintSection,
  expandedContent,
  isExpanded = false,
}: ExpandableOSInterface) => {
  return (
    <>
      {show && (
        <ExpandablePopup
          title={title}
          onClose={() => onClick()}
          hintSection={hintSection}
          expandedContent={expandedContent}
          width={width}
          expandedWidth={expandedWidth}
          isExpanded={isExpanded}
        >
          {children}
        </ExpandablePopup>
      )}
    </>
  );
};
