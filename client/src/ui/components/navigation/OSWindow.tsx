import { SecondaryPopup } from "../../elements/SecondaryPopup";
import { OSInterface } from "./Config";

export const OSWindow = ({ onClick, show, title, children, width = "400px" }: OSInterface) => {
  return (
    <>
      {show && (
        <SecondaryPopup name={title}>
          <SecondaryPopup.Head onClose={() => onClick()}>{title}</SecondaryPopup.Head>
          <SecondaryPopup.Body height={"h-72"} width={width}>
            {children}
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </>
  );
};
