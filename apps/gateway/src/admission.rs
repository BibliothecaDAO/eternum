use crate::ticket::ActionStatus;
use starknet_types_core::felt::Felt;
use std::{
    collections::{HashMap, VecDeque},
    net::{IpAddr, Ipv6Addr},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::watch;

type Decision = ActionStatus;
type Players = Arc<Mutex<Admissions>>;
/// An actor's nonce is per game, so each (game, actor) pair holds at most one pending ticket.
type Key = (Felt, Felt);

/// The launch service awaits each administrative command's outcome before sending the next, so
/// its largest burst is one ticket; the rest leaves room for operator commands on other games.
pub(crate) const AUTHORITY_ALLOWANCE: usize = 4;

struct Admissions {
    pending: HashMap<Key, Pending>,
    authority: Felt,
    players: Pool,
    authority_work: Pool,
}

/// Tickets held against one limit, from admission until their outcome is recorded.
struct Pool {
    held: usize,
    limit: usize,
}

struct Pending {
    action: Felt,
    decision: watch::Sender<Decision>,
}

impl Admissions {
    fn pool(&mut self, actor: Felt) -> &mut Pool {
        if actor == self.authority {
            &mut self.authority_work
        } else {
            &mut self.players
        }
    }
}

/// Players share the shard's player capacity; the authority's work has its own allowance that
/// player tickets cannot consume, so a full shard still settles and records its games.
#[derive(Clone)]
pub(crate) struct AdmissionSlots(Players);

pub(crate) enum Slot {
    New(Permit),
    Existing(watch::Receiver<Decision>),
}

pub(crate) struct Permit {
    players: Players,
    key: Key,
    decision: watch::Sender<Decision>,
}

impl AdmissionSlots {
    pub fn new(player_capacity: usize, authority: Felt) -> Self {
        Self(Arc::new(Mutex::new(Admissions {
            pending: HashMap::new(),
            authority,
            players: Pool { held: 0, limit: player_capacity },
            authority_work: Pool { held: 0, limit: AUTHORITY_ALLOWANCE },
        })))
    }

    /// Every ticket the shard can hold at once; nothing queued beyond it can be refused as full.
    pub fn bound(&self) -> usize {
        let admissions = self.0.lock().expect("admission slots poisoned");
        admissions.players.limit + admissions.authority_work.limit
    }

    /// The operator whose administrative work has its own allowance.
    pub fn authority(&self) -> Felt {
        self.0.lock().expect("admission slots poisoned").authority
    }

    /// Tickets admitted and not yet recorded.
    pub fn held(&self) -> usize {
        let admissions = self.0.lock().expect("admission slots poisoned");
        admissions.players.held + admissions.authority_work.held
    }

    /// A retry of a pending ticket reuses it and holds nothing more.
    pub fn reserve(&self, game: Felt, actor: Felt, action: Felt) -> Result<Slot, String> {
        let mut admissions = self.0.lock().expect("admission slots poisoned");
        if let Some(pending) = admissions.pending.get(&(game, actor)) {
            return if pending.action == action {
                Ok(Slot::Existing(pending.decision.subscribe()))
            } else {
                Err("player already has a pending action".into())
            };
        }
        let pool = admissions.pool(actor);
        if pool.held >= pool.limit {
            return Err("the shard is at its admission capacity".into());
        }
        pool.held += 1;
        let (decision, _) = watch::channel(ActionStatus::Queued { action });
        admissions.pending.insert((game, actor), Pending { action, decision: decision.clone() });
        Ok(Slot::New(Permit { players: self.0.clone(), key: (game, actor), decision }))
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
        let mut admissions = self.players.lock().expect("admission slots poisoned");
        admissions.pending.remove(&self.key);
        admissions.pool(self.key.1).held -= 1;
    }
}

// A shared IP can host a full 96-player lobby. Two requests per action at four ticks per second fit this budget;
// actor slots prevent one player from occupying the queue.
const REQUESTS_PER_CLIENT: u16 = 1024;
/// Clients the limiter remembers in one window. A new client is never refused for lack of room: the client seen longest
/// ago is forgotten instead, which only restarts that client's count.
const TRACKED_CLIENTS: usize = 4096;

/// Requests per client per second. A client is an IPv4 address, or an IPv6 /64, because one IPv6 host can rotate
/// through its whole /64.
pub(crate) struct IpLimits {
    window: Instant,
    requests: HashMap<IpAddr, u16>,
    /// This window's clients in the order they first arrived; the front is forgotten first.
    arrivals: VecDeque<IpAddr>,
}
impl Default for IpLimits {
    fn default() -> Self {
        Self { window: Instant::now(), requests: HashMap::new(), arrivals: VecDeque::new() }
    }
}
impl IpLimits {
    pub fn allow(&mut self, ip: IpAddr, now: Instant) -> bool {
        if now.duration_since(self.window) >= Duration::from_secs(1) {
            self.requests.clear();
            self.arrivals.clear();
            self.window = now;
        }
        let client = client_of(ip);
        if !self.requests.contains_key(&client) {
            if self.requests.len() >= TRACKED_CLIENTS {
                if let Some(oldest) = self.arrivals.pop_front() {
                    self.requests.remove(&oldest);
                }
            }
            self.arrivals.push_back(client);
        }
        let count = self.requests.entry(client).or_default();
        if *count >= REQUESTS_PER_CLIENT {
            return false;
        }
        *count += 1;
        true
    }
}

/// The client an address counts against: an IPv4 address, including one mapped into IPv6, or an IPv6 address's /64.
fn client_of(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V4(_) => ip,
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => IpAddr::V6(Ipv6Addr::from(u128::from(v6) & !((1u128 << 64) - 1))),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const GAME: Felt = Felt::ONE;
    #[test]
    fn a_flooding_actor_uses_one_slot_and_duplicates_observe_the_same_ticket() {
        let slots = AdmissionSlots::new(96, Felt::ZERO);
        let Slot::New(first) = slots.reserve(GAME, Felt::ONE, Felt::from(10)).unwrap() else { panic!("new actor") };
        for _ in 0..1000 {
            assert!(slots.reserve(GAME, Felt::ONE, Felt::from(11)).is_err());
        }
        let Slot::Existing(duplicate) = slots.reserve(GAME, Felt::ONE, Felt::from(10)).unwrap() else {
            panic!("duplicate")
        };
        let Slot::New(other) = slots.reserve(GAME, Felt::TWO, Felt::from(12)).unwrap() else {
            panic!("other player blocked")
        };
        first.resolve(ActionStatus::Accepted { action: Felt::from(10), order: 1 });
        assert_eq!(*duplicate.borrow(), ActionStatus::Accepted { action: Felt::from(10), order: 1 });
        drop(first);
        assert!(matches!(slots.reserve(GAME, Felt::ONE, Felt::from(11)), Ok(Slot::New(_))));
        drop(other);
    }

    #[test]
    fn a_full_shard_admits_every_player_while_the_authority_settles_its_games() {
        let authority = Felt::from(7);
        let slots = AdmissionSlots::new(96, authority);
        let settlements: Vec<_> = (1..=2u64)
            .map(|game| slots.reserve(Felt::from(game), authority, Felt::from(1000 + game)).unwrap())
            .collect();
        let players: Vec<_> = (0..96u64)
            .map(|player| {
                let Slot::New(permit) = slots
                    .reserve(Felt::from(player % 4 + 1), Felt::from(100 + player), Felt::from(player))
                    .expect("a player of a full shard was refused")
                else {
                    panic!("new player")
                };
                permit
            })
            .collect();
        assert!(
            matches!(slots.reserve(GAME, Felt::from(100), Felt::ZERO), Ok(Slot::Existing(_))),
            "a retry adds nothing"
        );
        assert!(slots.reserve(GAME, Felt::from(999), Felt::from(5)).is_err(), "a player beyond capacity");
        assert!(
            slots.reserve(Felt::from(3), authority, Felt::from(1003)).is_ok(),
            "players consumed the authority's allowance"
        );
        assert_eq!(slots.bound(), 96 + AUTHORITY_ALLOWANCE);
        drop(players);
        drop(settlements);
        assert!(matches!(slots.reserve(GAME, Felt::from(999), Felt::from(5)), Ok(Slot::New(_))));
    }
    #[tokio::test]
    async fn failed_queue_send_releases_the_actor_and_wakes_waiters() {
        let slots = AdmissionSlots::new(1, Felt::ZERO);
        let Slot::New(permit) = slots.reserve(GAME, Felt::ONE, Felt::TWO).unwrap() else { panic!("new actor") };
        let mut waiting = permit.subscribe();
        drop(permit);
        assert!(waiting.changed().await.is_err());
        assert!(matches!(slots.reserve(GAME, Felt::ONE, Felt::from(3)), Ok(Slot::New(_))));
    }
    #[test]
    fn a_new_client_is_admitted_however_many_others_arrived_this_second() {
        let mut limits = IpLimits::default();
        let now = limits.window;
        let first: IpAddr = "10.0.0.1".parse().unwrap();
        for _ in 0..REQUESTS_PER_CLIENT {
            assert!(limits.allow(first, now));
        }
        for client in 0..(TRACKED_CLIENTS as u32 + 1_000) {
            let address = IpAddr::V4(std::net::Ipv4Addr::from(0x0b00_0000 + client));
            assert!(limits.allow(address, now), "client {address} refused because others were seen");
        }
        assert!(limits.requests.len() <= TRACKED_CLIENTS);
        let late: IpAddr = "12.0.0.1".parse().unwrap();
        assert!(limits.allow(late, now));
    }

    #[test]
    fn one_ipv6_host_shares_its_slash_64_budget() {
        let mut limits = IpLimits::default();
        let now = limits.window;
        for host in 0..u128::from(REQUESTS_PER_CLIENT) {
            let address = IpAddr::V6(Ipv6Addr::from((0x2001_0db8_0000_0001u128 << 64) + host));
            assert!(limits.allow(address, now));
        }
        let rotated = IpAddr::V6(Ipv6Addr::from((0x2001_0db8_0000_0001u128 << 64) + 0xffff));
        assert!(!limits.allow(rotated, now));
        let neighbour = IpAddr::V6(Ipv6Addr::from(0x2001_0db8_0000_0002u128 << 64));
        assert!(limits.allow(neighbour, now));
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
