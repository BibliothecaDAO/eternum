#[system]
mod SetTravelConfig {
    use traits::Into;

    use eternum::components::config::WorldConfig;
    use eternum::constants::TRANSPORT_CONFIG_ID;
    use eternum::components::config::TravelConfig;

    fn execute(free_transport_per_city: u128) {
        // TODO: can only be executed by Governance Vote
        let _ = commands::set_entity(
            TRANSPORT_CONFIG_ID.into(), (TravelConfig { free_transport_per_city })
        );
    }
}
