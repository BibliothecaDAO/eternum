import { Button } from "@/shared/ui/button";
import { useMemo, useRef, useState } from "react";

interface TermsOfServiceProps {
  onAccept: () => void;
}

export const TermsOfService = ({ onAccept }: TermsOfServiceProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNextStep = () => {
    setCurrentStep(2);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  const handleAcceptTerms = () => {
    onAccept();
  };

  const step1Content = useMemo(
    () => (
      <div className="space-y-6">
        <div className="text-xl font-bold">NOTICE</div>

        <section>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              After the game begins, you will see that you can bridge some regular ERC20 tokens (e.g.{" "}
              <span className="font-bold">$LORDS</span>) in and out of the game.
            </li>
            <li>
              <span className="font-bold">This bridge will close 7 days after the game ends.</span>
            </li>
            <li>
              <span className="underline font-bold">You are advised</span> to bridge out any resources you don't want to
              lose after the game ends.
            </li>
            <li>
              <span className="font-bold">
                Any resources left in the game after the 7 day grace period are permanently locked in the contract (aka
                burned),
              </span>{" "}
              <span className="font-bold">with $LORDS being the exception.</span>
            </li>
            <li>All $LORDS left are transferred to the VELORDS staking smart contract.</li>
          </ul>
        </section>

        <section>
          <p>Please plan around this as the developers will not be able to help you after the game ends.</p>
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
        <div className="text-xl font-bold">Important Disclaimer! Please read carefully.</div>

        <section>
          <p>
            By participating in <strong>Eternum</strong>, you fully acknowledge and agree to the following terms and
            conditions:
          </p>
        </section>

        <section className="mb-4">
          <p>
            A season of Eternum concludes when a single player achieves the required number of Victory Points and clicks
            the "End Season" button.
            <br />
            <br />
            <span className="font-bold"> Within 7 days after the "End Season" button is clicked:</span>
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li className="text-base font-bold">
              Players are strongly encouraged to bridge out their $LORDS tokens and other in-game resources. ALL $LORDS
              tokens and in-game resources are permanently locked within the game after the 7 day grace period elapses.
            </li>
            <li className="text-base font-bold">
              Players will be allowed to register their victory points in order to be eligible to receive a portion of
              the rewards pool. If you do not register your victory points within the 7 day grace period, you may not be
              eligible to receive a portion of the rewards pool.
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
              for instructions on how to bridge tokens out during the gameplay
              <br />
              <br />
              <span className="font-bold">Plan accordingly.</span>
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
