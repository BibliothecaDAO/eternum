//! Admission counters and sequencing histograms on the existing metrics listener, in Prometheus
//! text format for the shard's collector. No label names a player or a transaction.

use crate::timing::Stage;
use std::{
    fmt::Write,
    sync::atomic::{AtomicU64, Ordering::Relaxed},
    time::Duration,
};

/// Upper bounds of the queue-wait histogram, in seconds.
const WAIT_BOUNDS: [f64; 12] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0];

pub(crate) struct Metrics {
    accepted: AtomicU64,
    executed_tickets: AtomicU64,
    ticket_transactions: AtomicU64,
    queue_wait: Histogram<12>,
    stages: [Histogram<12>; Stage::ALL.len()],
    packs: Histogram<6>,
    flights: Histogram<12>,
}

pub(crate) static METRICS: Metrics = Metrics {
    accepted: AtomicU64::new(0),
    executed_tickets: AtomicU64::new(0),
    ticket_transactions: AtomicU64::new(0),
    queue_wait: Histogram::new(),
    stages: [const { Histogram::new() }; Stage::ALL.len()],
    packs: Histogram::new(),
    flights: Histogram::new(),
};

impl Metrics {
    /// A ticket took its order in its game.
    pub fn accepted(&self) {
        self.accepted.fetch_add(1, Relaxed);
    }

    /// A ticket left the queue in a submitted batch this long after the gateway received it.
    pub fn left_queue_after(&self, wait: Duration) {
        self.queue_wait.observe(wait.as_secs_f64(), &WAIT_BOUNDS);
    }

    /// One included batch transaction carried this many tickets.
    pub fn executed(&self, tickets: usize) {
        self.executed_tickets.fetch_add(tickets as u64, Relaxed);
        self.ticket_transactions.fetch_add(1, Relaxed);
    }

    /// Tickets per transaction is executed tickets over ticket transactions; accepted tickets per
    /// second is the rate of the accepted counter.
    pub fn render(&self, queue_depth: usize) -> String {
        let mut text = String::new();
        let mut line = |kind: &str, name: &str, value: String| {
            writeln!(text, "# TYPE {name} {kind}\n{name} {value}").expect("writing to a string");
        };
        line("gauge", "gateway_admission_queue_depth", queue_depth.to_string());
        line("counter", "gateway_admission_accepted_tickets", self.accepted.load(Relaxed).to_string());
        line("counter", "gateway_executed_tickets", self.executed_tickets.load(Relaxed).to_string());
        line("counter", "gateway_ticket_transactions", self.ticket_transactions.load(Relaxed).to_string());
        self.queue_wait.render(&mut text, "gateway_admission_queue_wait_seconds", &WAIT_BOUNDS);
        for stage in Stage::ALL {
            self.stages[stage as usize].render(&mut text, stage.metric(), &WAIT_BOUNDS);
        }
        self.packs.render(&mut text, "gateway_flight_pack_size", &[1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
        self.flights.render(&mut text, "gateway_flight_seconds", &WAIT_BOUNDS);
        text
    }

    pub fn stage(&self, stage: Stage, duration: Duration) {
        self.stages[stage as usize].observe(duration.as_secs_f64(), &WAIT_BOUNDS);
    }
    pub fn pack(&self, size: usize) {
        self.packs.observe(size as f64, &[1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    }
    pub fn flight(&self, duration: Duration) {
        self.flights.observe(duration.as_secs_f64(), &WAIT_BOUNDS);
    }
}

struct Histogram<const N: usize> {
    buckets: [AtomicU64; N],
    count: AtomicU64,
    sum_micros: AtomicU64,
}

impl<const N: usize> Histogram<N> {
    const fn new() -> Self {
        Self { buckets: [const { AtomicU64::new(0) }; N], count: AtomicU64::new(0), sum_micros: AtomicU64::new(0) }
    }
    fn observe(&self, value: f64, bounds: &[f64; N]) {
        if let Some(bucket) = bounds.iter().position(|bound| value <= *bound) {
            self.buckets[bucket].fetch_add(1, Relaxed);
        }
        self.sum_micros.fetch_add((value * 1e6) as u64, Relaxed);
        self.count.fetch_add(1, Relaxed);
    }
    fn render(&self, text: &mut String, name: &str, bounds: &[f64; N]) {
        writeln!(text, "# TYPE {name} histogram").expect("writing to a string");
        let mut cumulative = 0;
        for (bound, bucket) in bounds.iter().zip(&self.buckets) {
            cumulative += bucket.load(Relaxed);
            writeln!(text, "{name}_bucket{{le=\"{bound}\"}} {cumulative}").expect("writing to a string");
        }
        let count = self.count.load(Relaxed);
        writeln!(text, "{name}_bucket{{le=\"+Inf\"}} {count}").expect("writing to a string");
        writeln!(text, "{name}_sum {}", self.sum_micros.load(Relaxed) as f64 / 1e6).expect("writing to a string");
        writeln!(text, "{name}_count {count}").expect("writing to a string");
    }
}
