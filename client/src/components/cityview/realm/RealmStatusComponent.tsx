import React from "react";
import { ReactComponent as SkullIcon } from "../../../assets/icons/common/skull.svg";
import { ReactComponent as ShieldIcon } from "../../../assets/icons/common/shield.svg";
import { ReactComponent as HappyIcon } from "../../../assets/icons/common/happy.svg";

import clsx from "clsx";
import { BaseStatus } from "../../../elements/BaseStatus";

type RealmStatusComponentProps = {} & React.ComponentPropsWithRef<"div">;

export const RealmStatusComponent = ({
  className,
}: RealmStatusComponentProps) => {
  const realmStatus = {
    defence: "vulnerable" as keyof typeof defence,
    happiness: "happy" as keyof typeof hapiness,
  };

  const defence = {
    vulnerable: {
      title: "Vulnerable",
      icon: <ShieldIcon className="mr-2 fill-current" />,
    },
    weak: {
      title: "Weak",
      icon: <></>,
    },
    strong: {
      title: "Strong",
      icon: <></>,
    },
  };

  const hapiness = {
    starving: {
      title: "People are starving",
      icon: <SkullIcon className="mr-2 fill-current" />,
    },
    unhappy: {
      title: "People are unhappy",
      icon: <></>,
    },
    happy: {
      title: "People are happy",
      icon: <HappyIcon className="mr-2 fill-current" />,
    },
  };

  return (
    <div className={clsx("flex items-center space-x-4", className)}>
      <BaseStatus state={realmStatus.defence == "strong" ? "good" : "bad"}>
        {defence[realmStatus.defence].icon}
        {defence[realmStatus.defence].title}
      </BaseStatus>
      <BaseStatus state={realmStatus.happiness == "happy" ? "good" : "bad"}>
        {hapiness[realmStatus.happiness].icon}
        {hapiness[realmStatus.happiness].title}
      </BaseStatus>
    </div>
  );
};

export default RealmStatusComponent;
