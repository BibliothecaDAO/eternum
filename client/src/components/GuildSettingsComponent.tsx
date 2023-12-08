import { useMemo, useState } from "react";
import { ReactComponent as CloseIcon } from "../assets/icons/common/cross-circle.svg";
import { ReactComponent as GuildSetting } from "../assets/icons/common/guild-setting.svg";
import { ReactComponent as Checked } from "../assets/icons/common/checked.svg";
import { ReactComponent as SuccessIcon } from "../assets/icons/common/success-toast.svg";
import { ReactComponent as FailedIcon } from "../assets/icons/common/close-toast.svg";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import Button from "../elements/Button";
import { useChat } from "../ChatContext";
import { ChannelType } from "../elements/Channel";
import clsx from "clsx";
import { ToastState, ToastStateType } from "../elements/ToastState";

type GuildType = "public" | "request";

export const GuildSettingsComponent = (props: { guild: ChannelType; handleSuccess: any }) => {
  const { guild } = props;
  const { client } = useChat();
  const [showModal, setShowModal] = useState(false);
  const [toastState, setToastState] = useState<ToastStateType>();
  const [isLoading, setIsLoading] = useState(false);
  const [guildType, setGuildType] = useState<GuildType>("public");

  const submit = async () => {
    setIsLoading(true);
    try {
      await client.channel.updateGroupPermissions({
        groupid: guild.groupid,
        permissions: {
          "group:join": {
            type: "enum",
            value: guildType === "public" ? "public" : "validate_by_creator",
          },
        },
      });
      setIsLoading(false);
      setToastState({
        icon: <SuccessIcon />,
        btnText: "Close",
        handler: () => {
          setShowModal(false)
          setToastState(undefined)
          setIsLoading(false)
        },
        content: "Update Guild success",
      });
    } catch (e) {
      console.log(e, "e");
      setIsLoading(false);
      setToastState({
        btnText: "Retry",
        content: e.message || "Failed to update guild permission",
        icon: <FailedIcon />,
        handler: () => {
          setToastState(undefined);
          setIsLoading(false);
        },
      });
    }
  };
  const Btns: {
    label: string;
    type: GuildType;
    isSelected: boolean;
  }[] = useMemo(() => {
    return [
      {
        label: "Public",
        type: "public",
        isSelected: guildType === "public",
      },
      {
        label: "Verification required",
        type: "request",
        isSelected: guildType === "request",
      },
    ];
  }, [guildType]);

  const isDisable = isLoading || !!toastState;

  return (
    <div className="flex items-center text-white">
      <div
        className="cursor-pointer"
        onClick={() => {
          setShowModal(true);
        }}
      >
        <GuildSetting />
      </div>

      {showModal && (
        <SecondaryPopup className="top-1/3 border !border-gold rounded-xl overflow-hidden" name="guild-settings">
          <SecondaryPopup.Head
            className={
              "w-full flex items-center h-10 px-4 px-3 justify-between min-w-full border-x-0 border-b !border-gold"
            }
          >
            <div className="mr-0.5 !text-gold">Guild Permission Management</div>
            <CloseIcon className="h-3 cursor-pointer fill-white" onClick={() => setShowModal(false)} />
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width="400px" className="!border-gold border-0 relative">
            {toastState && <ToastState {...toastState} />}
            <div className="w-full h-full">
              <div className="flex flex-col p-3 gap-3">
                {Btns.map((item, index) => (
                  <Button
                    variant="outline"
                    key={index}
                    className={clsx(
                      "text-xxs mr-auto w-full mt-2 justify-between h-10 p-3",
                      !item.isSelected ? "!text-gray-gold border-gray-gold" : "",
                    )}
                    onClick={() => setGuildType(item.type)}
                  >
                    {item.label}
                    {item.isSelected && <Checked />}
                  </Button>
                ))}
                <Button
                  disabled={isDisable}
                  onClick={submit}
                  variant="outline"
                  className="text-xxs mr-auto w-full mt-2  h-10 p-3"
                >
                  Confirm
                </Button>
              </div>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </div>
  );
};
