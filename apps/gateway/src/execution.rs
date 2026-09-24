use crate::{
    admission::Permit,
    metrics::METRICS,
    node::{Execution, ExecutionStatus, Node, Receipt},
    ticket::{ActionStatus, RecordedTicket},
    transaction::selector,
};
use anyhow::{ensure, Context};
use serde_json::Value;
use starknet_types_core::felt::Felt;
use std::{
    collections::VecDeque,
    ops::Range,
    sync::Arc,
    time::{Duration, Instant},
};

/// How long one submission may stay unresolved before the run reconciles it.
pub(crate) const SUBMISSION_TIMEOUT: Duration = Duration::from_secs(30);

pub(crate) struct PendingTicket {
    pub record: RecordedTicket,
    pub permit: Permit,
    pub received: Instant,
}

#[async_trait::async_trait]
pub(crate) trait ExecutionNode: Send + Sync {
    fn deployment(&self) -> Felt;
    async fn prepare(&self, to: Felt, entrypoint: &'static str, payload: Vec<Felt>) -> anyhow::Result<(Felt, Value)>;
    async fn execute(&self, hash: Felt, transaction: Value) -> anyhow::Result<Execution>;
    async fn receipt(&self, hash: Felt) -> anyhow::Result<Option<Receipt>>;
    async fn head_order(&self, game: Felt) -> anyhow::Result<u64>;
    async fn wait_for_state_change(&self);
}

#[async_trait::async_trait]
impl ExecutionNode for Node {
    fn deployment(&self) -> Felt {
        self.deployment
    }
    async fn prepare(&self, to: Felt, entrypoint: &'static str, payload: Vec<Felt>) -> anyhow::Result<(Felt, Value)> {
        Node::prepare(self, to, entrypoint, payload).await
    }
    async fn execute(&self, hash: Felt, transaction: Value) -> anyhow::Result<Execution> {
        Node::execute(self, hash, transaction).await
    }
    async fn receipt(&self, hash: Felt) -> anyhow::Result<Option<Receipt>> {
        Node::receipt(self, hash).await
    }
    async fn head_order(&self, game: Felt) -> anyhow::Result<u64> {
        let head = self.call(self.deployment, "get_head", vec![game]).await?;
        Ok((*head.first().context("malformed execution head")?).try_into()?)
    }
    async fn wait_for_state_change(&self) {
        self.wait_for_new_head().await;
    }
}

// Only deterministic executor limits authorize rejection before inclusion. A missing
// receipt or an account/order mismatch requires reconciliation, never rejection.
pub(crate) fn deterministic_limit(reason: &str) -> bool {
    ["Exceeded the maximum number of events,", "Exceeded the maximum data length,", "Exceeded the maximum keys length,"]
        .iter()
        .any(|message| reason.contains(message))
}

fn authentication_revert(reason: &str) -> bool {
    [
        "out of order",
        "only sequencing submitter",
        "invalid authority signature",
        "envelope release mismatch",
        "envelope preset mismatch",
        "future execution time",
        "backwards execution time",
        "malformed envelope",
        "invalid acceptance",
        "stale randomness epoch",
        "revealed epoch cannot execute",
    ]
    .iter()
    .any(|message| reason.contains(message))
}

const ATTEMPTS: usize = 3;

/// A failed batch is bisected in order. Only a single definitively failed ticket is
/// rejected; successful siblings execute normally, retaining their original contexts.
pub(crate) async fn execute(node: Arc<impl ExecutionNode>, tickets: Vec<PendingTicket>) -> anyhow::Result<()> {
    let mut batches = VecDeque::from_iter(std::iter::once(0..tickets.len()));
    while let Some(range) = batches.pop_front() {
        let selected = &tickets[range.clone()];
        if execute_range(node.as_ref(), selected, false).await? {
            continue;
        }
        if range.len() > 1 {
            split_front(&mut batches, range);
        } else {
            ensure!(execute_range(node.as_ref(), selected, true).await?, "terminal rejection failed to record");
        }
    }
    Ok(())
}

fn split_front(batches: &mut VecDeque<Range<usize>>, range: Range<usize>) {
    let mid = range.start + range.len() / 2;
    batches.push_front(mid..range.end);
    batches.push_front(range.start..mid);
}

async fn execute_range(node: &impl ExecutionNode, tickets: &[PendingTicket], rejection: bool) -> anyhow::Result<bool> {
    let payload = batch_calldata(tickets.iter().map(|ticket| &ticket.record), rejection)?;
    let entrypoint = if rejection { "reject_execution" } else { "execute_batch" };
    // A transient retry resubmits the exact transaction. Only a proven failed
    // batch creates new transactions when bisected or terminally rejected.
    let (hash, transaction) = node.prepare(node.deployment(), entrypoint, payload).await?;
    for attempt in 0..ATTEMPTS {
        for ticket in tickets {
            ticket.permit.resolve(ActionStatus::Submitted {
                action: ticket.record.envelope.action,
                order: ticket.record.envelope.order,
                transaction_hash: hash,
            });
        }
        let result = tokio::time::timeout(SUBMISSION_TIMEOUT, node.execute(hash, transaction.clone())).await;
        let observed = match result {
            Ok(Ok(outcome)) => Some(outcome),
            Ok(Err(error)) => {
                tracing::warn!(target: "gateway", %hash, attempt, error = format!("{error:#}"), "submission requires reconciliation");
                node.receipt(hash).await?.map(|receipt| Execution::Included(Box::new(receipt)))
            }
            Err(_) => {
                tracing::warn!(target: "gateway", %hash, attempt, "submission timed out; reconciling");
                node.receipt(hash).await?.map(|receipt| Execution::Included(Box::new(receipt)))
            }
        };
        match observed {
            Some(Execution::Included(receipt)) => {
                let reason = receipt.revert_reason.as_deref().unwrap_or("reverted");
                match receipt.execution_status {
                    ExecutionStatus::Succeeded => {
                        if !rejection {
                            METRICS.executed(tickets.len());
                        }
                        let outcomes = receipt_outcomes(tickets.iter().map(|ticket| &ticket.record), hash, &receipt)?;
                        for (ticket, outcome) in tickets.iter().zip(outcomes) {
                            ticket.permit.resolve(outcome);
                        }
                        return Ok(true);
                    }
                    ExecutionStatus::Reverted if !authentication_revert(reason) => {
                        failed(tickets, reason);
                        return Ok(false);
                    }
                    ExecutionStatus::Reverted => {}
                }
            }
            Some(Execution::Refused(reason)) if deterministic_limit(&reason) => {
                failed(tickets, &reason);
                return Ok(false);
            }
            // The node no longer knows a refused transaction, so it can never land: after the last
            // retry it counts as failed, and bisection isolates and rejects the ticket that caused it.
            Some(Execution::Refused(reason)) if attempt == ATTEMPTS - 1 => {
                failed(tickets, &reason);
                return Ok(false);
            }
            Some(Execution::Refused(reason)) => {
                tracing::warn!(target: "gateway", %hash, attempt, reason, "transaction dropped; resubmitting");
            }
            None => {}
        }
        // A batch is atomic, so its first ticket's game shows whether it was included.
        let first = &tickets[0].record;
        let head = node.head_order(first.intent.game).await?;
        ensure!(
            head < first.envelope.order,
            "head already covers pending ticket but its matching receipt is unavailable"
        );
        // Wait for node state to move after a transient refusal, not a receipt poll.
        node.wait_for_state_change().await;
    }
    anyhow::bail!("game submission paused after {ATTEMPTS} unresolved attempts; node state remains authoritative")
}

/// Each ticket of a definitively failed transaction logs the failure's reason; the ticket that
/// bisection isolates is then recorded on chain as `EXECUTION_FAILED`.
fn failed(tickets: &[PendingTicket], reason: &str) {
    for ticket in tickets {
        tracing::warn!(target: "gateway", action = %ticket.record.envelope.action, game = %ticket.record.intent.game,
            order = ticket.record.envelope.order, batch = tickets.len(), reason, "ticket_transaction_failed");
    }
}

fn batch_calldata<'a>(tickets: impl Iterator<Item = &'a RecordedTicket>, rejection: bool) -> anyhow::Result<Vec<Felt>> {
    let tickets: Vec<_> = tickets.collect();
    ensure!(!tickets.is_empty() && tickets.len() <= 64, "invalid execution batch size");
    ensure!(!rejection || tickets.len() == 1, "only a single ticket can be rejected");
    let mut fields = if rejection { vec![] } else { vec![Felt::from(tickets.len() as u64)] };
    for ticket in tickets {
        fields.extend(ticket.calldata()?);
    }
    Ok(fields)
}

