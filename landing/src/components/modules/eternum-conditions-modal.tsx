import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HYPERSTRUCTURE_POINTS_FOR_WIN } from '@bibliothecadao/eternum'
import { TypeP } from '../typography/type-p'

interface EternumConditionsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EternumConditionsModal({ open, onOpenChange }: EternumConditionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl text-gold max=h-[70vH]">
        <DialogHeader>
          <DialogTitle>Eternum Terms & Conditions</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h2 className="font-bold text-lg mb-2">Disclaimer and Risk Acknowledgment</h2>
            <TypeP>
              Important Disclaimer – Please Read Carefully <br />
              By participating in Eternum, you fully acknowledge and accept the following terms and conditions.
            </TypeP>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">Immutable Contracts</h2>
            <p>
              Eternum is governed entirely by <strong>immutable</strong> smart contracts. Once deployed, the game's rules and mechanics <strong>cannot be
              altered, updated, or reversed</strong> by the developers, the DAO, or any other party.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">Risk of Loss</h2>
            <p>
              All transactions and gameplay actions in Eternum are <strong>final</strong> and ALL $LORDS tokens and in-game resources are
              <strong>permanently</strong> locked within the game. There are no mechanisms for refunds, reversals, or compensation. You acknowledge
              the <strong>risk of loss of funds</strong> and accept that you bear sole responsibility for any financial impact incurred.
            </p>
            <p className="mt-4">
              A season of Eternum concludes when a single player achieves the required
              <strong>{HYPERSTRUCTURE_POINTS_FOR_WIN.toLocaleString()}</strong> Victory Points and clicks the "End Season" button. At this
              point:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li>ALL $LORDS tokens and in-game resources are <strong>permanently</strong> locked within the game.</li>
            </ul>
            <p className="mt-4">
              Players are encouraged to review the documentation for instructions on how to bridge tokens out during the active
              gameplay phase.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">No Recourse</h2>
            <p>
              By participating in Eternum, you waive all rights to claims or recourse against the developers, the DAO, or any other
              associated entities for any losses or disputes arising from your participation in the game.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">Acknowledgment of Terms</h2>
            <p>
              Participation in Eternum constitutes your agreement to these terms, as well as all other terms and conditions outlined
              in the game's documentation.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
