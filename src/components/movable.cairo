// speed in km per hour
#[derive(Component, Copy, Drop, Serde)]
struct Movable {
    km_per_hr: u8,
    blocked: bool,
}

#[derive(Component, Copy, Drop, Serde)]
struct ArrivalTime {
    arrives_at: u64, 
}
