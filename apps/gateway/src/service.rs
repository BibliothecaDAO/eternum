use crate::{
    admission::{AdmissionSlots, IpLimits, Permit, Slot},
    epoch::EpochSecret,
    execution::{self, ExecutionNode, PendingTicket, SUBMISSION_TIMEOUT},
    metrics::METRICS,
    node::{Execution, ExecutionStatus, Node},
    protocol::{Envelope, Intent},
    ticket::{context_matches, ActionRequest, ActionStatus, RecordedTicket},
};
use anyhow::{ensure, Context};
use futures::{future::BoxFuture, FutureExt};
use jsonrpsee::{types::ErrorObjectOwned, RpcModule, SubscriptionMessage};
use starknet_types_core::felt::Felt;
use std::{
    collections::HashMap,
    net::IpAddr,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::{mpsc, watch};

/// Player tickets per batch. One transaction may execute 1.1e9 Sierra gas (versioned constants
/// 0.14.2); the costliest player action in single-ticket receipts, an explore, took 171.5M L2 gas
/// with the batch wrapper, so six fit where sixteen reverted out of gas in the 96-player run.
const MAX_BATCH: usize = 6;
const PACK_DELAY: Duration = Duration::from_millis(10);
const EPOCH_TICKETS: u64 = 100_000;
/// After a failed run (node restart, lost connection, an epoch command waiting on earlier account
/// transactions) admission restarts from recorded chain state after this pause.
const RESTART_DELAY: Duration = Duration::from_secs(2);

struct Request {
    intent: Intent,
    signature: Vec<Felt>,
    permit: Permit,
    received: Instant,
}

/// Everything admission and its run loop read from the node, so both run against a test chain.
#[async_trait::async_trait]
pub(crate) trait GatewayNode: AssignmentNode + ExecutionNode + 'static {
    /// The chain and deployment every intent must be signed for.
    fn domain(&self) -> (Felt, Felt);
    async fn signed_by(&self, actor: Felt, action: Felt, signature: &[Felt]) -> anyhow::Result<bool>;
    async fn recorded_action(&self, intent: &Intent) -> anyhow::Result<Option<ActionStatus>>;
    /// The game deployment and its sequencing account both exist.
    async fn ready(&self) -> anyhow::Result<bool>;
}

#[async_trait::async_trait]
impl GatewayNode for Node {
    fn domain(&self) -> (Felt, Felt) {
        (self.chain, self.deployment)
    }
    async fn signed_by(&self, actor: Felt, action: Felt, signature: &[Felt]) -> anyhow::Result<bool> {
        Node::signed_by(self, actor, action, signature).await
    }
    async fn recorded_action(&self, intent: &Intent) -> anyhow::Result<Option<ActionStatus>> {
        Node::recorded_action(self, intent).await
    }
    async fn ready(&self) -> anyhow::Result<bool> {
        Ok(self.is_deployed(self.deployment).await? && self.is_deployed(self.account).await?)
    }
}

struct Shared<N> {
    node: Arc<N>,
    slots: AdmissionSlots,
    sender: Mutex<Option<mpsc::Sender<Request>>>,
    ip_limits: Mutex<IpLimits>,
}

pub struct GameApi<N = Node>(Arc<Shared<N>>);

impl<N> Clone for GameApi<N> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<N: GatewayNode> GameApi<N> {
    pub(crate) fn new(node: Arc<N>, slots: AdmissionSlots) -> Self {
        Self(Arc::new(Shared { node, slots, sender: Mutex::new(None), ip_limits: Mutex::new(IpLimits::default()) }))
    }

