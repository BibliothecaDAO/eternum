use crate::ticket::ActionStatus;
use starknet_types_core::felt::Felt;
use std::{
    collections::HashMap,
    net::IpAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::watch;

type Decision = ActionStatus;
type Players = Arc<Mutex<Admissions>>;
#[derive(Default)]
struct Admissions {
    pending: HashMap<Felt, Pending>,
}

struct Pending {
    action: Felt,
    decision: watch::Sender<Decision>,
}

#[derive(Default, Clone)]
pub(crate) struct AdmissionSlots(Players);

pub(crate) enum Slot {
    New(Permit),
    Existing(watch::Receiver<Decision>),
}

pub(crate) struct Permit {
    players: Players,
    actor: Felt,
    decision: watch::Sender<Decision>,
}

impl AdmissionSlots {
    pub fn reserve(&self, actor: Felt, action: Felt) -> Result<Slot, String> {
        let mut players = self.0.lock().expect("admission slots poisoned");
        if let Some(pending) = players.pending.get(&actor) {
            return if pending.action == action {
                Ok(Slot::Existing(pending.decision.subscribe()))
            } else {
                Err("player already has a pending action".into())
            };
        }
        let (decision, _) = watch::channel(ActionStatus::Queued { action });
        players.pending.insert(actor, Pending { action, decision: decision.clone() });
        Ok(Slot::New(Permit { players: self.0.clone(), actor, decision }))
    }
}

impl Permit {
    pub fn subscribe(&self) -> watch::Receiver<Decision> {
        self.decision.subscribe()
    }
    pub fn resolve(&self, decision: ActionStatus) {
        self.decision.send_replace(decision);
    }
}

impl Drop for Permit {
    fn drop(&mut self) {
        self.players.lock().expect("admission slots poisoned").pending.remove(&self.actor);
    }
}

// A shared IP can host a full 96-player lobby. Two requests per action at four ticks
// per second fit this cap; actor slots prevent one player from occupying the queue.
pub(crate) struct IpLimits {
    window: Instant,
    requests: HashMap<IpAddr, u16>,
}
impl Default for IpLimits {
    fn default() -> Self {
        Self { window: Instant::now(), requests: HashMap::new() }
    }
}
impl IpLimits {
    pub fn allow(&mut self, ip: IpAddr, now: Instant) -> bool {
        if now.duration_since(self.window) >= Duration::from_secs(1) {
            self.requests.clear();
            self.window = now;
        }
        if self.requests.len() >= 4096 && !self.requests.contains_key(&ip) {
            return false;
        }
        let count = self.requests.entry(ip).or_default();
        if *count >= 1024 {
            return false;
        }
        *count += 1;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn a_flooding_actor_uses_one_slot_and_duplicates_observe_the_same_ticket() {
        let slots = AdmissionSlots::default();
        let Slot::New(first) = slots.reserve(Felt::ONE, Felt::from(10)).unwrap() else { panic!("new actor") };
        for _ in 0..1000 {
            assert!(slots.reserve(Felt::ONE, Felt::from(11)).is_err());
        }
        let Slot::Existing(duplicate) = slots.reserve(Felt::ONE, Felt::from(10)).unwrap() else { panic!("duplicate") };
        let Slot::New(other) = slots.reserve(Felt::TWO, Felt::from(12)).unwrap() else {
            panic!("other player blocked")
        };
        first.resolve(ActionStatus::Accepted { action: Felt::from(10), order: 1 });
        assert_eq!(*duplicate.borrow(), ActionStatus::Accepted { action: Felt::from(10), order: 1 });
        drop(first);
        assert!(matches!(slots.reserve(Felt::ONE, Felt::from(11)), Ok(Slot::New(_))));
        drop(other);
    }
    #[tokio::test]
    async fn failed_queue_send_releases_the_actor_and_wakes_waiters() {
        let slots = AdmissionSlots::default();
        let Slot::New(permit) = slots.reserve(Felt::ONE, Felt::TWO).unwrap() else { panic!("new actor") };
        let mut waiting = permit.subscribe();
        drop(permit);
        assert!(waiting.changed().await.is_err());
        assert!(matches!(slots.reserve(Felt::ONE, Felt::from(3)), Ok(Slot::New(_))));
    }
    #[test]
    fn ip_limits_bound_abuse_without_sharing_a_budget_between_addresses() {
        let mut limits = IpLimits::default();
        let now = limits.window;
        let first = "127.0.0.1".parse().unwrap();
        for _ in 0..1024 {
            assert!(limits.allow(first, now));
        }
        assert!(!limits.allow(first, now));
        assert!(limits.allow("127.0.0.2".parse().unwrap(), now));
        assert!(limits.allow(first, now + Duration::from_secs(1)));
    }
}
