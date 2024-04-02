import { HyperstructuresPanel } from "../components/worldmap/hyperstructures/HyperstructuresPanel";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import useUIStore from "../hooks/store/useUIStore";

export type OSWindows = "Event Log" | "Banks" | "Leaderboard" | "Hyperstructures";

interface OSInterface {
  onClick: () => void;
  show: boolean;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const eventLog: OSWindows = "Event Log";
export const banks: OSWindows = "Banks";
export const leaderboard: OSWindows = "Leaderboard";
export const hyperstructures: OSWindows = "Hyperstructures";

export const EventLog = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(eventLog));

  return (
    <OSWindow onClick={() => togglePopup(eventLog)} show={isOpen} title={eventLog}>
      {/* COMPONENTS GO HERE */}
      hello
    </OSWindow>
  );
};

export const Banks = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(banks));

  return (
    <OSWindow onClick={() => togglePopup(banks)} show={isOpen} title={banks}>
      {/* COMPONENTS GO HERE */}
      hello
    </OSWindow>
  );
};

export const Leaderboard = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(leaderboard));

  return (
    <OSWindow onClick={() => togglePopup(leaderboard)} show={isOpen} title={leaderboard}>
      {/* COMPONENTS GO HERE */}
      hello
    </OSWindow>
  );
};

export const HyperStructures = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(hyperstructures));

  return (
    <OSWindow onClick={() => togglePopup(hyperstructures)} show={isOpen} title={hyperstructures}>
      {/* COMPONENTS GO HERE */}
      <HyperstructuresPanel minimumRealmLevel={5} />
    </OSWindow>
  );
};

export const OSWindow = ({ onClick, show, title, children, width = "400px" }: OSInterface) => {
  return (
    <>
      {show && (
        <SecondaryPopup name={title}>
          <SecondaryPopup.Head onClose={() => onClick()}>{title}</SecondaryPopup.Head>
          <SecondaryPopup.Body height={"600px"} width={width}>
            {children}
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </>
  );
};