pub(crate) fn receipt_outcomes<'a>(
    tickets: impl Iterator<Item = &'a RecordedTicket>,
    hash: Felt,
    receipt: &Receipt,
) -> anyhow::Result<Vec<ActionStatus>> {
    let prefix = [selector("RecordingEvent"), selector("ExecutionRecorded")];
    let tickets: Vec<_> = tickets.collect();
    let emitter = tickets.first().context("empty receipt attribution")?.intent.deployment;
    let events: Vec<_> =
        receipt.events.iter().filter(|event| event.from_address == emitter && event.keys == prefix).collect();
    ensure!(events.len() == tickets.len(), "execution receipt ticket count mismatch");
    tickets
        .into_iter()
        .zip(events)
        .map(|(ticket, event)| {
            let [game, actor, nonce, consumed, order, status, status_class, reason @ ..] = event.data.as_slice() else {
                anyhow::bail!("malformed execution event");
            };
            ensure!(
                *game == ticket.intent.game
                    && *actor == ticket.intent.actor
                    && *nonce == Felt::from(ticket.intent.nonce)
                    && *order == Felt::from(ticket.envelope.order),
                "execution event does not match submitted ticket"
            );
            ensure!(
                [Felt::ZERO, Felt::ONE].contains(consumed) && [Felt::ONE, Felt::TWO].contains(status),
                "invalid execution result"
            );
            let reason = decode_reason(reason)?;
            ensure!(
                if *status == Felt::ONE {
                    *status_class == Felt::ZERO && reason.is_empty()
                } else {
                    *status_class != Felt::ZERO && !reason.is_empty()
                },
                "execution classification disagrees with reason"
            );
            Ok(ActionStatus::Recorded {
                action: ticket.envelope.action,
                order: ticket.envelope.order,
                transaction_hash: hash,
                succeeded: *status == Felt::ONE,
                status_class: *status_class,
                reason,
                nonce_consumed: *consumed == Felt::ONE,
            })
        })
        .collect()
}

