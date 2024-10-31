import { ExpandablePopup } from "@/ui/elements/ExpandablePopup";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import { OSInterface } from "./Config";

interface ExpandableOSInterface extends OSInterface {
  expandedContent?: React.ReactNode;
  isExpandable?: boolean;
  expandedWidth?: string;
  isExpanded?: boolean;
  minHeight?: string;
}

export const OSWindow = ({
  onClick,
  show,
  title,
  children,
  width = "400px",
  expandedWidth = "600px",
  hintSection,
  expandedContent,
  isExpandable,
  isExpanded = false,
}: ExpandableOSInterface) => {
  if (isExpandable && expandedContent) {
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
  }

  return (
    <>
      {show && (
        <SecondaryPopup name={title}>
          <SecondaryPopup.Head onClose={() => onClick()} hintSection={hintSection}>
            {title}
          </SecondaryPopup.Head>
          <SecondaryPopup.Body height={"h-72"} width={width}>
            {children}
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </>
  );
};
