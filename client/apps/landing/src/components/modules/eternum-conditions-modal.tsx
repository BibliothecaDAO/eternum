import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { TypeH2 } from "../typography/type-h2";
import { TypeH3 } from "../typography/type-h3";
import { TypeP } from "../typography/type-p";
import { Button } from "../ui/button";

interface EternumConditionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EternumConditionsModal({ open, onOpenChange }: EternumConditionsModalProps) {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    setHasAcceptedTerms(!!localStorage.getItem("eternum-terms-accepted"));
  }, []);

  const handleNextStep = () => {
    setCurrentStep(2);
  };

  const handleAcceptTerms = () => {
    localStorage.setItem("eternum-terms-accepted", "true");
    setHasAcceptedTerms(true);
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !hasAcceptedTerms) {
      return;
    }
    onOpenChange(newOpen);
  };

  const renderStep1Content = () => (
    <>
      <section>
        <TypeH3>Did you know that Eternum is a fully onchain game with immutable contracts?</TypeH3> <br />
        <h2 className="font-bold text-xl">Important information:</h2>
        <TypeP>Bridges out of the game permanently close 7 days after victory.</TypeP>
      </section>

      <section>
        <TypeP>
          You bridge tokens in and out of the game. The game bridge is closed forever 7 days after the game ends. Any
          tokens left in the game at that time are permanently locked in the contract (aka burned).
        </TypeP>
      </section>

      <section>
        <TypeP>
          Bridging out of the game is done by sending resources to a bank.{" "}
          <strong>That takes time and requires donkeys.</strong> It's part of the game - with immutable contracts code
          is law. Plan around it, it is your responsibility to bridge out and the developers cannot do anything to
          change the code after deployment.
        </TypeP>
      </section>

      <DialogFooter>
        <Button className="mx-auto" onClick={handleNextStep}>
          Next
        </Button>
      </DialogFooter>
    </>
  );

  const renderStep2Content = () => (
    <>
      <section>
        <TypeH3>Important disclaimer. Please Read Carefully.</TypeH3> <br />
        <p>By participating in Eternum, you fully acknowledge and agree to the following terms and conditions:</p>{" "}
        <br />
        <h2 className="text-lg">
          <strong>All Tokens Are Locked In Game Contract 7 days after the game is won (Season End)</strong>
        </h2>
        <p className="mt-4">
          A season of Eternum concludes when a single player achieves the required number of Victory Points and clicks
          the "End Season" button. 7 days after this point:
        </p>
        <ul className="list-disc pl-6 mt-2">
          <li className="font-extrabold">
            ALL $LORDS tokens and in-game resources are permanently locked within the game.
          </li>
          <li>
            Players are encouraged to review the{" "}
            <a
              href="https://eternum-docs.realms.world/"
              className="underline hover:text-gold-light"
              target="_blank"
              rel="noopener noreferrer"
            >
              documentation
            </a>{" "}
            for instructions on how to bridge tokens out during the active gameplay phase. <br />
            Be aware that bridging out is from a bank. That means donkeys are needed, travel time is required - and all
            other kinds of unforeseen events can delay your exit. <br />
            Plan accordingly as there is no Plan B.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-lg mb-2">Immutable Contracts</h2>
        <p>
          Eternum is governed entirely by immutable smart contracts. Once deployed, the game’s rules and mechanics
          cannot be altered, updated, or reversed by the developers, the DAO, or any other party.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-lg mb-2">Risk of Loss</h2>
        <p>
          All transactions and gameplay actions in Eternum are final. There are no mechanisms for refunds, reversals, or
          compensation. You acknowledge the risk of loss of funds and accept that you bear sole responsibility for any
          financial impact incurred.
        </p>
      </section>
      <section>
        <h2 className="font-bold text-lg mb-2">No Recourse</h2>
        <p>
          By participating in Eternum, you waive all rights to claims or recourse against the developers, the DAO, or
          any other associated entities for any losses or disputes arising from your participation in the game.
        </p>
      </section>
      <section>
        <h2 className="font-bold text-lg mb-2">Acknowledgment of Terms</h2>
        <p>
          Participation in Eternum constitutes your agreement to these terms, as well as all other terms and conditions
          outlined in the game’s documentation.
        </p>
      </section>

      <DialogFooter>
        <Button className="mx-auto" onClick={handleAcceptTerms}>
          Accept Terms & Conditions
        </Button>
      </DialogFooter>
    </>
  );

  if (hasAcceptedTerms || hasAcceptedTerms === null) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl text-gold max-h-[70vH] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <TypeH2>Eternum Terms & Conditions {currentStep === 2 ? "(2 / 2)" : "( 1 / 2)"}</TypeH2>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">{currentStep === 1 ? renderStep1Content() : renderStep2Content()}</div>
      </DialogContent>
    </Dialog>
  );
}