    async fn admit(&self, peer: IpAddr, action: ActionRequest) -> anyhow::Result<watch::Receiver<ActionStatus>> {
        ensure!(
            self.0.ip_limits.lock().expect("admission limiter poisoned").allow(peer, Instant::now()),
            "request rate exceeded"
        );
        let node = &self.0.node;
        let (chain, deployment) = node.domain();
        let intent = action.decode(chain, deployment)?;
        let digest = intent.identity()?;
        // get_admission refuses an actor that does not run the shard's account class.
        let fields = node.admission(intent.game, intent.actor).await?;
        let [_, _, nonce, _, _] = fields.as_slice() else { anyhow::bail!("malformed admission view") };
        // A forged or revoked key never takes the actor's slot.
        ensure!(node.signed_by(intent.actor, digest, &action.signature).await?, "invalid player signature");
        if *nonce != Felt::from(intent.nonce) {
            if *nonce > Felt::from(intent.nonce) {
                if let Some(outcome) = node.recorded_action(&intent).await? {
                    return Ok(watch::channel(outcome).1);
                }
            }
            anyhow::bail!("actor nonce is not current; no matching action in reconnect history");
        }
        match self.0.slots.reserve(intent.game, intent.actor, digest).map_err(anyhow::Error::msg)? {
            Slot::Existing(receiver) => Ok(receiver),
            Slot::New(permit) => {
                let receiver = permit.subscribe();
                let sender = self
                    .0
                    .sender
                    .lock()
                    .expect("admission sender poisoned")
                    .clone()
                    .context("game admission is unavailable")?;
                sender
                    .try_send(Request { intent, signature: action.signature, permit, received: Instant::now() })
                    .map_err(|_| anyhow::anyhow!("game admission queue is full or unavailable"))?;
                Ok(receiver)
            }
        }
    }

    pub fn metrics(&self) -> String {
        METRICS.render(self.0.slots.held())
    }

    /// The client address is the TCP peer's, or the trusted proxy's own forwarded entry.
    pub fn rpc(&self, peer: IpAddr) -> anyhow::Result<RpcModule<Self>> {
        let mut module = RpcModule::new(self.clone());
        module.register_subscription(
            "game_subscribeAction",
            "game_action",
            "game_unsubscribeAction",
            move |params, pending, api| async move {
                let action = match params.one::<ActionRequest>() {
                    Ok(action) => action,
                    Err(error) => {
                        pending.reject(error).await;
                        return Ok(());
                    }
                };
                let mut updates = match api.admit(peer, action).await {
                    Ok(updates) => updates,
                    Err(error) => {
                        pending.reject(ErrorObjectOwned::owned(-32001, format!("{error:#}"), None::<()>)).await;
                        return Ok(());
                    }
                };
                let sink = pending.accept().await?;
                loop {
                    let status = updates.borrow_and_update().clone();
                    sink.send(SubscriptionMessage::from_json(&status)?).await?;
                    if status.is_final() {
                        break;
                    }
                    tokio::select! {
                        _ = sink.closed() => break,
                        changed = updates.changed() => { if changed.is_err() { break; } }
                    }
                }
                Ok(())
            },
        )?;
        Ok(module)
    }

    /// Admission runs until it fails, then restarts from recorded chain state. Pending tickets end
    /// with their run; clients resubmit the same signed intent and never execute twice.
    pub async fn run_forever(self, secret: PathBuf) {
        loop {
            let result = run(self.clone(), &secret).await;
            self.0.sender.lock().expect("admission sender poisoned").take();
            if let Err(error) = result {
                tracing::error!(target: "gateway", error = format!("{error:#}"), "admission stopped; restarting from recorded state");
            }
            tokio::time::sleep(RESTART_DELAY).await;
        }
    }
}

async fn run<N: GatewayNode>(api: GameApi<N>, path: &Path) -> anyhow::Result<()> {
    let node = api.0.node.clone();
    while !node.ready().await? {
        node.wait_for_state_change().await;
    }
    // Account transactions execute in nonce order, so the start-up epoch commands land only after
    // every transaction the node retained from a previous run has executed or been dropped.
    let mut assignments = Assignments::start(node.as_ref(), path).await?;
    // Each queued request holds a slot, so a channel of the slot bound never refuses one as full.
    let (sender, mut requests) = mpsc::channel(api.0.slots.bound());
    *api.0.sender.lock().expect("admission sender poisoned") = Some(sender);
    tracing::info!(target: "gateway", epoch = assignments.epoch.epoch, "admission open");
    let mut packer = Packer::new(api.0.slots.authority());
    let mut flight: Option<BoxFuture<'static, anyhow::Result<()>>> = None;
    loop {
        if flight.is_none() && packer.ready() {
            let batch = packer.take();
            for ticket in &batch {
                METRICS.left_queue_after(ticket.received.elapsed());
            }
            flight = Some(execution::execute(node.clone(), batch).boxed());
        }
        if flight.is_none() && packer.is_empty() && assignments.rotation_due() {
            assignments.rotate(node.as_ref(), path).await?;
        }
        tokio::select! {
            request = requests.recv(), if !packer.full() && !assignments.rotation_due() => {
                let request = request.context("game request queue closed")?;
                let action = request.intent.identity()?;
                match assignments.assign(node.as_ref(), &request).await {
                    Ok(record) => {
                        let (game, order) = (record.intent.game, record.envelope.order);
                        request.permit.resolve(ActionStatus::Accepted { action, order });
                        METRICS.accepted();
                        tracing::debug!(target: "gateway", %action, %game, order,
                            admission_ms = request.received.elapsed().as_secs_f64() * 1000.0, "game_action_accepted");
                        packer.push(PendingTicket { record, permit: request.permit, received: request.received });
                    }
                    Err(error) => request.permit.resolve(ActionStatus::Refused { action, reason: format!("{error:#}") }),
                }
            }
            result = async { flight.as_mut().expect("flight branch enabled").await }, if flight.is_some() => {
                result?;
                flight = None;
            }
            _ = tokio::time::sleep_until(packer.deadline), if flight.is_none() && !packer.is_empty() => {}
        }
    }
}

