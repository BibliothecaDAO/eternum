import React, { useEffect, useState } from "react";
import { ReactComponent as Crown } from "../assets/icons/common/crown-circle-outline.svg";
import { ReactComponent as Settings } from "../assets/icons/common/settings.svg";
type SettingsComponentProps = {};

export const SettingsComponent = ({}: SettingsComponentProps) => {
  const [state, setState] = useState();

  useEffect(() => {}, []);

  return (
    <div className="flex items-center text-white">
      <Crown className="mr-[6px] fill-current" />
      <div className="text-xs font-bold">
        DeadlyCrow<span className="text-gold">.stark</span>
      </div>
      <Settings className="ml-[6px] fill-gold translate-y-1" />
    </div>
  );
};
