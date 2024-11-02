import { IS_MOBILE } from "@/ui/config";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import { OSInterface } from "./Config";

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
