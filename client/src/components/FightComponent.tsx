import { useState } from "react";
import { ReactComponent as FightLost } from "../assets/icons/common/fight-lost.svg";
import { ReactComponent as FightWaiting } from "../assets/icons/common/fight-waiting.svg";
import { ReactComponent as FightWin } from "../assets/icons/common/fight-win.svg";
import { ReactComponent as FightReject } from "../assets/icons/common/fight-reject.svg";
import { ReactComponent as CloseIcon } from "../assets/icons/common/cross-circle.svg";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import { Headline } from "../elements/Headline";
import Button from "../elements/Button";
import useScreenOrientation from "../hooks/useScreenOrientation";
import { useDojo } from "../DojoContext";
import { NumberInput } from "../elements/NumberInput";

type SettingsComponentProps = {};

enum StepEnum {
  GetResources,
  Waiting,
  Lost,
  Win,
  Reject
}

export const FightComponent = ({}: SettingsComponentProps) => {
  const {
    account: { accountDisplay },
  } = useDojo();
  const [showFight, setShowFight] = useState(false);
  const [step, setStep] = useState<StepEnum>();
  const [selfAmount, setSelfAmount] = useState(0);
  const [targetAmount, setTargetAmount] = useState(0);

  const { toggleFullScreen, isFullScreen } = useScreenOrientation();
  const [fullScreen, setFullScreen] = useState<boolean>(isFullScreen());

  const clickFullScreen = () => {
    setFullScreen(!fullScreen);
    toggleFullScreen();
  };

  return (
    <div className="flex items-center text-white">
      <div className=" text-gold flex ml-auto ">
        <Button onClick={() => {
          setShowFight(true)
          setStep(StepEnum.GetResources)
        }} variant="outline" className="p-1 !h-4 text-xxs !rounded-md">
          Fight
        </Button>
      </div>
      {showFight && (
        <SecondaryPopup className="top-1/3" name="settings">
          <SecondaryPopup.Head>
            <div className="flex items-center">
              <div className="mr-0.5">Fight</div>
              <CloseIcon className="w-3 h-3 cursor-pointer fill-white" onClick={() => setShowFight(false)} />
            </div>
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width="400px">
            {step === StepEnum.GetResources && (
              <div className="flex flex-col  space-y-2 p-3">
                <Headline size="big">Resources</Headline>
                <div>change wallet</div>
                <Headline size="big">Your Resources</Headline>
                <div className="flex items-center">
                  <div className="italic text-light-pink">Fish Amount:</div>
                  <NumberInput className="ml-2 mr-2" value={selfAmount} step={1} onChange={setSelfAmount} max={9999} />
                </div>
                <Headline size="big">Target Resources</Headline>
                <div className="flex items-center">
                  <div className="italic text-light-pink">Fish Amount:</div>
                  <NumberInput
                    className="ml-2 mr-2"
                    value={targetAmount}
                    step={1}
                    onChange={setTargetAmount}
                    max={9999}
                  />
                </div>
                <Button
                  onClick={() => {
                    setStep(StepEnum.Waiting)
                    setTimeout(() => {
                      setStep(StepEnum.Win)
                    }, 2000)
                  }}
                  variant="outline"
                  className="text-xxs !py-1 !px-2 mr-auto w-full"
                >
                  Send Fight
                </Button>
              </div>
            )}
            {step === StepEnum.Waiting && (
              <div className="flex flex-col  space-y-2 p-3">
                <Headline size="big">Resources</Headline>
                <FightWaiting className='m-auto' />
                <div className="text-gold w-full">Waiting for the other person to accept...</div>
              </div>
            )}
            {step === StepEnum.Win && (
              <div className="flex flex-col  space-y-2 p-3">
                <Headline size="big">Resources</Headline>
                <FightWin />
                <div>You have won the war.</div>
                <Button
                    onClick={() => setShowFight(false)}
                    variant="outline"
                    className="text-xxs !py-1 !px-2 mr-auto w-full"
                >
                  Confirm
                </Button>
              </div>
            )}
            {step === StepEnum.Lost && (
              <div className="flex flex-col  space-y-2 p-3">
                <Headline size="big">Resources</Headline>
                <FightLost />
                <div>You lost the war.</div>
                <Button
                    onClick={() => setShowFight(false)}
                    variant="outline"
                    className="text-xxs !py-1 !px-2 mr-auto w-full"
                >
                  Confirm
                </Button>
              </div>
            )}
            {step === StepEnum.Reject && (
              <div className="flex flex-col  space-y-2 p-3">
                <Headline size="big">Resources</Headline>
                <FightReject />
                <div>User rejected</div>
                <Button
                    onClick={() => setShowFight(false)}
                    variant="outline"
                    className="text-xxs !py-1 !px-2 mr-auto w-full"
                >
                  Confirm
                </Button>
              </div>
            )}
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </div>
  );
};
