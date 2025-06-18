import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { useMemo, useRef, useState } from "react";

export const TermsOfService = () => {
  const setHasAcceptedToS = useUIStore((state) => state.setHasAcceptedToS);
  const setShowToS = useUIStore((state) => state.setShowToS);
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

  // Memoize the content to prevent unnecessary re-renders
  const step1Content = useMemo(
    () => (
      <div className="space-y-8">
        <div className="text-2xl font-bold text-center my-6 tracking-wider animate-pulse bg-gradient-to-r from-gold via-yellow-300 to-gold bg-clip-text text-transparent">
          NOTICE
        </div>

        <section className="bg-gold/10 border-l-4 border-gold p-6 rounded-lg shadow-lg backdrop-blur-sm">
          <ul className="list-disc pl-6 space-y-3 text-base leading-relaxed text-gray-100">
            <li className="hover:text-gold transition-colors duration-200">
              After the game begins, you will see that you can bridge some regular ERC20 tokens (e.g.{" "}
              <span className="font-bold text-gold">$LORDS</span>) in and out of the game.
            </li>
            <li className="hover:text-gold transition-colors duration-200">
              <span className="font-bold text-red-400">This bridge will close 7 days after the game ends.</span>
            </li>
            <li className="hover:text-gold transition-colors duration-200">
              <span className="underline font-bold">You are advised</span> to bridge out any resources you don't want to
              lose after the game ends.
            </li>
            <li className="hover:text-gold transition-colors duration-200">
              <span className="font-bold text-red-400">
                Any resources left in the game after the 7 day grace period are permanently locked in the contract (aka
                burned),
              </span>{" "}
              <span className="font-bold text-gold">with $LORDS being the exception.</span>
            </li>
            <li className="hover:text-gold transition-colors duration-200">
              All $LORDS left are transferred to the VELORDS staking smart contract.
            </li>
          </ul>
        </section>

        <section className="bg-gold/10 border-l-4 border-gold p-6 rounded-lg shadow-lg backdrop-blur-sm">
          <p className="text-lg font-medium text-gray-100 leading-relaxed">
            Please plan around this as the developers will not be able to help you after the game ends.
          </p>
        </section>

        <div className="w-full flex justify-center mt-8">
          <Button className="!bg-gold border-none shadow-lg px-8 py-3" onClick={handleNextStep}>
            <div className="text-black font-bold text-lg tracking-wide">Next</div>
          </Button>
        </div>
      </div>
    ),
    [],
  );

  const step2Content = useMemo(
    () => (
      <div className="space-y-8">
        <div className="text-2xl font-bold text-center my-6 tracking-wider animate-pulse bg-gradient-to-r from-gold via-yellow-300 to-gold bg-clip-text text-transparent">
          Important Disclaimer! Please read carefully.
        </div>

        <section className="bg-gold/10 border-l-4 border-gold p-4 rounded-lg shadow">
          <p className="text-lg">
            By participating in <strong>Eternum</strong>, you fully acknowledge and agree to the following terms and
            conditions:
          </p>
        </section>

        <section className="bg-gold/10 border-l-4 border-gold p-4 rounded-lg shadow">
          <p className="text-lg">
            A season of Eternum concludes when a single player achieves the required number of Victory Points and clicks
            the "End Season" button.
            <br />
            <br />
            <span className="font-bold text-red-500"> Within 7 days after the "End Season" button is clicked:</span>
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li className="text-lg font-extrabold text-red-400">
              Players are strongly encouraged to bridge out their $LORDS tokens and other in-game resources. ALL $LORDS
              tokens and in-game resources are permanently locked within the game after the 7 day grace period elapses.
            </li>
            <li className="text-lg font-extrabold text-red-400">
              Players will be allowed to register their victory points in order to be eligible to receive a portion of
              the rewards pool. If you do not register your victory points within the 7 day grace period, you may not be
              eligible to receive a portion of the rewards pool.
            </li>
            <li className="text-lg">
              Players are encouraged to review the{" "}
              <a
                href="https://docs.eternum.realms.world/"
                className="underline hover:text-gold-light cursor-fancy text-gold"
                target="_blank"
                rel="noopener noreferrer"
              >
                documentation
              </a>{" "}
              for instructions on how to bridge tokens out during the gameplay
              <br />
              <br />
              <span className="font-bold text-red-500">Plan accordingly.</span>
            </li>
          </ul>
        </section>

        <section className="bg-gold/10 border-l-4 border-gold p-4 rounded-lg shadow">
          <h2 className="font-bold text-lg mb-2 text-gold">Immutable Contracts</h2>
          <p className="text-lg">
            Eternum is governed entirely by immutable smart contracts. Once deployed, the game's rules and mechanics
            cannot be altered, updated, or reversed by the developers, the DAO, or any other party.
          </p>
        </section>

        <section className="bg-gold/10 border-l-4 border-gold p-4 rounded-lg shadow">
          <h2 className="font-bold text-lg mb-2 text-gold">Risk of Loss</h2>
          <p className="text-lg">
            All transactions and gameplay actions in Eternum are final. There are no mechanisms for refunds, reversals,
            or compensation. You acknowledge the risk of loss of funds and accept that you bear sole responsibility for
            any financial impact incurred.
          </p>
        </section>
        <section className="bg-gold/10 border-l-4 border-gold p-4 rounded-lg shadow">
          <h2 className="font-bold text-lg mb-2 text-gold">No Recourse</h2>
          <p className="text-lg">
            By participating in Eternum, you waive all rights to claims or recourse against the developers, the DAO, or
            any other associated entities for any losses or disputes arising from your participation in the game.
          </p>
        </section>
        <section className="bg-gold/10 border-l-4 border-gold p-4 rounded-lg shadow">
          <h2 className="font-bold text-lg mb-2 text-gold">Acknowledgment of Terms</h2>
          <p className="text-lg">
            Participation in Eternum constitutes your agreement to these terms, as well as all other terms and
            conditions outlined in the game's documentation.
          </p>
        </section>

        <div className="w-full flex justify-center mt-8">
          <Button className="!bg-gold border-none shadow-lg px-8 py-3" onClick={handleAcceptTerms}>
            <div className="text-black font-bold text-lg tracking-wide">Accept Terms & Conditions</div>
          </Button>
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
