use crate::{
    protocol::Intent,
    socket::{NodeSocket, Notifications},
    ticket::{ActionStatus, RecordedTicket},
    transaction::{selector, Invoke},
};
use anyhow::{ensure, Context};
use jsonrpsee::{
    core::{
        client::{ClientT, Error as ClientError},
        params::ArrayParams,
    },
    http_client::{HttpClient, HttpClientBuilder},
    rpc_params,
};
use serde::{de::DeserializeOwned, Deserialize};
use serde_json::{json, Value};
use starknet_types_core::felt::Felt;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::sync::{oneshot, watch};

const TRANSACTION_HASH_NOT_FOUND: i32 = 29;
/// SNIP-6's accepting return value, `'VALID'`.
const VALID: Felt = Felt::from_hex_unchecked("0x56414c4944");
/// Reconnect catch-up searches this many recent blocks; older nonces fail closed.
const RECONNECT_BLOCKS: u64 = 256;
/// Madara's largest `starknet_getEvents` page.
const EVENTS_PAGE: u64 = 1000;
/// A submitted transaction whose status stays silent this long is looked up once; if the node no
/// longer knows it, it was dropped before inclusion.
const QUIET: Duration = Duration::from_secs(5);

pub struct NodeConfig {
    pub rpc_url: String,
    pub ws_url: String,
    pub deployment: Felt,
    pub account: Felt,
    pub key: Felt,
}

/// A stock Madara node reached over JSON-RPC and WebSocket. Nothing here reads node internals.
pub(crate) struct Node {
    http: HttpClient,
    head: watch::Receiver<Head>,
    receipts: Arc<ReceiptWaiters>,
    pub chain: Felt,
    pub deployment: Felt,
    pub account: Felt,
    key: Felt,
    l2_gas: u64,
}

#[derive(Clone, Copy, Default, Deserialize)]
pub(crate) struct Head {
    #[serde(rename = "block_number")]
    pub number: u64,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub(crate) struct Receipt {
    pub transaction_hash: Felt,
    pub execution_status: ExecutionStatus,
    #[serde(default)]
    pub revert_reason: Option<String>,
    pub events: Vec<Event>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum ExecutionStatus {
    Succeeded,
    Reverted,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq)]
pub(crate) struct Event {
    pub from_address: Felt,
    pub keys: Vec<Felt>,
    pub data: Vec<Felt>,
}

pub(crate) enum Execution {
    Included(Box<Receipt>),
    Refused(String),
}

/// Submissions waiting for their receipt from the sequencing account's receipt stream. A waiter is
/// registered before its transaction is sent, so the receipt cannot arrive unclaimed.
#[derive(Default)]
struct ReceiptWaiters(Mutex<HashMap<Felt, oneshot::Sender<Receipt>>>);

impl ReceiptWaiters {
    fn wait_for(self: &Arc<Self>, hash: Felt) -> ReceiptWait {
        let (sender, receiver) = oneshot::channel();
        self.0.lock().expect("receipt waiters poisoned").insert(hash, sender);
        ReceiptWait { hash, receiver, waiters: self.clone() }
    }

    fn deliver(&self, receipt: Receipt) {
        if let Some(waiter) = self.0.lock().expect("receipt waiters poisoned").remove(&receipt.transaction_hash) {
            waiter.send(receipt).ok();
        }
    }
}

struct ReceiptWait {
    hash: Felt,
    receiver: oneshot::Receiver<Receipt>,
    waiters: Arc<ReceiptWaiters>,
}

impl Drop for ReceiptWait {
    fn drop(&mut self) {
        self.waiters.0.lock().expect("receipt waiters poisoned").remove(&self.hash);
    }
}

impl Node {
    pub async fn connect(config: NodeConfig) -> anyhow::Result<Arc<Self>> {
        let http = HttpClientBuilder::default().build(&config.rpc_url).context("node RPC URL")?;
        let chain: Felt = http.request("starknet_chainId", rpc_params![]).await.context("read the node chain id")?;
        let latest: Head = http.request("starknet_getBlockWithTxHashes", rpc_params!["latest"]).await?;
        let (sender, head) = watch::channel(latest);
        tokio::spawn(follow_heads(config.ws_url.clone(), sender));
        let receipts = Arc::new(ReceiptWaiters::default());
        tokio::spawn(follow_receipts(config.ws_url, config.account, Arc::downgrade(&receipts)));
        Ok(Arc::new(Self {
            http,
            head,
            receipts,
            chain,
            deployment: config.deployment,
            account: config.account,
            key: config.key,
            l2_gas: 1_200_000_000,
        }))
    }

