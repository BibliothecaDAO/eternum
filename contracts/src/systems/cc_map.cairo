// mod contract;
// mod interface;

#[dojo::contract]
mod crypts_and_caverns {
    use cc_dojo_map::systems::cc::cc;

    #[constructor]
    fn constructor(ref self: ContractState) {
        let mut state = cc::unsafe_new_contract_state();
        cc::constructor(ref state);
    }

    #[external(v0)]
    fn mint(ref self: ContractState) {
        let mut state = cc::unsafe_new_contract_state();
        cc::CryptsAndCavernsImpl::mint(ref state);
    }

    #[external(v0)]
    fn generate_dungeon(self: @ContractState, token_id: u256) {
        cc::CryptsAndCavernsImpl::generate_dungeon(@cc::unsafe_new_contract_state(), token_id);
    }

    #[external(v0)]
    fn get_svg(self: @ContractState, token_id: u256) {
        cc::CryptsAndCavernsImpl::get_svg(@cc::unsafe_new_contract_state(), token_id);
    }

    #[external(v0)]
    fn owner_of(self: @ContractState, token_id: u256) {
        cc::CryptsAndCavernsImpl::owner_of(@cc::unsafe_new_contract_state(), token_id);
    }

    #[external(v0)]
    fn get_seed(self: @ContractState, token_id: u256) {
        cc::CryptsAndCavernsImpl::get_seed(@cc::unsafe_new_contract_state(), token_id);
    }
}
