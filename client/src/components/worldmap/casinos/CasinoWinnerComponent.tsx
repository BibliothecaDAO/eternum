import useRealmStore from "../../../hooks/store/useRealmStore";
import { useState } from "react";

import { FeedCasinoPopup } from "./FeedCasino";
import useUIStore from "../../../hooks/store/useUIStore";
import Button from "../../../elements/Button";
import { useCasino } from "../../../hooks/helpers/useCasino";

type CasinoWinnerComponentProps = {};

export const CasinoWinnerComponent = ({ }: CasinoWinnerComponentProps) => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const setCasinoRounds = useUIStore((state) => state.setCasinoRounds);
  const { getCasinoRounds } = useCasino();

  let realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  let ownedRealms = realmEntityIds.map((x) => x.realmEntityId);

  console.log(realmEntityIds.map((x) => x.realmEntityId))

  const casinoRounds = getCasinoRounds();
  setCasinoRounds(casinoRounds);

  const count = casinoRounds.length;

  return (
    <>
      {count && showFeedPopup && <FeedCasinoPopup onClose={() => setShowFeedPopup(false)} count={count} />}
      {count && casinoRounds && (
        <div className="space-y-5 px-2 mb-4">
          <div className="text-xs text-gold"> </div>
          {/* center the next div */}
          <div className="flex justify-center">
            <div className="text-1xl text-gold">
              Lucky Winners
            </div>


          </div>
          <div className="flex justify-center p-0 rounded-md text-xxs text-gray-gold">
            <div className="items-center">
              <br></br>
              {casinoRounds.map((round, i) =>
              (
                <div>
                  <div className="text-gold text-xs flex ml-auto ">
                    <div className="flex ml-auto ">
                      Round: {round.roundIndex + 1} &nbsp;
                      Winner: {
                        i == casinoRounds.length - 1 ? "IN PROGRESS" : ownedRealms.includes(round.winnerId) ? "YOU WON!!!" : "YOU DIDN'T WIN"
                      }
                      &nbsp;
                      Participants: {round.participantCount}&nbsp;&nbsp;&nbsp;&nbsp;
                    </div>

                  </div>



                  {ownedRealms.includes(round.winnerId) && (
                    <div className="text-gold text-xs m-4 flex justify-center ">

                      <div className="">
                        <Button
                          className="p-3 !h-5 text-xxs !rounded-md"
                          variant="success"
                          onClick={() => {
                            // transport empty caravan to casino
                          }}
                        >
                          Travel to Claim

                        </Button>
                      </div>
                    </div>

                  )}
                  <br></br>
                  <br></br>
                </div>


              ),
              )}

            </div>

          </div>
        </div>
      )}
    </>
  );
};
