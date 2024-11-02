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

// <<<<<<< HEAD
// import { ExpandablePopup } from "@/ui/elements/ExpandablePopup";
// import { SecondaryPopup } from "../../elements/SecondaryPopup";
// import { OSInterface } from "./Config";

// interface ExpandableOSInterface extends OSInterface {
//   expandedContent?: React.ReactNode;
//   isExpandable?: boolean;
//   expandedWidth?: string;
//   isExpanded?: boolean;
//   minHeight?: string;
// }

// =======
// // import { IS_MOBILE } from "@/ui/config";
// // import { SecondaryPopup } from "../../elements/SecondaryPopup";
// // import { OSInterface } from "./Config";

// >>>>>>> rc-1
// export const OSWindow = ({
//   onClick,
//   show,
//   title,
//   children,
// <<<<<<< HEAD
//   width = "400px",
//   expandedWidth = "600px",
//   hintSection,
//   expandedContent,
//   isExpandable,
//   isExpanded = false,
// }: ExpandableOSInterface) => {
//   if (isExpandable && expandedContent) {
//     return (
//       <>
//         {show && (
//           <ExpandablePopup
//             title={title}
//             onClose={() => onClick()}
//             hintSection={hintSection}
//             expandedContent={expandedContent}
//             width={width}
//             expandedWidth={expandedWidth}
//             isExpanded={isExpanded}
//           >
//             {children}
//           </ExpandablePopup>
//         )}
//       </>
//     );
//   }

// =======
//   height = "h-72",
//   width = "400px",
//   hintSection,
// }: OSInterface) => {
// >>>>>>> rc-1
//   return (
//     <>
//       {show && (
//         <SecondaryPopup className={IS_MOBILE ? "h-screen w-screen" : ""} name={title}>
//           <SecondaryPopup.Head onClose={() => onClick()} hintSection={hintSection}>
//             {title}
//           </SecondaryPopup.Head>
//           <SecondaryPopup.Body height={IS_MOBILE ? "h-screen" : height} width={IS_MOBILE ? "100%" : width}>
//             {children}
//           </SecondaryPopup.Body>
//         </SecondaryPopup>
//       )}
//     </>
//   );
// };
