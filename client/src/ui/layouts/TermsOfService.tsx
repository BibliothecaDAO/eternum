import { configManager } from "@/dojo/setup";
import { currencyIntlFormat, formatTime } from "../utils/utils";

export const TermsOfService = () => {
  return (
    <div className="h-full overflow-y-auto">
      <div>
        <div className="text-2xl font-bold mb-4">Important Disclaimer - Please Read Carefully</div>
        <p className="mb-4">By playing Eternum, you acknowledge and accept that:</p>

        <section className="mb-4">
          <div className="text-xl font-bold mb-2">Immutable Contracts</div>
          <p>
            The game operates entirely on immutable smart contracts. Once deployed, these contracts cannot be altered or
            modified by the developers or any other party.
          </p>
        </section>

        <section className="mb-4">
          <div className="text-xl font-bold mb-2">Risk of Loss</div>
          <p>
            All transactions and gameplay actions are final. There is no mechanism for refunds, reversals, or
            compensation.
          </p>
        </section>

        <section className="mb-4">
          <div className="text-xl font-bold mb-2">Acceptance of Risk</div>
          <p>
            You are solely responsible for any loss of funds incurred while playing Eternum. By proceeding, you waive
            any claims of recourse against the developers, the DAO, or associated parties.
          </p>
        </section>

        <div className="mt-4 italic">
          <p>By playing Eternum, you acknowledge and accept these terms.</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-2xl font-bold mb-4">Funds Locked at Season End - Please Read</div>

        <section className="mb-4">
          <p>
            A season of Eternum concludes when a single player scores the required{" "}
            {currencyIntlFormat(configManager.getHyperstructureConfig().pointsForWin, 0)} Victory Points and clicks the
            "End Season" button.
          </p>

          <div className="text-xl font-bold my-2">Season Conclusion Consequences</div>
          <p>
            At the moment the "End Season" button is clicked, ALL $LORDS tokens and in-game resources are permanently
            locked in the game.
          </p>
        </section>

        <section className="mb-4">
          <p>
            Please review the{" "}
            <a
              className="underline"
              href="https://eternum-docs.realms.world/"
              target="_blank"
              rel="noopener noreferrer"
            >
              game documentation
            </a>{" "}
            for full details, including instructions on bridging tokens out during the gameplay phase.
          </p>
        </section>

        <div>
          <div className="text-xl font-bold mb-2">Acceptance of Risk</div>
          <p className="mb-4">
            By participating in Eternum, you agree to the risk of loss of funds with no recourse and accept all terms
            detailed in the documentation.
          </p>

          <p className="italic">
            By settling a Realm and playing, you confirm your understanding and acceptance of these terms.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-2xl font-bold mb-4">Disclaimer and Risk Acknowledgment</div>
        <p className="mb-4">
          By participating in Eternum, you fully acknowledge and agree to the following terms and conditions:
        </p>

        <section className="mb-4">
          <div className="text-xl font-bold mb-2">Immutable Contracts</div>
          <p>
            Eternum is governed entirely by immutable smart contracts. Once deployed, the game's rules and mechanics
            cannot be altered, updated, or reversed by the developers, the DAO, or any other party.
          </p>
        </section>

        <section className="mb-4">
          <div className="text-xl font-bold mb-2">Risk of Loss</div>
          <p>
            All transactions and gameplay actions in Eternum are final. There are no mechanisms for refunds, reversals,
            or compensation. You acknowledge the risk of loss of funds and accept that you bear sole responsibility for
            any financial impact incurred.
          </p>
        </section>

        <section className="mb-4">
          <div className="text-xl font-bold mb-2">Funds Locked at Season End</div>
          <p>
            A season of Eternum concludes when a single player achieves the required{" "}
            {currencyIntlFormat(configManager.getHyperstructureConfig().pointsForWin, 0)} Victory Points and clicks the
            "End Season" button. At this point:
          </p>
          <ul className="list-disc pl-5 mb-4">
            <li>
              ALL $LORDS tokens and in-game resources are permanently locked within the game after a period of{" "}
              {formatTime(Number(configManager.getSeasonBridgeConfig().closeAfterEndSeconds), undefined, false)}.
            </li>
            <li>
              Players are encouraged to review{" "}
              <a
                className="underline"
                href="https://eternum-docs.realms.world/"
                target="_blank"
                rel="noopener noreferrer"
              >
                the documentation
              </a>{" "}
              for instructions on how to bridge tokens out during the active gameplay phase.
            </li>
          </ul>
        </section>

        <section className="mb-4">
          <div className="text-xl font-bold mb-2">No Recourse</div>
          <p>
            By participating in Eternum, you waive all rights to claims or recourse against the developers, the DAO, or
            any other associated entities for any losses or disputes arising from your participation in the game.
          </p>
        </section>

        <section>
          <div className="text-xl font-bold mb-2">Acknowledgment of Terms</div>
          <p>
            Participation in Eternum constitutes your agreement to these terms, as well as all other terms and
            conditions outlined in the game's documentation.
          </p>
        </section>
      </div>
    </div>
  );
};