/// Replaces the one-felt reason read with the complete, strictly framed Cairo ByteArray.
fn decode_reason(fields: &[Felt]) -> anyhow::Result<String> {
    let (count, rest) = fields.split_first().context("missing execution reason")?;
    let count = usize::try_from(*count).map_err(|_| anyhow::anyhow!("invalid reason word count"))?;
    ensure!(rest.len().checked_sub(2) == Some(count), "malformed execution reason");
    let mut bytes = Vec::with_capacity(count * 31 + 30);
    for word in &rest[..count] {
        let word = word.to_bytes_be();
        ensure!(word[0] == 0, "invalid reason word");
        bytes.extend_from_slice(&word[1..]);
    }
    let pending = rest[count].to_bytes_be();
    let length = usize::try_from(rest[count + 1]).map_err(|_| anyhow::anyhow!("invalid reason tail length"))?;
    ensure!(length < 31, "invalid reason tail length");
    ensure!(pending[..32 - length].iter().all(|byte| *byte == 0), "invalid reason tail");
    bytes.extend_from_slice(&pending[32 - length..]);
    String::from_utf8(bytes).context("execution reason is not UTF-8")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        admission::{AdmissionSlots, Slot},
        node::Event,
        protocol::{Envelope, Intent},
    };
    use std::{collections::HashMap, sync::Mutex};
    use tokio::sync::watch;

    #[derive(Clone, Copy)]
    enum FirstSubmission {
        Normal,
        LostAfterExecution,
        LostBeforeExecution,
        DeterministicRefusal,
    }
    struct Prepared {
        entrypoint: &'static str,
        payload: Vec<Felt>,
        tickets: Vec<usize>,
    }
    struct State {
        prepared: Vec<Prepared>,
        submitted: Vec<Felt>,
        receipts: HashMap<Felt, Receipt>,
        heads: HashMap<Felt, u64>,
        effects: Vec<usize>,
    }
    struct TestNode {
        tickets: Vec<RecordedTicket>,
        poison: Option<usize>,
        poison_reason: &'static str,
        first: FirstSubmission,
        state: Mutex<State>,
    }
    impl TestNode {
        fn new(tickets: Vec<RecordedTicket>, poison: Option<usize>, first: FirstSubmission) -> Self {
            Self {
                tickets,
                poison,
                poison_reason: "Out of gas",
                first,
                state: Mutex::new(State {
                    prepared: vec![],
                    submitted: vec![],
                    receipts: HashMap::new(),
                    heads: HashMap::new(),
                    effects: vec![],
                }),
            }
        }
        fn included(&self, state: &mut State, hash: Felt, indexes: &[usize], rejection: bool) -> Receipt {
            let reverted = !rejection && indexes.iter().any(|index| Some(*index) == self.poison);
            let mut receipt = Receipt {
                transaction_hash: hash,
                execution_status: ExecutionStatus::Succeeded,
                revert_reason: None,
                events: vec![],
            };
            if reverted {
                receipt.execution_status = ExecutionStatus::Reverted;
                receipt.revert_reason = Some(self.poison_reason.into());
            } else {
                for index in indexes {
                    let ticket = &self.tickets[*index];
                    let head = state.heads.entry(ticket.intent.game).or_default();
                    assert_eq!(ticket.envelope.order, *head + 1);
                    *head = ticket.envelope.order;
                    receipt.events.push(Event {
                        from_address: ticket.intent.deployment,
                        keys: vec![selector("RecordingEvent"), selector("ExecutionRecorded")],
                        data: vec![
                            ticket.intent.game,
                            ticket.intent.actor,
                            ticket.intent.nonce.into(),
                            Felt::ONE,
                            ticket.envelope.order.into(),
                            if rejection { Felt::TWO } else { Felt::ONE },
                            if rejection { Felt::from_bytes_be_slice(b"EXECUTION_FAILED") } else { Felt::ZERO },
                            Felt::ZERO,
                            if rejection { Felt::from_bytes_be_slice(b"EXECUTION_FAILED") } else { Felt::ZERO },
                            if rejection { Felt::from(16) } else { Felt::ZERO },
                        ],
                    });
                    if !rejection {
                        state.effects.push(*index);
                    }
                }
            }
            state.receipts.insert(hash, receipt.clone());
            receipt
        }
    }
    #[async_trait::async_trait]
    impl ExecutionNode for TestNode {
        fn deployment(&self) -> Felt {
            Felt::TWO
        }
        async fn prepare(
            &self,
            _: Felt,
            entrypoint: &'static str,
            payload: Vec<Felt>,
        ) -> anyhow::Result<(Felt, Value)> {
            let mut state = self.state.lock().unwrap();
            let tickets = (0..self.tickets.len())
                .filter(|index| {
                    let fields = self.tickets[*index].calldata().unwrap();
                    payload.windows(fields.len()).any(|window| window == fields)
                })
                .collect::<Vec<_>>();
            assert!(!tickets.is_empty());
            state.prepared.push(Prepared { entrypoint, payload, tickets });
            Ok((Felt::from(state.prepared.len() as u64), Value::Null))
        }
        async fn execute(&self, hash: Felt, _: Value) -> anyhow::Result<Execution> {
            let mut state = self.state.lock().unwrap();
            state.submitted.push(hash);
            if let Some(receipt) = state.receipts.get(&hash) {
                return Ok(Execution::Included(Box::new(receipt.clone())));
            }
            let index = usize::try_from(hash).unwrap() - 1;
            let tickets = state.prepared[index].tickets.clone();
            let rejection = state.prepared[index].entrypoint == "reject_execution";
            if state.submitted.len() == 1 {
                match self.first {
                    FirstSubmission::LostAfterExecution => {
                        self.included(&mut state, hash, &tickets, rejection);
                        anyhow::bail!("lost result after node execution");
                    }
                    FirstSubmission::LostBeforeExecution => anyhow::bail!("temporary internal submission error"),
                    FirstSubmission::DeterministicRefusal => {
                        return Ok(Execution::Refused("Exceeded the maximum number of events, 1000".into()))
                    }
                    FirstSubmission::Normal => {}
                }
            }
            Ok(Execution::Included(Box::new(self.included(&mut state, hash, &tickets, rejection))))
        }
        async fn receipt(&self, hash: Felt) -> anyhow::Result<Option<Receipt>> {
            Ok(self.state.lock().unwrap().receipts.get(&hash).cloned())
        }
        async fn head_order(&self, game: Felt) -> anyhow::Result<u64> {
            Ok(self.state.lock().unwrap().heads.get(&game).copied().unwrap_or_default())
        }
        async fn wait_for_state_change(&self) {}
    }
    /// Tickets alternate between games 1 and 2, each numbering its own orders from one.
    fn pending(count: u64) -> (AdmissionSlots, Vec<PendingTicket>, Vec<watch::Receiver<ActionStatus>>) {
        let slots = AdmissionSlots::new(96, Felt::ZERO);
        let mut tickets = vec![];
        let mut statuses = vec![];
        for index in 0..count {
            let order = index / 2 + 1;
            let intent = Intent {
                chain: Felt::ONE,
                deployment: Felt::TWO,
                game: Felt::from(index % 2 + 1),
                actor: Felt::from(index + 100),
                nonce: 0,
                command: Felt::ONE,
                release_id: 1,
                preset_commitment: Felt::ONE,
                valid_from: 0,
                valid_until: 500,
                last_order: 100,
                arguments: if index == 1 { vec![Felt::ONE; 254] } else { vec![] },
            };
            let action = intent.identity().unwrap();
            let Slot::New(permit) = slots.reserve(intent.game, intent.actor, action).unwrap() else {
                panic!("new actor")
            };
            statuses.push(permit.subscribe());
            tickets.push(PendingTicket {
                record: RecordedTicket {
                    intent,
                    envelope: Envelope {
                        action,
                        order,
                        timestamp: 10,
                        release_id: 1,
                        preset_commitment: Felt::ONE,
                        epoch: 1,
                        root: [index as u8; 32],
                    },
                    signature: vec![Felt::ONE, Felt::TWO],
                },
                permit,
                received: Instant::now(),
            });
        }
        (slots, tickets, statuses)
    }
    #[test]
    fn receipt_keeps_the_domain_reason_and_rejects_malformed_byte_arrays() {
        let (_, tickets, _) = pending(1);
        let ticket = &tickets[0].record;
        let class = Felt::from_bytes_be_slice(b"GAMEPLAY_REJECTED");
        let message = b"structure is already at max level";
        let mut receipt = Receipt {
            transaction_hash: Felt::from(99),
            execution_status: ExecutionStatus::Succeeded,
            revert_reason: None,
            events: vec![Event {
                from_address: ticket.intent.deployment,
                keys: vec![selector("RecordingEvent"), selector("ExecutionRecorded")],
                data: vec![
                    ticket.intent.game,
                    ticket.intent.actor,
                    ticket.intent.nonce.into(),
                    Felt::ONE,
                    ticket.envelope.order.into(),
                    Felt::TWO,
                    class,
                    Felt::ONE,
                    Felt::from_bytes_be_slice(&message[..31]),
                    Felt::from_bytes_be_slice(&message[31..]),
                    Felt::TWO,
                ],
            }],
        };
        let outcomes = receipt_outcomes(std::iter::once(ticket), receipt.transaction_hash, &receipt).unwrap();
        assert!(matches!(&outcomes[0], ActionStatus::Recorded { succeeded: false, status_class, reason, .. }
            if *status_class == class && reason == "structure is already at max level"));
        receipt.events[0].data.push(Felt::ZERO);
        assert!(receipt_outcomes(std::iter::once(ticket), receipt.transaction_hash, &receipt).is_err());
    }

    fn recorded_once(statuses: &[watch::Receiver<ActionStatus>]) -> bool {
        statuses
            .iter()
            .all(|status| matches!(*status.borrow(), ActionStatus::Recorded { order: 1, succeeded: true, .. }))
    }
    #[tokio::test]
    async fn included_revert_is_bisected_and_only_poison_rejected_then_next_ticket_executes() {
        let (slots, tickets, statuses) = pending(3);
        let node = Arc::new(TestNode::new(
            tickets.iter().map(|ticket| ticket.record.clone()).collect(),
            Some(1),
            FirstSubmission::Normal,
        ));
        execute(node.clone(), tickets).await.unwrap();
        let state = node.state.lock().unwrap();
        // Game 2's poisoned first ticket is rejected in its own order; game 1 reaches order two.
        assert_eq!(state.effects, vec![0, 2]);
        assert_eq!((state.heads[&Felt::ONE], state.heads[&Felt::TWO]), (2, 1));
        assert_eq!(
            state
                .prepared
                .iter()
                .filter(|tx| tx.entrypoint == "reject_execution")
                .map(|tx| tx.tickets.clone())
                .collect::<Vec<_>>(),
            vec![vec![1]]
        );
        for (index, status) in statuses.iter().enumerate() {
            assert!(
                matches!(*status.borrow(), ActionStatus::Recorded { order, succeeded, nonce_consumed: true, .. } if order == index as u64 / 2 + 1 && succeeded == (index != 1))
            );
        }
        assert!(matches!(slots.reserve(Felt::TWO, Felt::from(101), Felt::from(999)), Ok(Slot::New(_))));
    }
    #[tokio::test]
    async fn mismatched_release_envelopes_pause_without_consuming_the_ticket() {
        for reason in ["envelope release mismatch", "envelope preset mismatch"] {
            let (_, tickets, statuses) = pending(1);
            let mut node = TestNode::new(
                tickets.iter().map(|ticket| ticket.record.clone()).collect(),
                Some(0),
                FirstSubmission::Normal,
            );
            node.poison_reason = reason;
            let node = Arc::new(node);
            assert!(execute(node.clone(), tickets).await.unwrap_err().to_string().contains("submission paused"));
            let state = node.state.lock().unwrap();
            assert_eq!(state.prepared.len(), 1);
            assert_eq!(state.prepared[0].entrypoint, "execute_batch");
            assert_eq!(state.submitted, vec![Felt::ONE; ATTEMPTS]);
            assert!(state.effects.is_empty() && state.heads.is_empty());
            assert!(!matches!(*statuses[0].borrow(), ActionStatus::Recorded { .. }));
        }
    }
    #[tokio::test]
    async fn lost_receipt_after_execution_adopts_outcome_without_duplicate_or_rejection() {
        let (_, tickets, statuses) = pending(2);
        let node = Arc::new(TestNode::new(
            tickets.iter().map(|ticket| ticket.record.clone()).collect(),
            None,
            FirstSubmission::LostAfterExecution,
        ));
        execute(node.clone(), tickets).await.unwrap();
        let state = node.state.lock().unwrap();
        assert_eq!(state.effects, vec![0, 1]);
        assert_eq!(state.prepared.len(), 1);
        assert_eq!(state.submitted.len(), 1);
        assert!(recorded_once(&statuses));
    }
    #[tokio::test]
    async fn lost_receipt_before_execution_replays_identical_transaction_and_context() {
        let (_, tickets, statuses) = pending(2);
        let expected = batch_calldata(tickets.iter().map(|ticket| &ticket.record), false).unwrap();
        let node = Arc::new(TestNode::new(
            tickets.iter().map(|ticket| ticket.record.clone()).collect(),
            None,
            FirstSubmission::LostBeforeExecution,
        ));
        execute(node.clone(), tickets).await.unwrap();
        let state = node.state.lock().unwrap();
        assert_eq!(state.effects, vec![0, 1]);
        assert_eq!(state.prepared.len(), 1);
        assert_eq!(state.prepared[0].payload, expected);
        assert_eq!(state.submitted, vec![Felt::ONE, Felt::ONE]);
        assert!(recorded_once(&statuses));
    }
    #[tokio::test]
    async fn deterministic_executor_refusal_rejects_one_ticket_and_advances() {
        let (_, tickets, statuses) = pending(1);
        let node = Arc::new(TestNode::new(
            tickets.iter().map(|ticket| ticket.record.clone()).collect(),
            None,
            FirstSubmission::DeterministicRefusal,
        ));
        execute(node.clone(), tickets).await.unwrap();
        assert_eq!(node.state.lock().unwrap().heads[&Felt::ONE], 1);
        assert!(node.state.lock().unwrap().effects.is_empty());
        assert!(matches!(*statuses[0].borrow(), ActionStatus::Recorded { succeeded: false, nonce_consumed: true, .. }));
    }
    #[test]
    fn bisection_keeps_every_ticket_and_records_only_the_poison() {
        let mut ranges = VecDeque::from_iter(std::iter::once(0..64));
        let mut successes = vec![];
        let mut rejected = vec![];
        while let Some(range) = ranges.pop_front() {
            if !range.contains(&37) {
                successes.extend(range);
            } else if range.len() == 1 {
                rejected.push(range.start);
            } else {
                split_front(&mut ranges, range);
            }
        }
        assert_eq!(rejected, vec![37]);
        assert_eq!(successes, (0..64).filter(|id| *id != 37).collect::<Vec<_>>());
        for transient in ["nonce mismatch", "queue full", "out of order", "timeout"] {
            assert!(!deterministic_limit(transient));
        }
    }
}
