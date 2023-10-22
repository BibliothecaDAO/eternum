#[derive(Model, Copy, Drop, Serde)]
struct Challenges {
    #[key]
    challenge_id: u128,
    sender_id: u128,
    target_id: u128,
    offer_resources_type: u8,
    offer_resources_amount: u128,
    target_resources_type: u8,
    target_resources_amount: u128,
    //0 craeted
    //1 rejected
    //2 sender win
    //3 target win
    //4 draw
    state: u8
}