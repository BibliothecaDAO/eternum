// speed in km per hour
#[derive(Component, Copy, Drop, Serde)]
struct Movable {
    speed: u8, 
}

#[derive(Component, Copy, Drop, Serde)]
struct ArrivalTime {
    arrives_at: u64, 
}