/// Batches that fit one transaction's execution cap: up to `MAX_BATCH` player tickets, or one
/// authority ticket alone, since each administrative command is sized by its contract to fill a
/// transaction (a roster settlement step took about 650M L2 gas).
struct Packer {
    batch: Vec<PendingTicket>,
    /// An authority ticket accepted behind player tickets starts the next batch, keeping order.
    next: Option<PendingTicket>,
    authority: Felt,
    deadline: tokio::time::Instant,
}

impl Packer {
    fn new(authority: Felt) -> Self {
        Self { batch: vec![], next: None, authority, deadline: tokio::time::Instant::now() }
    }

    fn is_empty(&self) -> bool {
        self.batch.is_empty()
    }

    fn full(&self) -> bool {
        self.next.is_some()
            || self.batch.len() >= MAX_BATCH
            || self.batch.first().is_some_and(|ticket| self.is_authority(ticket))
    }

    fn ready(&self) -> bool {
        !self.batch.is_empty() && (self.full() || tokio::time::Instant::now() >= self.deadline)
    }

    fn push(&mut self, ticket: PendingTicket) {
        if self.is_authority(&ticket) && !self.batch.is_empty() {
            self.next = Some(ticket);
        } else {
            self.open(ticket);
        }
    }

    fn take(&mut self) -> Vec<PendingTicket> {
        let batch = std::mem::take(&mut self.batch);
        if let Some(ticket) = self.next.take() {
            self.open(ticket);
        }
        batch
    }

    fn open(&mut self, ticket: PendingTicket) {
        if self.batch.is_empty() {
            self.deadline = tokio::time::Instant::now() + PACK_DELAY;
        }
        self.batch.push(ticket);
    }

    fn is_authority(&self, ticket: &PendingTicket) -> bool {
        ticket.record.intent.actor == self.authority
    }
}

