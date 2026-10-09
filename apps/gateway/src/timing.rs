//! Durations use one monotonic clock; metrics never label actors or transactions.

use crate::metrics::METRICS;
use starknet_types_core::felt::Felt;
use std::time::{Duration, Instant};

#[derive(Clone, Copy)]
#[repr(usize)]
pub(crate) enum Stage {
    AdmissionRead,
    SignatureRead,
    NonceRead,
    HashSign,
    AddInvoke,
    ReceiptWait,
    OutcomeParsing,
    IdleGap,
}

impl Stage {
    pub const ALL: [Self; 8] = [
        Self::AdmissionRead,
        Self::SignatureRead,
        Self::NonceRead,
        Self::HashSign,
        Self::AddInvoke,
        Self::ReceiptWait,
        Self::OutcomeParsing,
        Self::IdleGap,
    ];

    pub fn metric(self) -> &'static str {
        match self {
            Self::AdmissionRead => "gateway_admission_get_admission_seconds",
            Self::SignatureRead => "gateway_admission_is_valid_signature_seconds",
            Self::NonceRead => "gateway_flight_nonce_read_seconds",
            Self::HashSign => "gateway_flight_hash_sign_seconds",
            Self::AddInvoke => "gateway_flight_add_invoke_seconds",
            Self::ReceiptWait => "gateway_flight_receipt_wait_seconds",
            Self::OutcomeParsing => "gateway_flight_outcome_parsing_seconds",
            Self::IdleGap => "gateway_flight_idle_gap_seconds",
        }
    }
}

#[derive(Default)]
pub(crate) struct Stages {
    durations: [Duration; Stage::ALL.len()],
    counts: [u64; Stage::ALL.len()],
}

impl Stages {
    pub fn count(&self, stage: Stage) -> u64 {
        self.counts[stage as usize]
    }
    pub fn duration(&self, stage: Stage) -> Duration {
        self.durations[stage as usize]
    }
    fn millis(&self, stage: Stage) -> f64 {
        self.duration(stage).as_secs_f64() * 1000.0
    }
}

/// Dropping a timed stage also records errors and cancelled submission attempts.
pub(crate) struct StageTimer<'a> {
    started: Instant,
    stage: Stage,
    totals: Option<&'a mut Stages>,
    finished: Option<Instant>,
}

impl<'a> StageTimer<'a> {
    pub fn start(stage: Stage, totals: Option<&'a mut Stages>) -> Self {
        Self { started: Instant::now(), stage, totals, finished: None }
    }

    /// A receipt may have arrived before the addInvoke acknowledgement; that wait is zero.
    pub fn finish_at(mut self, received: Instant) {
        self.finished = Some(received);
    }
}

impl Drop for StageTimer<'_> {
    fn drop(&mut self) {
        let duration = self.finished.unwrap_or_else(Instant::now).saturating_duration_since(self.started);
        METRICS.stage(self.stage, duration);
        if let Some(totals) = &mut self.totals {
            totals.durations[self.stage as usize] += duration;
            totals.counts[self.stage as usize] += 1;
        }
    }
}

pub(crate) struct AdmissionTiming {
    pub stages: Stages,
    game: Felt,
    action: Felt,
}

impl AdmissionTiming {
    pub fn new(game: Felt, action: Felt) -> Self {
        Self { stages: Stages::default(), game, action }
    }
}

impl Drop for AdmissionTiming {
    fn drop(&mut self) {
        tracing::info!(target: "gateway", game = %self.game, action = %self.action, get_admission_ms = self.stages.millis(Stage::AdmissionRead),
            get_admission_count = self.stages.count(Stage::AdmissionRead),
            is_valid_signature_ms = self.stages.millis(Stage::SignatureRead),
            is_valid_signature_count = self.stages.count(Stage::SignatureRead), "gateway_admission_stages");
    }
}

/// One pack's flight includes any immutable retries, bisection and reconciliation.
pub(crate) struct FlightTiming {
    pub stages: Stages,
    started: Instant,
    pack_size: usize,
    idle_gap: Option<Duration>,
    completed: bool,
}

impl FlightTiming {
    pub fn new(pack_size: usize, previous_finished: Option<Instant>) -> Self {
        let started = Instant::now();
        let idle_gap = previous_finished.map(|finished| started.duration_since(finished));
        if let Some(gap) = idle_gap {
            METRICS.stage(Stage::IdleGap, gap);
        }
        METRICS.pack(pack_size);
        Self { stages: Stages::default(), started, pack_size, idle_gap, completed: false }
    }
    pub fn complete(&mut self) {
        self.completed = true;
    }
}

impl Drop for FlightTiming {
    fn drop(&mut self) {
        let elapsed = self.started.elapsed();
        METRICS.flight(elapsed);
        let measured: Duration = self.stages.durations.iter().sum();
        tracing::info!(target: "gateway", pack_size = self.pack_size, completed = self.completed,
            flight_ms = elapsed.as_secs_f64() * 1000.0,
            idle_gap_ms = self.idle_gap.map(|gap| gap.as_secs_f64() * 1000.0),
            nonce_read_ms = self.stages.millis(Stage::NonceRead),
            nonce_reads = self.stages.count(Stage::NonceRead),
            hash_sign_ms = self.stages.millis(Stage::HashSign),
            add_invoke_ms = self.stages.millis(Stage::AddInvoke),
            submission_attempts = self.stages.count(Stage::AddInvoke),
            receipt_wait_ms = self.stages.millis(Stage::ReceiptWait),
            acknowledged_waits = self.stages.count(Stage::ReceiptWait),
            outcome_parsing_ms = self.stages.millis(Stage::OutcomeParsing),
            outcome_parses = self.stages.count(Stage::OutcomeParsing),
            other_ms = elapsed.saturating_sub(measured).as_secs_f64() * 1000.0,
            "gateway_flight_stages");
    }
}