    async fn request<T: DeserializeOwned>(&self, method: &str, params: ArrayParams) -> anyhow::Result<T> {
        self.http.request(method, params).await.with_context(|| format!("node {method}"))
    }

    /// A view on the freshest state the node has, including its pre-confirmed block.
    pub async fn call(&self, contract: Felt, entrypoint: &str, args: Vec<Felt>) -> anyhow::Result<Vec<Felt>> {
        let call =
            json!({ "contract_address": contract, "entry_point_selector": selector(entrypoint), "calldata": args });
        self.request("starknet_call", rpc_params![call, "pre_confirmed"]).await
    }

    /// SNIP-6 on the actor: the account decides which device keys sign for it.
    pub async fn signed_by(&self, actor: Felt, action: Felt, signature: &[Felt]) -> anyhow::Result<bool> {
        let mut args = vec![action, Felt::from(signature.len() as u64)];
        args.extend(signature);
        Ok(self.call(actor, "is_valid_signature", args).await? == [VALID])
    }

    pub async fn is_deployed(&self, contract: Felt) -> anyhow::Result<bool> {
        match self.http.request::<Felt, _>("starknet_getClassHashAt", rpc_params!["pre_confirmed", contract]).await {
            Ok(_) => Ok(true),
            Err(ClientError::Call(error)) if error.code() == 20 => Ok(false),
            Err(error) => Err(error).context("node starknet_getClassHashAt"),
        }
    }

    pub fn head(&self) -> Head {
        *self.head.borrow()
    }

    pub async fn wait_for_new_head(&self) {
        let mut head = self.head.clone();
        head.borrow_and_update();
        tokio::time::timeout(Duration::from_secs(5), head.changed()).await.ok();
    }

    /// Signs one account call at the account's next nonce, including pre-confirmed transactions.
    pub async fn prepare(&self, to: Felt, entrypoint: &str, payload: Vec<Felt>) -> anyhow::Result<(Felt, Value)> {
        let nonce: Felt = self.request("starknet_getNonce", rpc_params!["pre_confirmed", self.account]).await?;
        Invoke::single_call(self.account, nonce, to, entrypoint, payload, self.l2_gas).signed(self.chain, self.key)
    }

    pub async fn receipt(&self, hash: Felt) -> anyhow::Result<Option<Receipt>> {
        match self.http.request("starknet_getTransactionReceipt", rpc_params![hash]).await {
            Ok(receipt) => Ok(Some(receipt)),
            Err(ClientError::Call(error)) if error.code() == TRANSACTION_HASH_NOT_FOUND => Ok(None),
            Err(error) => Err(error).context("node starknet_getTransactionReceipt"),
        }
    }

    async fn known(&self, hash: Felt) -> anyhow::Result<bool> {
        match self.http.request::<Value, _>("starknet_getTransactionStatus", rpc_params![hash]).await {
            Ok(_) => Ok(true),
            Err(ClientError::Call(error)) if error.code() == TRANSACTION_HASH_NOT_FOUND => Ok(false),
            Err(error) => Err(error).context("node starknet_getTransactionStatus"),
        }
    }

    /// Stock Madara drops a transaction its executor refuses without a receipt. Simulating the same
    /// transaction recovers the executor's reason; a clean simulation means the drop was transient.
    async fn refusal_reason(&self, transaction: &Value) -> String {
        let simulated = self
            .http
            .request::<Value, _>(
                "starknet_simulateTransactions",
                rpc_params!["pre_confirmed", [transaction], [] as [&str; 0]],
            )
            .await;
        match simulated {
            Err(ClientError::Call(error)) => {
                format!("{} {}", error.message(), error.data().map(|d| d.get()).unwrap_or(""))
            }
            Err(error) => format!("simulation unavailable: {error}"),
            Ok(_) => "dropped before inclusion; simulation succeeds".into(),
        }
    }

