use crate::{
    admission::{AdmissionSlots, IpLimits, Permit, Slot},
    epoch::EpochSecret,
    execution::{self, PendingTicket},
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

const MAX_BATCH: usize = 16;
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

struct Shared {
    node: Arc<Node>,
    slots: AdmissionSlots,
    sender: Mutex<Option<mpsc::Sender<Request>>>,
    ip_limits: Mutex<IpLimits>,
}

#[derive(Clone)]
pub struct GameApi(Arc<Shared>);

impl GameApi {
    pub(crate) fn new(node: Arc<Node>, slots: AdmissionSlots) -> Self {
        Self(Arc::new(Shared { node, slots, sender: Mutex::new(None), ip_limits: Mutex::new(IpLimits::default()) }))
    }

    async fn admit(&self, peer: IpAddr, action: ActionRequest) -> anyhow::Result<watch::Receiver<ActionStatus>> {
        ensure!(
            self.0.ip_limits.lock().expect("admission limiter poisoned").allow(peer, Instant::now()),
            "request rate exceeded"
        );
        let node = &self.0.node;
        let intent = action.decode(node.chain, node.deployment)?;
        let digest = intent.identity()?;
        // get_admission refuses an actor that does not run the shard's account class.
        let fields = node.call(node.deployment, "get_admission", vec![intent.game, intent.actor]).await?;
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

async fn run(api: GameApi, path: &Path) -> anyhow::Result<()> {
    let node = api.0.node.clone();
    while !node.is_deployed(node.deployment).await? || !node.is_deployed(node.account).await? {
        node.wait_for_new_head().await;
    }
    // Account transactions execute in nonce order, so the start-up epoch commands land only after
    // every transaction the node retained from a previous run has executed or been dropped.
    let mut assignments = Assignments::start(node.as_ref(), path).await?;
    // Each queued request holds a slot, so a channel of the slot bound never refuses one as full.
    let (sender, mut requests) = mpsc::channel(api.0.slots.bound());
    *api.0.sender.lock().expect("admission sender poisoned") = Some(sender);
    tracing::info!(target: "gateway", epoch = assignments.epoch.epoch, "admission open");
    let mut queue = Vec::new();
    let mut flight: Option<BoxFuture<'static, anyhow::Result<()>>> = None;
    let mut deadline = tokio::time::Instant::now() + PACK_DELAY;
    loop {
        if flight.is_none()
            && !queue.is_empty()
            && (queue.len() >= MAX_BATCH || tokio::time::Instant::now() >= deadline)
        {
            flight = Some(execution::execute(node.clone(), std::mem::take(&mut queue)).boxed());
        }
        if flight.is_none() && queue.is_empty() && assignments.rotation_due() {
            assignments.rotate(node.as_ref(), path).await?;
        }
        tokio::select! {
            request = requests.recv(), if queue.len() < MAX_BATCH && !assignments.rotation_due() => {
                let request = request.context("game request queue closed")?;
                let action = request.intent.identity()?;
                match assignments.assign(node.as_ref(), &request).await {
                    Ok(record) => {
                        let (game, order) = (record.intent.game, record.envelope.order);
                        request.permit.resolve(ActionStatus::Accepted { action, order });
                        tracing::debug!(target: "gateway", %action, %game, order,
                            admission_ms = request.received.elapsed().as_secs_f64() * 1000.0, "game_action_accepted");
                        if queue.is_empty() { deadline = tokio::time::Instant::now() + PACK_DELAY; }
                        queue.push(PendingTicket { record, permit: request.permit });
                    }
                    Err(error) => request.permit.resolve(ActionStatus::Refused { action, reason: format!("{error:#}") }),
                }
            }
            result = async { flight.as_mut().expect("flight branch enabled").await }, if flight.is_some() => {
                result?;
                flight = None;
            }
            _ = tokio::time::sleep_until(deadline), if flight.is_none() && !queue.is_empty() => {}
        }
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
        let (hash, transaction) = self.prepare(self.account, name, payload).await?;
        match self.execute(hash, transaction).await? {
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
            node.account_command("reveal_randomness_epoch", secret.reveal().to_vec()).await?;
        }
    }
    let secret = EpochSecret::create(id + 1)?;
    secret.save(path)?;
    node.account_command("open_randomness_epoch", vec![secret.commitment()]).await?;
    Ok(secret)
}

#[cfg(test)]
mod tests {
    use super::*;

    const RULES: Felt = Felt::from_hex_unchecked("0x7");
    const GAME_A: Felt = Felt::ONE;
    const GAME_B: Felt = Felt::TWO;

    #[derive(Default)]
    struct Chain {
        heads: HashMap<Felt, u64>,
        epoch: u64,
        commitment: Felt,
        revealed: bool,
        commands: Vec<(&'static str, Vec<Felt>)>,
    }
    #[derive(Default)]
    struct TestChain(Mutex<Chain>);

    #[async_trait::async_trait]
    impl AssignmentNode for TestChain {
        async fn admission(&self, game: Felt, _: Felt) -> anyhow::Result<Vec<Felt>> {
            let next = self.0.lock().unwrap().heads.get(&game).copied().unwrap_or_default() + 1;
            Ok(vec![RULES, Felt::ONE, Felt::ZERO, next.into(), Felt::from(100)])
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
