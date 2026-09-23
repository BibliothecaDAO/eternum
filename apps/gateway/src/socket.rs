use anyhow::Context;
use futures::{SinkExt, StreamExt};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::tungstenite::Message;

type Reply = oneshot::Sender<anyhow::Result<String>>;

/// One WebSocket to the node carrying Starknet subscriptions. Starknet notifications name their
/// subscription in `params.subscription_id`; the reader registers each subscription before it
/// reads the next frame, so no notification can arrive ahead of its registration.
pub(crate) struct NodeSocket {
    outgoing: mpsc::UnboundedSender<Message>,
    state: Arc<Mutex<Routes>>,
    next_id: AtomicU64,
}

#[derive(Default)]
struct Routes {
    pending: HashMap<u64, (Reply, mpsc::UnboundedSender<Value>)>,
    subscriptions: HashMap<String, mpsc::UnboundedSender<Value>>,
}

/// Notifications for one subscription. The stream ends when the socket closes; dropping it
/// unsubscribes, since the node keeps a subscription open until told otherwise.
pub(crate) struct Notifications<T> {
    receiver: mpsc::UnboundedReceiver<Value>,
    subscription: String,
    outgoing: mpsc::UnboundedSender<Message>,
    _type: std::marker::PhantomData<T>,
}

impl<T> Drop for Notifications<T> {
    fn drop(&mut self) {
        // Id 0 is never pending, so the node's reply is discarded.
        let request = json!({ "jsonrpc": "2.0", "id": 0, "method": "starknet_unsubscribe",
            "params": { "subscription_id": self.subscription } });
        self.outgoing.send(Message::text(request.to_string())).ok();
    }
}

impl<T: DeserializeOwned> Notifications<T> {
    pub async fn next(&mut self) -> Option<anyhow::Result<T>> {
        let value = self.receiver.recv().await?;
        Some(serde_json::from_value(value).context("malformed node notification"))
    }
}

impl NodeSocket {
    pub async fn connect(url: &str) -> anyhow::Result<Self> {
        let (stream, _) = tokio_tungstenite::connect_async(url).await.context("connect the node WebSocket")?;
        let (mut sink, mut source) = stream.split();
        let (outgoing, mut queued) = mpsc::unbounded_channel::<Message>();
        let state = Arc::new(Mutex::new(Routes::default()));
        let (closed, mut reader_done) = oneshot::channel::<()>();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    message = queued.recv() => {
                        let Some(message) = message else { break };
                        if sink.send(message).await.is_err() {
                            break;
                        }
                    }
                    _ = &mut reader_done => break,
                }
            }
        });
        let routes = state.clone();
        tokio::spawn(async move {
            while let Some(Ok(message)) = source.next().await {
                if let Message::Text(text) = message {
                    if let Ok(value) = serde_json::from_str::<Value>(&text) {
                        route(&routes, value);
                    }
                }
            }
            // Dropping every route ends every stream and wakes every pending subscribe.
            let mut routes = routes.lock().expect("socket routes poisoned");
            routes.pending.clear();
            routes.subscriptions.clear();
            closed.send(()).ok();
        });
        Ok(Self { outgoing, state, next_id: AtomicU64::new(1) })
    }

    pub async fn subscribe<T: DeserializeOwned>(
        &self,
        method: &str,
        params: Value,
    ) -> anyhow::Result<Notifications<T>> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (reply, answer) = oneshot::channel();
        let (sender, receiver) = mpsc::unbounded_channel();
        self.state.lock().expect("socket routes poisoned").pending.insert(id, (reply, sender));
        let request = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        self.outgoing.send(Message::text(request.to_string())).context("node WebSocket closed")?;
        let subscription = answer.await.context("node WebSocket closed before the subscription was confirmed")??;
        Ok(Notifications { receiver, subscription, outgoing: self.outgoing.clone(), _type: std::marker::PhantomData })
    }
}

fn route(routes: &Mutex<Routes>, value: Value) {
    let mut routes = routes.lock().expect("socket routes poisoned");
    if let Some(id) = value.get("id").and_then(Value::as_u64) {
        let Some((reply, sender)) = routes.pending.remove(&id) else { return };
        let answer = match (value.get("result"), value.get("error")) {
            (Some(result), _) => match subscription_id(result) {
                Some(subscription) => {
                    routes.subscriptions.insert(subscription.clone(), sender);
                    Ok(subscription)
                }
                None => Err(anyhow::anyhow!("node returned a malformed subscription id")),
            },
            (_, error) => Err(anyhow::anyhow!("node refused the subscription: {}", error.unwrap_or(&Value::Null))),
        };
        reply.send(answer).ok();
    } else if let Some(params) = value.get("params") {
        let Some(subscription) = params.get("subscription_id").and_then(subscription_id) else { return };
        if let (Some(sender), Some(result)) = (routes.subscriptions.get(&subscription), params.get("result")) {
            if sender.send(result.clone()).is_err() {
                routes.subscriptions.remove(&subscription);
            }
        }
    }
}

fn subscription_id(value: &Value) -> Option<String> {
    match value {
        Value::String(id) => Some(id.clone()),
        Value::Number(id) => Some(id.to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notifications_follow_their_subscription_id_and_ignore_strangers() {
        let routes = Mutex::new(Routes::default());
        let (reply, mut answer) = oneshot::channel();
        let (sender, mut receiver) = mpsc::unbounded_channel();
        routes.lock().unwrap().pending.insert(1, (reply, sender));
        route(&routes, json!({ "jsonrpc": "2.0", "id": 1, "result": "42" }));
        assert_eq!(answer.try_recv().unwrap().unwrap(), "42");
        let notification = |id: &str, n: u64| {
            json!({ "jsonrpc": "2.0", "method": "starknet_subscriptionNewHeads",
                "params": { "subscription_id": id, "result": { "block_number": n } } })
        };
        route(&routes, notification("42", 7));
        route(&routes, notification("43", 8));
        assert_eq!(receiver.try_recv().unwrap(), json!({ "block_number": 7 }));
        assert!(receiver.try_recv().is_err());
    }
}