    /// The receipt arrives from the account's pre-confirmed receipt stream. Only a failed send or a
    /// silent stream asks the node directly: a retry of a transaction the node already holds, or a
    /// stream that dropped while reconnecting.
    pub async fn execute(&self, hash: Felt, transaction: Value) -> anyhow::Result<Execution> {
        let mut wait = self.receipts.wait_for(hash);
        let submitted: anyhow::Result<Value> =
            self.request("starknet_addInvokeTransaction", rpc_params![transaction.clone()]).await;
        match submitted {
            Ok(accepted) => ensure!(
                accepted["transaction_hash"].as_str().and_then(|hash| Felt::from_hex(hash).ok()) == Some(hash),
                "node accepted a different transaction hash"
            ),
            Err(error) => {
                if let Some(receipt) = self.receipt(hash).await? {
                    return Ok(Execution::Included(Box::new(receipt)));
                }
                if !self.known(hash).await? {
                    return Err(error);
                }
            }
        }
        loop {
            match tokio::time::timeout(QUIET, &mut wait.receiver).await {
                Ok(Ok(receipt)) => return Ok(Execution::Included(Box::new(receipt))),
                Ok(Err(_)) => anyhow::bail!("node receipt stream closed"),
                Err(_) => {
                    if let Some(receipt) = self.receipt(hash).await? {
                        return Ok(Execution::Included(Box::new(receipt)));
                    }
                    if !self.known(hash).await? {
                        return Ok(Execution::Refused(self.refusal_reason(&transaction).await));
                    }
                }
            }
        }
    }

    /// Reconnect catch-up reads recorded chain data, never a ticket database: the event that
    /// consumed this actor's nonce, then the transaction that carried it.
    pub async fn recorded_action(&self, intent: &Intent) -> anyhow::Result<Option<ActionStatus>> {
        let from = self.head().number.saturating_sub(RECONNECT_BLOCKS);
        let keys = [[selector("RecordingEvent")], [selector("ExecutionRecorded")]];
        let mut continuation: Option<String> = None;
        loop {
            let mut filter = json!({
                "from_block": { "block_number": from },
                "to_block": "pre_confirmed",
                "address": intent.deployment,
                "keys": keys,
                "chunk_size": EVENTS_PAGE,
            });
            if let Some(token) = &continuation {
                filter["continuation_token"] = json!(token);
            }
            let page: EventsPage = self.request("starknet_getEvents", rpc_params![filter]).await?;
            for event in page.events {
                if let [game, actor, nonce, consumed, ..] = event.data.as_slice() {
                    if (*game, *actor, *nonce, *consumed) == (intent.game, intent.actor, intent.nonce.into(), Felt::ONE)
                    {
                        return self.recorded_in(event.transaction_hash, intent).await;
                    }
                }
            }
            match page.continuation_token {
                Some(token) => continuation = Some(token),
                None => return Ok(None),
            }
        }
    }

