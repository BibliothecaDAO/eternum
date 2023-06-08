// speed in km per hour
#[derive(Component, Copy, Drop, Serde)]
struct Movable {
    sec_per_km: u16,
    blocked: bool,
}

#[derive(Component, Copy, Drop, Serde)]
struct ArrivalTime {
    arrives_at: u64, 
}
