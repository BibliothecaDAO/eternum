//! Admission metrics as plain counters, a gauge and a histogram, served on the metrics listener in the
//! Prometheus text format for the shard's collector. No label names a player or a transaction.

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
    /// Waits per bucket, not cumulative; waits above the last bound count only in the total.
    wait_buckets: [AtomicU64; WAIT_BOUNDS.len()],
    waits: AtomicU64,
    wait_micros: AtomicU64,
}

pub(crate) static METRICS: Metrics = Metrics {
    accepted: AtomicU64::new(0),
    executed_tickets: AtomicU64::new(0),
    ticket_transactions: AtomicU64::new(0),
    wait_buckets: [const { AtomicU64::new(0) }; WAIT_BOUNDS.len()],
    waits: AtomicU64::new(0),
    wait_micros: AtomicU64::new(0),
};

impl Metrics {
    /// A ticket took its order in its game.
    pub fn accepted(&self) {
        self.accepted.fetch_add(1, Relaxed);
    }

    /// A ticket left the queue in a submitted batch this long after the gateway received it.
    pub fn left_queue_after(&self, wait: Duration) {
        if let Some(bucket) = WAIT_BOUNDS.iter().position(|bound| wait.as_secs_f64() <= *bound) {
            self.wait_buckets[bucket].fetch_add(1, Relaxed);
        }
        self.waits.fetch_add(1, Relaxed);
        self.wait_micros.fetch_add(wait.as_micros().try_into().unwrap_or(u64::MAX), Relaxed);
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
        let name = "gateway_admission_queue_wait_seconds";
        writeln!(text, "# TYPE {name} histogram").expect("writing to a string");
        let mut cumulative = 0;
        for (bound, bucket) in WAIT_BOUNDS.iter().zip(&self.wait_buckets) {
            cumulative += bucket.load(Relaxed);
            writeln!(text, "{name}_bucket{{le=\"{bound}\"}} {cumulative}").expect("writing to a string");
        }
        let waits = self.waits.load(Relaxed);
        writeln!(text, "{name}_bucket{{le=\"+Inf\"}} {waits}").expect("writing to a string");
        writeln!(text, "{name}_sum {}", self.wait_micros.load(Relaxed) as f64 / 1e6).expect("writing to a string");
        writeln!(text, "{name}_count {waits}").expect("writing to a string");
        text
    }
}
