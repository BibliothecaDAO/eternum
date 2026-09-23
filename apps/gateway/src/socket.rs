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

type Reply = oneshot::Sender<anyhow::Result<Subscription>>;

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
/// removes its route and unsubscribes, since the node keeps subscriptions open until told otherwise.
pub(crate) struct Notifications<T> {
    receiver: mpsc::UnboundedReceiver<Value>,
    _subscription: Subscription,
    _type: std::marker::PhantomData<T>,
}

/// Owns the route even while its acknowledgement is waiting in the reply channel.
struct Subscription {
    subscription: String,
    state: Arc<Mutex<Routes>>,
    outgoing: mpsc::UnboundedSender<Message>,
}

impl Drop for Subscription {
    fn drop(&mut self) {
        self.state.lock().expect("socket routes poisoned").subscriptions.remove(&self.subscription);
        // Id 0 is never pending, so the node's reply is discarded.
        let request = json!({ "jsonrpc": "2.0", "id": 0, "method": "starknet_unsubscribe",
            "params": { "subscription_id": self.subscription } });
        self.outgoing.send(Message::text(request.to_string())).ok();
    }
}

/// Cancellation before acknowledgement removes the pending request without waiting for another frame.
struct PendingSubscription<'a> {
    id: u64,
    socket: &'a NodeSocket,
}