/// Chain reads and account commands that order assignment needs.
#[async_trait::async_trait]
pub(crate) trait AssignmentNode: Send + Sync {
    async fn admission(&self, game: Felt, actor: Felt) -> anyhow::Result<Vec<Felt>>;
    fn timestamp(&self) -> u64;
    async fn account_view(&self, name: &'static str, args: Vec<Felt>) -> anyhow::Result<Vec<Felt>>;
    async fn account_command(&self, name: &'static str, payload: Vec<Felt>) -> anyhow::Result<()>;
}

#[async_trait::async_trait]
impl AssignmentNode for Node {
    async fn admission(&self, game: Felt, actor: Felt) -> anyhow::Result<Vec<Felt>> {
        self.call(self.deployment, "get_admission", vec![game, actor]).await
    }
    /// Recorded time is the latest confirmed block's, so execution never sees a future timestamp.
    fn timestamp(&self) -> u64 {
        self.head().timestamp
    }
    async fn account_view(&self, name: &'static str, args: Vec<Felt>) -> anyhow::Result<Vec<Felt>> {
        self.call(self.account, name, args).await
    }
    /// Any outcome but inclusion fails the run; the restart re-reads the epoch from the chain, so a
    /// command that did land is never sent twice.
    async fn account_command(&self, name: &'static str, payload: Vec<Felt>) -> anyhow::Result<()> {
        let (hash, transaction) = Node::prepare(self, self.account, name, payload).await?;
        match Node::execute(self, hash, transaction).await? {
            Execution::Included(receipt) if receipt.execution_status == ExecutionStatus::Succeeded => Ok(()),
            Execution::Included(receipt) => {
                anyhow::bail!("randomness epoch transition reverted: {}", receipt.revert_reason.unwrap_or_default())
            }
            Execution::Refused(reason) => anyhow::bail!("randomness epoch transition refused: {reason}"),
        }
    }
}

/// The volatile half of admission: the open epoch and each game's next order. Nothing here
/// survives a restart except the epoch secret, so every game resumes from its recorded head.
struct Assignments {
    epoch: EpochSecret,
    orders: HashMap<Felt, u64>,
    admitted: u64,
}

impl Assignments {
    async fn start(node: &impl AssignmentNode, path: &Path) -> anyhow::Result<Self> {
        Ok(Self { epoch: rotate_epoch(node, path).await?, orders: HashMap::new(), admitted: 0 })
    }

    fn rotation_due(&self) -> bool {
        self.admitted >= EPOCH_TICKETS
    }

    /// Callers rotate only with nothing queued or in flight.
    async fn rotate(&mut self, node: &impl AssignmentNode, path: &Path) -> anyhow::Result<()> {
        self.epoch = rotate_epoch(node, path).await?;
        self.admitted = 0;
        Ok(())
    }

    async fn assign(&mut self, node: &impl AssignmentNode, request: &Request) -> anyhow::Result<RecordedTicket> {
        let record = accept(node, &self.epoch, &self.orders, request).await?;
        self.orders.insert(record.intent.game, record.envelope.order + 1);
        self.admitted += 1;
        Ok(record)
    }
}

async fn accept(
    node: &impl AssignmentNode,
    epoch: &EpochSecret,
    orders: &HashMap<Felt, u64>,
    request: &Request,
) -> anyhow::Result<RecordedTicket> {
    let intent = &request.intent;
    let fields = node.admission(intent.game, intent.actor).await?;
    let [rules, config, nonce, recorded_next, observed_time] = fields.as_slice() else {
        anyhow::bail!("malformed admission view")
    };
    let order = match orders.get(&intent.game) {
        Some(order) => *order,
        None => (*recorded_next).try_into()?,
    };
    ensure!(*rules == intent.rules && *nonce == Felt::from(intent.nonce), "admission state changed");
    let timestamp = node.timestamp();
    let now: u64 = (*observed_time).try_into()?;
    ensure!(context_matches(intent, order, timestamp) && now <= intent.valid_until, "intent expired before acceptance");
    Ok(RecordedTicket {
        intent: intent.clone(),
        envelope: Envelope {
            action: intent.identity()?,
            order,
            timestamp,
            execution_config: *config,
            epoch: epoch.epoch,
            root: epoch.root(intent.game, order),
        },
        signature: request.signature.clone(),
    })
}

/// An epoch command that cannot land fails the run within the submission timeout instead of
/// holding admission; the restart re-reads the epoch from the chain.
async fn epoch_command(node: &impl AssignmentNode, name: &'static str, payload: Vec<Felt>) -> anyhow::Result<()> {
    tokio::time::timeout(SUBMISSION_TIMEOUT, node.account_command(name, payload))
        .await
        .map_err(|_| anyhow::anyhow!("randomness epoch transition {name} did not land"))?
}

/// Every start and every rotation reveals the open epoch and commits a fresh secret. Callers
/// rotate only with nothing queued or in flight, so no assigned root outlives its epoch.
async fn rotate_epoch(node: &impl AssignmentNode, path: &Path) -> anyhow::Result<EpochSecret> {
    let current = node.account_view("current_randomness_epoch", vec![]).await?;
    let [id] = current.as_slice() else { anyhow::bail!("malformed current epoch") };
    let id: u64 = (*id).try_into()?;
    if id != 0 {
        let epoch = node.account_view("get_randomness_epoch", vec![id.into()]).await?;
        let [commitment, unrevealed, ..] = epoch.as_slice() else { anyhow::bail!("malformed randomness epoch") };
        if *unrevealed == Felt::ONE {
            let secret = EpochSecret::load(path)?;
            ensure!(
                secret.epoch == id && secret.commitment() == *commitment,
                "epoch secret does not match chain commitment"
            );
            epoch_command(node, "reveal_randomness_epoch", secret.reveal().to_vec()).await?;
        }
    }
    let secret = EpochSecret::create(id + 1)?;
    secret.save(path)?;
    epoch_command(node, "open_randomness_epoch", vec![secret.commitment()]).await?;
    Ok(secret)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        node::{Event, Receipt},
        transaction::selector,
    };
    use serde_json::Value;
    use std::collections::HashSet;

    const RULES: Felt = Felt::from_hex_unchecked("0x7");
    const GAME_A: Felt = Felt::ONE;
    const GAME_B: Felt = Felt::TWO;
    const DEPLOYMENT: Felt = Felt::TWO;

    /// A test chain that orders, executes and records like the season contract behind the node.
    #[derive(Default)]
    struct Chain {
        heads: HashMap<Felt, u64>,
        nonces: HashMap<(Felt, Felt), u64>,
        epoch: u64,
        commitment: Felt,
        revealed: bool,
        commands: Vec<(&'static str, Vec<Felt>)>,
        prepared: Vec<(&'static str, Vec<Felt>)>,
        receipts: HashMap<Felt, Receipt>,
        /// The (game, order) pairs of each executed batch, and of each recorded rejection.
        batches: Vec<Vec<(Felt, u64)>>,
        rejected: Vec<(Felt, u64)>,
        /// Submissions that fail inside the node before execution, one per attempt.
        internal_failures: usize,
        /// Actors whose batches the node drops before inclusion, every time.
        unlandable: HashSet<Felt>,
        /// Epoch commands never land.
        stuck_epochs: bool,
    }
    #[derive(Default)]
    struct TestChain(Mutex<Chain>);

    impl Chain {
        fn record(&mut self, hash: Felt, tickets: &[RecordedTicket], rejection: bool) -> Receipt {
            let mut events = vec![];
            for ticket in tickets {
                let (game, actor) = (ticket.intent.game, ticket.intent.actor);
                let head = self.heads.entry(game).or_default();
                assert_eq!(ticket.envelope.order, *head + 1, "out of order");
                *head = ticket.envelope.order;
                *self.nonces.entry((game, actor)).or_default() += 1;
                events.push(Event {
                    from_address: DEPLOYMENT,
                    keys: vec![selector("RecordingEvent"), selector("ExecutionRecorded")],
                    data: vec![
                        game,
                        actor,
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
            }
            let placed = tickets.iter().map(|ticket| (ticket.intent.game, ticket.envelope.order));
            if rejection {
                self.rejected.extend(placed);
            } else {
                self.batches.push(placed.collect());
            }
            let receipt = Receipt {
                transaction_hash: hash,
                execution_status: ExecutionStatus::Succeeded,
                revert_reason: None,
                events,
            };
            self.receipts.insert(hash, receipt.clone());
            receipt
        }
    }

    #[async_trait::async_trait]
    impl AssignmentNode for TestChain {
        async fn admission(&self, game: Felt, actor: Felt) -> anyhow::Result<Vec<Felt>> {
            let chain = self.0.lock().unwrap();
            let next = chain.heads.get(&game).copied().unwrap_or_default() + 1;
            let nonce = chain.nonces.get(&(game, actor)).copied().unwrap_or_default();
            Ok(vec![RULES, Felt::ONE, nonce.into(), next.into(), Felt::from(100)])
        }
        fn timestamp(&self) -> u64 {
            100
        }
        async fn account_view(&self, name: &'static str, _: Vec<Felt>) -> anyhow::Result<Vec<Felt>> {
            let chain = self.0.lock().unwrap();
            Ok(match name {
                "current_randomness_epoch" => vec![chain.epoch.into()],
                _ if chain.revealed => vec![chain.commitment, Felt::ZERO, Felt::ZERO, Felt::ZERO],
                _ => vec![chain.commitment, Felt::ONE],
            })
        }
        async fn account_command(&self, name: &'static str, payload: Vec<Felt>) -> anyhow::Result<()> {
            if self.0.lock().unwrap().stuck_epochs {
                return futures::future::pending().await;
            }
            let mut chain = self.0.lock().unwrap();
            if name == "open_randomness_epoch" {
                (chain.epoch, chain.commitment, chain.revealed) = (chain.epoch + 1, payload[0], false);
            } else {
                chain.revealed = true;
            }
            chain.commands.push((name, payload));
            Ok(())
        }
    }

    #[async_trait::async_trait]
    impl ExecutionNode for TestChain {
        fn deployment(&self) -> Felt {
            DEPLOYMENT
        }
        async fn prepare(
            &self,
            _: Felt,
            entrypoint: &'static str,
            payload: Vec<Felt>,
        ) -> anyhow::Result<(Felt, Value)> {
            let mut chain = self.0.lock().unwrap();
            chain.prepared.push((entrypoint, payload));
            Ok((Felt::from(chain.prepared.len() as u64), Value::Null))
        }
        async fn execute(&self, hash: Felt, _: Value) -> anyhow::Result<Execution> {
            let mut chain = self.0.lock().unwrap();
            if let Some(receipt) = chain.receipts.get(&hash) {
                return Ok(Execution::Included(Box::new(receipt.clone())));
            }
            if chain.internal_failures > 0 {
                chain.internal_failures -= 1;
                anyhow::bail!("temporary internal submission error");
            }
            let (entrypoint, payload) = chain.prepared[usize::try_from(hash)? - 1].clone();
            let rejection = entrypoint == "reject_execution";
            let mut fields = &payload[usize::from(!rejection)..];
            let mut tickets = vec![];
            while !fields.is_empty() {
                tickets.push(RecordedTicket::take_calldata(&mut fields)?);
            }
            if !rejection && tickets.iter().any(|ticket| chain.unlandable.contains(&ticket.intent.actor)) {
                return Ok(Execution::Refused("dropped before inclusion; simulation succeeds".into()));
            }
            Ok(Execution::Included(Box::new(chain.record(hash, &tickets, rejection))))
        }
        async fn receipt(&self, hash: Felt) -> anyhow::Result<Option<Receipt>> {
            Ok(self.0.lock().unwrap().receipts.get(&hash).cloned())
        }
        async fn head_order(&self, game: Felt) -> anyhow::Result<u64> {
            Ok(self.0.lock().unwrap().heads.get(&game).copied().unwrap_or_default())
        }
        async fn wait_for_state_change(&self) {
            tokio::task::yield_now().await;
        }
    }

    #[async_trait::async_trait]
    impl GatewayNode for TestChain {
        fn domain(&self) -> (Felt, Felt) {
            (Felt::ONE, DEPLOYMENT)
        }
        async fn signed_by(&self, _: Felt, _: Felt, signature: &[Felt]) -> anyhow::Result<bool> {
            Ok(signature == VALID_SIGNATURE)
        }
        async fn recorded_action(&self, _: &Intent) -> anyhow::Result<Option<ActionStatus>> {
            Ok(None)
        }
        async fn ready(&self) -> anyhow::Result<bool> {
            Ok(true)
        }
    }

    const VALID_SIGNATURE: [Felt; 2] = [Felt::ONE, Felt::TWO];

    fn intent(game: Felt, actor: u64, nonce: u64) -> Intent {
        Intent {
            chain: Felt::ONE,
            deployment: DEPLOYMENT,
            game,
            actor: Felt::from(actor),
            nonce,
            command: Felt::ONE,
            rules: RULES,
            valid_from: 0,
            valid_until: 1000,
            last_order: 1000,
            arguments: vec![],
        }
    }

    fn signed(intent: &Intent, signature: &[Felt]) -> ActionRequest {
        ActionRequest { intent: intent.encode().unwrap(), signature: signature.to_vec() }
    }

    struct Shard {
        api: GameApi<TestChain>,
        chain: Arc<TestChain>,
        run: tokio::task::JoinHandle<()>,
        _directory: tempfile::TempDir,
    }

    impl Shard {
        /// A gateway admitting against the test chain, returned once its run loop is open.
        async fn open(chain: TestChain) -> Self {
            let directory = tempfile::tempdir().unwrap();
            let chain = Arc::new(chain);
            let api = GameApi::new(chain.clone(), AdmissionSlots::new(96, Felt::from(7)));
            let run = tokio::spawn(api.clone().run_forever(directory.path().join("epoch.json")));
            let shard = Self { api, chain, run, _directory: directory };
            shard.wait_until_open().await;
            shard
        }

        async fn wait_until_open(&self) {
            while self.api.0.sender.lock().unwrap().is_none() {
                tokio::time::sleep(Duration::from_millis(1)).await;
            }
        }

        async fn submit(&self, request: ActionRequest) -> anyhow::Result<watch::Receiver<ActionStatus>> {
            self.api.admit(IpAddr::from([127, 0, 0, 1]), request).await
        }
    }

    impl Drop for Shard {
        fn drop(&mut self) {
            self.run.abort();
        }
    }

    /// The ticket's final status, or `None` when its run ended before an outcome.
    async fn outcome(mut updates: watch::Receiver<ActionStatus>) -> Option<ActionStatus> {
        loop {
            let status = updates.borrow_and_update().clone();
            if status.is_final() {
                return Some(status);
            }
            updates.changed().await.ok()?;
        }
    }

    fn succeeded(status: &Option<ActionStatus>) -> bool {
        matches!(status, Some(ActionStatus::Recorded { succeeded: true, .. }))
    }

    #[tokio::test(start_paused = true)]
    async fn queued_tickets_pack_in_each_games_order_and_authority_work_travels_alone() {
        let shard = Shard::open(TestChain::default()).await;
        let mut updates = vec![];
        for actor in 0..40 {
            let game = if actor % 2 == 0 { GAME_A } else { GAME_B };
            updates.push(shard.submit(signed(&intent(game, 100 + actor, 0), &VALID_SIGNATURE)).await.unwrap());
            if actor == 12 {
                let settlement = signed(&intent(GAME_A, 7, 0), &VALID_SIGNATURE);
                updates.push(shard.submit(settlement).await.unwrap());
            }
        }
        let mut authority_order = None;
        for (index, update) in updates.into_iter().enumerate() {
            let status = outcome(update).await;
            assert!(succeeded(&status));
            if index == 13 {
                let Some(ActionStatus::Recorded { order, .. }) = status else { unreachable!() };
                authority_order = Some(order);
            }
        }
        let chain = shard.chain.0.lock().unwrap();
        assert!(chain.batches.len() > 1 && chain.batches.iter().all(|batch| batch.len() <= MAX_BATCH));
        let settlement = (GAME_A, authority_order.unwrap());
        assert!(chain.batches.contains(&vec![settlement]), "the authority's ticket shared a batch");
        for (game, count) in [(GAME_A, 21), (GAME_B, 20)] {
            let orders: Vec<_> =
                chain.batches.iter().flatten().filter(|(of, _)| *of == game).map(|(_, order)| *order).collect();
            assert_eq!(orders, (1..=count).collect::<Vec<_>>());
        }
    }

    #[tokio::test(start_paused = true)]
    async fn an_unlandable_ticket_is_rejected_alone_and_admission_continues() {
        let chain = TestChain::default();
        chain.0.lock().unwrap().unlandable.insert(Felt::from(101));
        let shard = Shard::open(chain).await;
        let mut updates = vec![];
        for actor in [100, 101, 102] {
            updates.push(shard.submit(signed(&intent(GAME_A, actor, 0), &VALID_SIGNATURE)).await.unwrap());
        }
        let [first, poison, last] = updates.try_into().unwrap();
        assert!(succeeded(&outcome(first).await) && succeeded(&outcome(last).await));
        assert!(matches!(
            outcome(poison).await,
            Some(ActionStatus::Recorded { succeeded: false, nonce_consumed: true, .. })
        ));
        assert_eq!(shard.chain.0.lock().unwrap().rejected.len(), 1);
        shard.chain.0.lock().unwrap().unlandable.clear();
        let next = shard.submit(signed(&intent(GAME_A, 101, 1), &VALID_SIGNATURE)).await.unwrap();
        assert!(succeeded(&outcome(next).await));
    }

    #[tokio::test(start_paused = true)]
    async fn an_internal_failure_restarts_admission_and_the_same_signed_intent_lands_once() {
        let chain = TestChain::default();
        chain.0.lock().unwrap().internal_failures = 3;
        let shard = Shard::open(chain).await;
        let request = signed(&intent(GAME_A, 100, 0), &VALID_SIGNATURE);
        let lost = shard.submit(request.clone()).await.unwrap();
        assert_eq!(outcome(lost).await, None, "the run holding the ticket ended without an outcome");
        shard.wait_until_open().await;
        let resubmitted = shard.submit(request).await.unwrap();
        let other = shard.submit(signed(&intent(GAME_B, 200, 0), &VALID_SIGNATURE)).await.unwrap();
        assert!(succeeded(&outcome(resubmitted).await) && succeeded(&outcome(other).await));
        let chain = shard.chain.0.lock().unwrap();
        assert_eq!(chain.batches.iter().flatten().filter(|(game, _)| *game == GAME_A).count(), 1);
        assert_eq!(chain.epoch, 2, "the restart opened a fresh epoch");
    }

    #[tokio::test(start_paused = true)]
    async fn forged_signatures_and_stale_nonces_never_take_the_actors_slot() {
        let shard = Shard::open(TestChain::default()).await;
        let forged = shard.submit(signed(&intent(GAME_A, 100, 0), &[Felt::from(9)])).await;
        assert!(forged.unwrap_err().to_string().contains("invalid player signature"));
        let conflict = shard.submit(signed(&intent(GAME_A, 100, 1), &VALID_SIGNATURE)).await;
        assert!(conflict.unwrap_err().to_string().contains("actor nonce is not current"));
        let valid = shard.submit(signed(&intent(GAME_A, 100, 0), &VALID_SIGNATURE)).await.unwrap();
        assert!(succeeded(&outcome(valid).await));
    }

    #[tokio::test(start_paused = true)]
    async fn an_epoch_command_that_cannot_land_fails_the_run_instead_of_holding_admission() {
        let directory = tempfile::tempdir().unwrap();
        let chain = TestChain::default();
        chain.0.lock().unwrap().stuck_epochs = true;
        let error = Assignments::start(&chain, &directory.path().join("epoch.json")).await.err().unwrap();
        assert!(error.to_string().contains("did not land"), "{error}");
    }

    fn request(slots: &AdmissionSlots, game: Felt, actor: u64) -> Request {
        let intent = Intent {
            chain: Felt::ONE,
            deployment: Felt::TWO,
            game,
            actor: Felt::from(actor),
            nonce: 0,
            command: Felt::ONE,
            rules: RULES,
            valid_from: 0,
            valid_until: 1000,
            last_order: 1000,
            arguments: vec![],
        };
        let Slot::New(permit) = slots.reserve(game, intent.actor, intent.identity().unwrap()).unwrap() else {
            panic!("new actor")
        };
        Request { intent, signature: vec![Felt::ONE, Felt::TWO], permit, received: Instant::now() }
    }

    fn assigned(record: &RecordedTicket) -> (Felt, u64, u64) {
        (record.intent.game, record.envelope.order, record.envelope.epoch)
    }

    #[tokio::test]
    async fn each_game_takes_its_next_order_from_its_own_recorded_head() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("epoch.json");
        let chain = TestChain::default();
        chain.0.lock().unwrap().heads.insert(GAME_A, 5);
        let slots = AdmissionSlots::new(96, Felt::ZERO);
        let mut assignments = Assignments::start(&chain, &path).await.unwrap();
        let mut records = vec![];
        for (game, actor) in [(GAME_A, 1), (GAME_B, 2), (GAME_A, 3)] {
            records.push(assignments.assign(&chain, &request(&slots, game, actor)).await.unwrap());
        }
        assert_eq!(records.iter().map(assigned).collect::<Vec<_>>(), [(GAME_A, 6, 1), (GAME_B, 1, 1), (GAME_A, 7, 1)]);
        for record in &records {
            assert_eq!(record.envelope.root, assignments.epoch.root(record.intent.game, record.envelope.order));
        }
        assert_eq!(assignments.admitted, 3);
    }

    #[tokio::test]
    async fn a_restart_that_loses_one_games_tickets_leaves_the_other_chain_intact() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("epoch.json");
        let chain = TestChain::default();
        let slots = AdmissionSlots::new(96, Felt::ZERO);
        let mut before = Assignments::start(&chain, &path).await.unwrap();
        let mut queued = vec![];
        for (game, actor) in [(GAME_A, 1), (GAME_A, 2), (GAME_B, 3)] {
            queued.push(before.assign(&chain, &request(&slots, game, actor)).await.unwrap());
        }
        // Game B's ticket was recorded; game A's two tickets were lost in the restart.
        chain.0.lock().unwrap().heads.insert(GAME_B, 1);
        drop(queued.drain(1..));
        let revealed = before.epoch.reveal();
        let mut after = Assignments::start(&chain, &path).await.unwrap();
        let commands = chain.0.lock().unwrap().commands.iter().map(|(name, _)| *name).collect::<Vec<_>>();
        assert_eq!(commands, ["open_randomness_epoch", "reveal_randomness_epoch", "open_randomness_epoch"]);
        assert_eq!(chain.0.lock().unwrap().commands[1].1, revealed);
        let game_a = after.assign(&chain, &request(&slots, GAME_A, 4)).await.unwrap();
        let game_b = after.assign(&chain, &request(&slots, GAME_B, 5)).await.unwrap();
        assert_eq!([assigned(&game_a), assigned(&game_b)], [(GAME_A, 1, 2), (GAME_B, 2, 2)]);
        // The lost order is reassigned with a root from the new secret, never the revealed one.
        assert_ne!(game_a.envelope.root, queued[0].envelope.root);
        chain.0.lock().unwrap().commitment += Felt::ONE;
        assert!(Assignments::start(&chain, &path).await.is_err(), "a secret not matching the open epoch was revealed");
    }
}
