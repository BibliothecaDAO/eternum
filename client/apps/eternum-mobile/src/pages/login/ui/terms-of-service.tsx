import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { useMemo, useRef, useState } from "react";

export const TermsOfService = () => {
  const setHasAcceptedToS = useStore((state) => state.setHasAcceptedToS);
  const setShowToS = useStore((state) => state.setShowToS);
  const [currentStep, setCurrentStep] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNextStep = () => {
    setCurrentStep(2);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  const handleAcceptTerms = () => {
    setHasAcceptedToS(true);
    setShowToS(false);
  };

  const step1Content = useMemo(
    () => (
      <div className="space-y-6">
        <div className="text-xl font-bold">
          Did you know that Eternum is a fully onchain game with immutable contracts?
        </div>

        <section>
          <div className="text-lg font-bold mb-2">Important information:</div>
          <p>Bridges out of the game permanently close 48 hours after victory.</p>
        </section>

        <section>
          <p>
            You bridge tokens in and out of the game. The game bridge is closed forever 48 hours after the game ends.
            Any tokens left in the game at that time are permanently locked in the contract (aka burned).
          </p>
        </section>

        <section>
          <p>
            Bridging out of the game is done by sending resources to a bank.{" "}
            <strong>That takes time and requires donkeys.</strong> It's part of the game - with immutable contracts code
            is law. Plan around it, it is your responsibility to bridge out and the developers cannot do anything to
            change the code after deployment.
          </p>
        </section>

        <div className="w-full flex justify-center">
          <Button onClick={handleNextStep}>Next</Button>
        </div>
      </div>
    ),
    [],
  );

  const step2Content = useMemo(
    () => (
      <div className="space-y-6">
        <div className="text-xl font-bold">Important disclaimer. Please Read Carefully.</div>

        <section>
          <p>
            By participating in <strong>Eternum</strong>, you fully acknowledge and agree to the following terms and
            conditions:
          </p>
        </section>

        <section className="mb-4 text-lg font-bold">
          <p>All Tokens Are Locked In Game Contract 48 hours after the game is won (Season End)</p>
        </section>

        <section className="mb-4">
          <p>
            A season of Eternum concludes when a single player achieves the required number of Victory Points and clicks
            the "End Season" button. 48 hours after this point:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li className="text-base font-bold">
              ALL $LORDS tokens and in-game resources are permanently locked within the game.
            </li>
            <li>
              Players are encouraged to review the{" "}
              <a
                href="https://eternum-docs.realms.world/"
                className="underline hover:text-gold cursor-pointer"
                target="_blank"
                rel="noopener noreferrer"
              >
                documentation
              </a>{" "}
              for instructions on how to bridge tokens out during the active gameplay phase. Be aware that bridging out
              is from a bank. That means donkeys are needed, travel time is required - and all other kinds of unforeseen
              events can delay your exit. Plan accordingly as there is no Plan B.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Immutable Contracts</h2>
          <p>
            Eternum is governed entirely by immutable smart contracts. Once deployed, the game's rules and mechanics
            cannot be altered, updated, or reversed by the developers, the DAO, or any other party.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Risk of Loss</h2>
          <p>
            All transactions and gameplay actions in Eternum are final. There are no mechanisms for refunds, reversals,
            or compensation. You acknowledge the risk of loss of funds and accept that you bear sole responsibility for
            any financial impact incurred.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">No Recourse</h2>
          <p>
            By participating in Eternum, you waive all rights to claims or recourse against the developers, the DAO, or
            any other associated entities for any losses or disputes arising from your participation in the game.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Acknowledgment of Terms</h2>
          <p>
            Participation in Eternum constitutes your agreement to these terms, as well as all other terms and
            conditions outlined in the game's documentation.
          </p>
        </section>

        <div className="w-full flex justify-center">
          <Button onClick={handleAcceptTerms}>Accept Terms & Conditions</Button>
        </div>
      </div>
    ),
    [],
  );

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent"
    >
      <div className="w-full px-4 py-6">{currentStep === 1 ? step1Content : step2Content}</div>
    </div>
  );
};