impl Drop for PendingSubscription<'_> {
    fn drop(&mut self) {
        self.socket.state.lock().expect("socket routes poisoned").pending.remove(&self.id);
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
        let replies = outgoing.downgrade();
        tokio::spawn(async move {
            while let Some(Ok(message)) = source.next().await {
                if let Message::Text(text) = message {
                    if let Ok(value) = serde_json::from_str::<Value>(&text) {
                        let Some(outgoing) = replies.upgrade() else { break };
                        route(&routes, &outgoing, value);
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
        let _pending = PendingSubscription { id, socket: self };
        self.state.lock().expect("socket routes poisoned").pending.insert(id, (reply, sender));
        let request = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        self.outgoing.send(Message::text(request.to_string())).context("node WebSocket closed")?;
        let subscription = answer.await.context("node WebSocket closed before the subscription was confirmed")??;
        Ok(Notifications { receiver, _subscription: subscription, _type: std::marker::PhantomData })
    }
}

fn route(state: &Arc<Mutex<Routes>>, outgoing: &mpsc::UnboundedSender<Message>, value: Value) {
    if let Some(id) = value.get("id").and_then(Value::as_u64) {
        // Unsubscribe replies use id 0 and never create a subscription.
        if id != 0 {
            acknowledge(state, outgoing, id, value);
        }
    } else if let Some(params) = value.get("params") {
        let Some(subscription) = params.get("subscription_id").and_then(subscription_id) else { return };
        let routes = state.lock().expect("socket routes poisoned");
        if let (Some(sender), Some(result)) = (routes.subscriptions.get(&subscription), params.get("result")) {
            sender.send(result.clone()).ok();
        }
    }
}

fn acknowledge(state: &Arc<Mutex<Routes>>, outgoing: &mpsc::UnboundedSender<Message>, id: u64, value: Value) {
    let pending = state.lock().expect("socket routes poisoned").pending.remove(&id);
    let answer = subscription_result(&value).map(|subscription| Subscription {
        subscription,
        state: state.clone(),
        outgoing: outgoing.clone(),
    });
    if let Some((reply, sender)) = pending {
        if reply.is_closed() {
            return;
        }
        if let Ok(subscription) = &answer {
            state
                .lock()
                .expect("socket routes poisoned")
                .subscriptions
                .insert(subscription.subscription.clone(), sender);
        }
        // A cancelled receiver drops the owner here, or from the reply channel if cancellation follows this send.
        reply.send(answer).ok();
    }
    // With no pending request, dropping a successful answer unsubscribes the late acknowledgement.
}

fn subscription_result(value: &Value) -> anyhow::Result<String> {
    match (value.get("result"), value.get("error")) {
        (Some(result), _) => subscription_id(result).context("node returned a malformed subscription id"),
        (_, error) => anyhow::bail!("node refused the subscription: {}", error.unwrap_or(&Value::Null)),
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

    #[tokio::test]
    async fn cancelling_subscribe_removes_the_pending_route() {
        let (outgoing, mut queued) = mpsc::unbounded_channel();
        let socket =
            NodeSocket { outgoing, state: Arc::new(Mutex::new(Routes::default())), next_id: AtomicU64::new(1) };
        let mut subscribing = Box::pin(socket.subscribe::<Value>("starknet_subscribeNewHeads", json!({})));
        assert!(futures::poll!(&mut subscribing).is_pending());
        queued.try_recv().unwrap();
        assert_eq!(socket.state.lock().unwrap().pending.len(), 1);

        drop(subscribing);

        assert!(socket.state.lock().unwrap().pending.is_empty());
    }

    #[tokio::test]
    async fn a_late_acknowledgement_unsubscribes_a_cancelled_subscription() {
        let (outgoing, mut queued) = mpsc::unbounded_channel();
        let socket =
            NodeSocket { outgoing, state: Arc::new(Mutex::new(Routes::default())), next_id: AtomicU64::new(1) };
        let mut subscribing = Box::pin(socket.subscribe::<Value>("starknet_subscribeNewHeads", json!({})));
        assert!(futures::poll!(&mut subscribing).is_pending());
        queued.try_recv().unwrap();

        drop(subscribing);
        route(&socket.state, &socket.outgoing, json!({ "jsonrpc": "2.0", "id": 1, "result": "42" }));

        assert!(socket.state.lock().unwrap().pending.is_empty());
        assert!(socket.state.lock().unwrap().subscriptions.is_empty());
        let request = queued.try_recv().unwrap();
        let request: Value = serde_json::from_str(request.to_text().unwrap()).unwrap();
        assert_eq!(request["method"], "starknet_unsubscribe");
        assert_eq!(request["params"]["subscription_id"], "42");
        route(&socket.state, &socket.outgoing, json!({ "jsonrpc": "2.0", "id": 0, "result": true }));
        assert!(queued.try_recv().is_err());
    }

    #[tokio::test]
    async fn cancelling_after_acknowledgement_drops_the_undelivered_subscription() {
        let (outgoing, mut queued) = mpsc::unbounded_channel();
        let socket =
            NodeSocket { outgoing, state: Arc::new(Mutex::new(Routes::default())), next_id: AtomicU64::new(1) };
        let mut subscribing = Box::pin(socket.subscribe::<Value>("starknet_subscribeNewHeads", json!({})));
        assert!(futures::poll!(&mut subscribing).is_pending());
        queued.try_recv().unwrap();
        route(&socket.state, &socket.outgoing, json!({ "jsonrpc": "2.0", "id": 1, "result": "42" }));

        drop(subscribing);

        assert!(socket.state.lock().unwrap().subscriptions.is_empty());
        let request = queued.try_recv().unwrap();
        let request: Value = serde_json::from_str(request.to_text().unwrap()).unwrap();
        assert_eq!(request["method"], "starknet_unsubscribe");
        assert_eq!(request["params"]["subscription_id"], "42");
    }

    #[tokio::test]
    async fn dropping_notifications_removes_the_route_without_another_node_frame() {
        let (outgoing, mut queued) = mpsc::unbounded_channel();
        let socket =
            NodeSocket { outgoing, state: Arc::new(Mutex::new(Routes::default())), next_id: AtomicU64::new(1) };
        let (notifications, ()) =
            tokio::join!(socket.subscribe::<Value>("starknet_subscribeNewHeads", json!({})), async {
                let request = queued.recv().await.unwrap();
                let request: Value = serde_json::from_str(request.to_text().unwrap()).unwrap();
                route(
                    &socket.state,
                    &socket.outgoing,
                    json!({ "jsonrpc": "2.0", "id": request["id"], "result": "42" }),
                );
            });
        let notifications = notifications.unwrap();
        assert!(socket.state.lock().unwrap().subscriptions.contains_key("42"));

        drop(notifications);

        assert!(socket.state.lock().unwrap().subscriptions.is_empty());
        let unsubscribe = queued.try_recv().unwrap();
        let unsubscribe: Value = serde_json::from_str(unsubscribe.to_text().unwrap()).unwrap();
        assert_eq!(unsubscribe["method"], "starknet_unsubscribe");
        assert_eq!(unsubscribe["params"]["subscription_id"], "42");
    }

    #[test]
    fn notifications_follow_their_subscription_id_and_ignore_strangers() {
        let routes = Arc::new(Mutex::new(Routes::default()));
        let (outgoing, _queued) = mpsc::unbounded_channel();
        let (reply, mut answer) = oneshot::channel();
        let (sender, mut receiver) = mpsc::unbounded_channel();
        routes.lock().unwrap().pending.insert(1, (reply, sender));
        route(&routes, &outgoing, json!({ "jsonrpc": "2.0", "id": 1, "result": "42" }));
        let subscription = answer.try_recv().unwrap().unwrap();
        assert_eq!(subscription.subscription, "42");
        let notification = |id: &str, n: u64| {
            json!({ "jsonrpc": "2.0", "method": "starknet_subscriptionNewHeads",
                "params": { "subscription_id": id, "result": { "block_number": n } } })
        };
        route(&routes, &outgoing, notification("42", 7));
        route(&routes, &outgoing, notification("43", 8));
        assert_eq!(receiver.try_recv().unwrap(), json!({ "block_number": 7 }));
        assert!(receiver.try_recv().is_err());
    }
}