    async fn recorded_in(&self, hash: Felt, intent: &Intent) -> anyhow::Result<Option<ActionStatus>> {
        let transaction: CarriedTransaction = self.request("starknet_getTransactionByHash", rpc_params![hash]).await?;
        let receipt = self.receipt(hash).await?.context("recorded transaction has no receipt")?;
        recorded_intent(&transaction.calldata, &receipt, intent)
    }
}

#[derive(Deserialize)]
struct EventsPage {
    events: Vec<EmittedEvent>,
    #[serde(default)]
    continuation_token: Option<String>,
}

#[derive(Deserialize)]
struct EmittedEvent {
    transaction_hash: Felt,
    data: Vec<Felt>,
}

#[derive(Deserialize)]
struct CarriedTransaction {
    calldata: Vec<Felt>,
}

/// Keeps the latest confirmed head: the admission clock and the signal that chain state moved.
/// Delivers each pre-confirmed receipt of the sequencing account's transactions to its waiter, for as
/// long as the node lives.
async fn follow_receipts(url: String, account: Felt, waiters: std::sync::Weak<ReceiptWaiters>) {
    let filter = json!({ "finality_status": ["PRE_CONFIRMED"], "sender_address": [account] });
    loop {
        let followed = async {
            let socket = NodeSocket::connect(&url).await?;
            let mut receipts: Notifications<Receipt> =
                socket.subscribe("starknet_subscribeNewTransactionReceipts", filter.clone()).await?;
            while let Some(receipt) = receipts.next().await {
                let Some(waiters) = waiters.upgrade() else { return anyhow::Ok(()) };
                waiters.deliver(receipt?);
            }
            anyhow::Ok(())
        };
        if let Err(error) = followed.await {
            tracing::warn!(target: "gateway", %error, "receipt subscription lost; reconnecting");
        }
        if waiters.strong_count() == 0 {
            return;
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

async fn follow_heads(url: String, sender: watch::Sender<Head>) {
    loop {
        let followed = async {
            let socket = NodeSocket::connect(&url).await?;
            let mut heads: Notifications<Head> = socket.subscribe("starknet_subscribeNewHeads", json!({})).await?;
            while let Some(head) = heads.next().await {
                sender.send_replace(head?);
            }
            anyhow::Ok(())
        };
        if let Err(error) = followed.await {
            tracing::warn!(target: "gateway", %error, "new-head subscription lost; reconnecting");
        }
        if sender.is_closed() {
            return;
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

/// The recorded outcome of `intent` inside the transaction that carried it, if it is there.
pub(crate) fn recorded_intent(
    calldata: &[Felt],
    receipt: &Receipt,
    intent: &Intent,
) -> anyhow::Result<Option<ActionStatus>> {
    let [count, target, entrypoint, length, payload @ ..] = calldata else { return Ok(None) };
    if *count != Felt::ONE || *target != intent.deployment || usize::try_from(*length)? != payload.len() {
        return Ok(None);
    }
    let mut fields = payload;
    let count = if *entrypoint == selector("execute_batch") {
        let Some((count, rest)) = fields.split_first() else { anyhow::bail!("truncated recorded batch") };
        fields = rest;
        usize::try_from(*count)?
    } else if *entrypoint == selector("execute") || *entrypoint == selector("reject_execution") {
        1
    } else {
        return Ok(None);
    };
    ensure!(count > 0 && count <= 64, "invalid recorded batch size");
    let tickets = (0..count).map(|_| RecordedTicket::take_calldata(&mut fields)).collect::<anyhow::Result<Vec<_>>>()?;
    ensure!(fields.is_empty(), "trailing recorded transaction data");
    if !tickets.iter().any(|ticket| ticket.intent == *intent) {
        return Ok(None);
    }
    let outcomes = crate::execution::receipt_outcomes(tickets.iter(), receipt.transaction_hash, receipt)?;
    Ok(outcomes.into_iter().zip(tickets).find_map(|(outcome, ticket)| (ticket.intent == *intent).then_some(outcome)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::Envelope;

    #[test]
    fn restart_reconciliation_attributes_the_matching_intent_inside_a_batch() {
        let intent = Intent {
            chain: Felt::ONE,
            deployment: Felt::TWO,
            game: Felt::from(9),
            actor: Felt::from(55),
            nonce: 3,
            command: Felt::ONE,
            rules: Felt::ONE,
            valid_from: 0,
            valid_until: 500,
            last_order: 100,
            arguments: vec![Felt::from(7)],
        };
        let first = RecordedTicket {
            envelope: Envelope {
                action: intent.identity().unwrap(),
                order: 7,
                timestamp: 10,
                execution_config: Felt::ONE,
                epoch: 1,
                root: [123; 32],
            },
            intent: intent.clone(),
            signature: vec![Felt::ONE, Felt::TWO],
        };
        // Another game at the same order: attribution follows the intent, never the order alone.
        let mut second = first.clone();
        second.intent.game = Felt::from(10);
        second.envelope.action = second.intent.identity().unwrap();
        let mut payload = vec![Felt::TWO];
        payload.extend(first.calldata().unwrap());
        payload.extend(second.calldata().unwrap());
        let mut calldata =
            vec![Felt::ONE, intent.deployment, selector("execute_batch"), Felt::from(payload.len() as u64)];
        calldata.extend(payload);
        let receipt = Receipt {
            transaction_hash: Felt::from(99),
            execution_status: ExecutionStatus::Succeeded,
            revert_reason: None,
            events: [&first, &second]
                .iter()
                .map(|ticket| Event {
                    from_address: intent.deployment,
                    keys: vec![selector("RecordingEvent"), selector("ExecutionRecorded")],
                    data: vec![
                        ticket.intent.game,
                        ticket.intent.actor,
                        ticket.intent.nonce.into(),
                        Felt::ONE,
                        ticket.envelope.order.into(),
                        Felt::ONE,
                        Felt::ZERO,
                    ],
                })
                .collect(),
        };
        assert!(
            matches!(recorded_intent(&calldata, &receipt, &intent).unwrap(), Some(ActionStatus::Recorded { order: 7, transaction_hash, succeeded: true, .. }) if transaction_hash == Felt::from(99))
        );
        assert!(matches!(
            recorded_intent(&calldata, &receipt, &second.intent).unwrap(),
            Some(ActionStatus::Recorded { order: 7, action, .. }) if action == second.envelope.action
        ));
        let mut different = intent.clone();
        different.arguments[0] += Felt::ONE;
        assert!(recorded_intent(&calldata, &receipt, &different).unwrap().is_none());
        calldata.pop();
        assert!(recorded_intent(&calldata, &receipt, &intent).unwrap().is_none());
    }
}
