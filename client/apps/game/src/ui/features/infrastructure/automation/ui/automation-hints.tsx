import React from "react";

interface AutomationHintsProps {
  visible: boolean;
}

export const AutomationHints: React.FC<AutomationHintsProps> = ({ visible }) => {
  if (!visible) {
    return null;
  }

  return (
    <div>
      <div className="text-red/90 bg-red/10 rounded-md px-2 mb-2 text-xs bg-red-200/20 text-white">
        IMPORTANT: Your browser must stay open for automation. Automation runs every minute.
        <br />
        <ul className="list-disc pl-4 mb-4 text-sm text-gold/70">
          <li>
            <span className="font-bold">Produce Once:</span> Automation will produce resources until the target amount
            is reached, then stop.
          </li>
          <li>
            <span className="font-bold">Maintain Balance:</span> Automation will keep resource balance at the target
            level. Production triggers when balance drops below target minus buffer percentage.
          </li>
          <li>Resources produced will increase your realm&apos;s balance and may cause resource loss if storage is full.</li>
          <li>
            Process activates every <span className="font-bold">1 minute</span> automatically.
          </li>
        </ul>
      </div>
    </div>
  );
};

