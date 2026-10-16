import { useState, type ReactNode } from "react";
import { InfoBubble } from "../components/entities/collapsible-bubble";
import "./arena-hud.css";

export function HudPanel({
  title,
  children,
  className = "",
  cue,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  cue?: ReactNode;
}) {
  return (
    <section data-group={typeof title === "string" ? title : "Panel"} className={className}>
      <InfoBubble title={<span data-notice>{title}</span>} cue={cue} collapsible={false}>
        {children}
      </InfoBubble>
    </section>
  );
}

/** The game and its fixture route mount this same arrangement of production views. */
export function ArenaHudView({
  header,
  structures,
  realm,
  suggestion,
  events,
  tile,
  minimap,
  commands,
  chat,
  log,
}: {
  header: ReactNode;
  structures: ReactNode;
  realm: ReactNode;
  suggestion: ReactNode;
  events: ReactNode;
  tile: ReactNode;
  minimap: ReactNode;
  commands: ReactNode;
  chat: ReactNode;
  log: ReactNode;
}) {
  const [phoneTab, setPhoneTab] = useState("Map");
  return (
    <main
      className={`arena-hud hud-scene rails phone-${phoneTab.toLowerCase()}`}
      data-layout="rails"
      data-production-hud="ArenaHudView"
    >
      {header}
      <aside className="holdings-rail">
        {structures}
        {realm}
      </aside>
      <aside className="guidance-rail">
        {suggestion}
        {events}
        {tile}
      </aside>
      {minimap}
      {commands}
      {chat}
      {log}
      <nav className="phone-tabs" aria-label="Phone panels" data-group="Phone navigation">
        {["Map", "Holdings"].map((tab) => (
          <button data-notice key={tab} aria-pressed={phoneTab === tab} onClick={() => setPhoneTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>
    </main>
  );
}
