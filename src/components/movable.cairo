// speed seconds per km
#[derive(Component, Copy, Drop, Serde)]
struct Movable {
    sec_per_km: u16,
    blocked: bool,
}

// DISCUSS: separated from the Movable component because
// we want to attach an ArrivalTime to the trading order
// without having to attach a Movable component to the order
#[derive(Component, Copy, Drop, Serde)]
struct ArrivalTime {
    arrives_at: u64, 
}
