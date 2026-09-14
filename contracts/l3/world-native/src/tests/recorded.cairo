use core::poseidon::poseidon_hash_span;
use eternum_randomness_protocol::entrypoint::{
    Admission, ExecutionContext, IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait,
    IRecordedExecutionSafeDispatcher, IRecordedExecutionSafeDispatcherTrait, IRecordedExecutionViewsSafeDispatcher,
    IRecordedExecutionViewsSafeDispatcherTrait,
};
use eternum_randomness_protocol::{Envelope, Intent, action_identity, encode_envelope};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_account_contract_address, start_cheat_chain_id_global,
    start_cheat_resource_bounds, start_cheat_signature, start_cheat_transaction_hash, start_cheat_transaction_version,
};
use starknet::{ContractAddress, ResourcesBounds};
use crate::commands::{Command, ExecutionContext as DomainContext, command_commitment};
use crate::game::{GameRegistry, GameStatus, IGameDispatcher, IGameDispatcherTrait};
use crate::lifecycle::{IDomainDispatcher, IDomainDispatcherTrait};
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait, ISeasonSafeDispatcher};

#[derive(Copy, Drop, Serde)]
pub struct FixtureAction {
    pub game_id: u32,
    pub actor: ContractAddress,
    pub nonce: u64,
    pub deadline: u64,
    pub command: Command,
}

pub fn rules() -> crate::rules::SliceRules {
    let data = read_txt(@FileTrait::new("tests/fixtures/preset-1.txt"));
    let mut fields = data.span();
    Serde::deserialize(ref fields).unwrap()
}
pub fn create_games(season: ContractAddress, authority: ContractAddress) {
    snforge_std::start_cheat_caller_address(season, authority);
    for game_id in array![1, 2] {
        IGameDispatcher { contract_address: season }
            .create_game(
                game_id,
                GameRegistry {
                    name: 'fixture',
                    series_id: 0,
                    game_number_in_series: 0,
                    preset_id: 1,
                    creator: authority,
                    status: GameStatus::Live,
                    dev_mode_on: true,
                    start_settling_at: 0,
                    start_main_at: 0,
                    end_at: 999999,
                    end_grace_seconds: 0,
                    registration_grace_seconds: 0,
                    final_trial_id: 0,
                    seed: 1,
                },
                rules(),
            );
    }
    snforge_std::stop_cheat_caller_address(season);
}
pub fn deploy_submitter(address: ContractAddress) {
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    if starknet::syscalls::get_class_hash_at_syscall(address).unwrap() == 0.try_into().unwrap() {
        declare("SequencingAccount")
            .unwrap()
            .contract_class()
            .deploy_at(@array![0x111, signer.public_key], address)
            .unwrap();
    }
}
pub fn configure_submitter(season: ContractAddress, account: ContractAddress) {
    start_cheat_chain_id_global('TEST');
    start_cheat_transaction_version(season, 3);
    start_cheat_account_contract_address(season, account);
    start_cheat_transaction_hash(season, 999);
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let (r, s) = signer.sign(999).unwrap();
    start_cheat_signature(season, array![r, s].span());
    start_cheat_resource_bounds(
        season, array![ResourcesBounds { resource: 'L2_GAS', max_amount: 1200000000, max_price_per_unit: 0 }].span(),
    );
}
pub fn make_intent(season: ContractAddress, action: FixtureAction) -> Intent {
    let mut values = array!['ETERNUM_RULES', 1];
    rules().serialize(ref values);
    let mut arguments = array![];
    action.command.serialize(ref arguments);
    Intent {
        chain: 'TEST',
        deployment: season.into(),
        game_id: action.game_id.into(),
        actor: action.actor.into(),
        nonce: action.nonce,
        command: command_commitment(action.command),
        rules: poseidon_hash_span(values.span()),
        valid_from: 0,
        valid_until: action.deadline,
        last_order: 100,
        arguments,
    }
}
pub fn make_context(season: ContractAddress, action: FixtureAction, context: DomainContext) -> ExecutionContext {
    let head = ISeasonDispatcher { contract_address: season }.execution_head();
    let mut values = array!['ETERNUM_EXECUTION', 1];
    IDomainDispatcher { contract_address: season }.domain_state().peers.serialize(ref values);
    let envelope = Envelope {
        action: action_identity(@make_intent(season, action)),
        order: head.order + 1,
        predecessor: head.binding,
        preceding_state: head.state,
        timestamp: context.timestamp,
        execution_config: poseidon_hash_span(values.span()),
        l2_gas: 1200000000,
        root: context.raw_root,
    };
    let player: StarkCurveKeyPair = KeyPairTrait::from_secret_key(12345);
    ExecutionContext {
        envelope: encode_envelope(@envelope), authority_epoch: 1, accepted_public_key: player.public_key,
    }
}
#[generate_trait]
pub impl FixtureSeason of FixtureSeasonTrait {
    fn hash_intent(self: ISeasonDispatcher, action: FixtureAction) -> felt252 {
        action_identity(@make_intent(self.contract_address, action))
    }
    fn execute(self: ISeasonDispatcher, action: FixtureAction, context: DomainContext, r: felt252, s: felt252) {
        IRecordedExecutionDispatcher { contract_address: self.contract_address }
            .execute(
                make_intent(self.contract_address, action), make_context(self.contract_address, action, context), r, s,
            );
    }
}
#[generate_trait]
pub impl FixtureSafeSeason of FixtureSafeSeasonTrait {
    #[feature("safe_dispatcher")]
    fn execute(
        self: ISeasonSafeDispatcher, action: FixtureAction, context: DomainContext, r: felt252, s: felt252,
    ) -> Result<(), Array<felt252>> {
        IRecordedExecutionSafeDispatcher { contract_address: self.contract_address }
            .execute(
                make_intent(self.contract_address, action), make_context(self.contract_address, action, context), r, s,
            )
    }
}
#[feature("safe_dispatcher")]
pub fn admission(season: ContractAddress, actor: ContractAddress) -> Result<Admission, Array<felt252>> {
    IRecordedExecutionViewsSafeDispatcher { contract_address: season }.get_admission(1, actor.into())
}
