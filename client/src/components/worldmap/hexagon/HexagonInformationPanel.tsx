import { useState } from "react";

export const HexagonInformationPanel = () => {
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const panels = [
    { key: "combat", title: "Military", content: <div className="p-2">Military</div> },
    { key: "entities", title: "Commerce", content: <div className="p-2">Commerce</div> },
    { key: "build", title: "Build", content: <div className="p-2">Build</div> },
  ];

  const togglePanel = (key: string) => {
    setOpenPanel(openPanel === key ? null : key);
  };

  return (
    <>
      <div className="space-y-2">
        {panels.map((panel) => (
          <div key={panel.key} className="border-b border-gray-200">
            <button
              className="w-full text-left px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none"
              onClick={() => togglePanel(panel.key)}
            >
              {panel.title}
            </button>
            {openPanel === panel.key && <div className="p-2 text-xs">{panel.content}</div>}
          </div>
        ))}
      </div>
    </>
  );
};

export default HexagonInformationPanel;
