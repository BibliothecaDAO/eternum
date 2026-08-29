use game_ledger::types::{Game, PlayerResult, Preset, Registration};
use starknet::ContractAddress;

pub const OPERATOR_ROLE: felt252 = selector!("OPERATOR_ROLE");
const BPS: u256 = 10_000;
const PAYOUT_WEIGHT_SCALE: u256 = 1_000_000_000_000_000_000;
const MMR_PRECISION: u256 = 1_000_000_000_000_000_000;

#[starknet::interface]
pub trait IGameLedger<TState> {
    fn register_preset(ref self: TState, preset_id: u32, preset: Preset);
    fn set_messaging(ref self: TState, core_contract: ContractAddress, l3_entry_system: felt252);
    fn open_game(ref self: TState, game_id: u32, preset_id: u32, start: u64, end: u64);
    fn register(ref self: TState, game_id: u32, sword: bool, shield: bool);
    fn register_with_pass(ref self: TState, game_id: u32, pass_id: u256);
    fn register_village(ref self: TState, game_id: u32, village_pass_id: u256);
    fn fund(ref self: TState, game_id: u32, amount: u256);
    fn cancel_game(ref self: TState, game_id: u32);
    fn refund(ref self: TState, game_id: u32);
    fn apply_results(ref self: TState, game_id: u32, ranked: Array<(ContractAddress, u16, u16)>);
    fn get_preset(self: @TState, preset_id: u32) -> Preset;
    fn get_game(self: @TState, game_id: u32) -> Game;
    fn get_registration(self: @TState, game_id: u32, owner: ContractAddress) -> Registration;
    fn get_registered_owner(self: @TState, game_id: u32, index: u16) -> ContractAddress;
    fn get_player_result(self: @TState, game_id: u32, owner: ContractAddress) -> PlayerResult;
}

#[starknet::interface]
pub trait IMMRToken<TState> {
    fn get_player_mmr(self: @TState, player: ContractAddress) -> u256;
    fn update_mmr_batch(ref self: TState, updates: Array<(ContractAddress, u256)>);
}

#[starknet::interface]
pub trait IPassBurn<TState> {
    fn burn(ref self: TState, token_id: u256);
}

#[starknet::interface]
pub trait ISeasonPassMetadata<TState> {
    fn get_encoded_metadata(self: @TState, token_id: u16) -> (felt252, felt252, felt252);
}

#[starknet::interface]
pub trait IPiltoverCore<TState> {
    fn send_message_to_appchain(ref self: TState, to_address: felt252, selector: felt252, payload: Span<felt252>);
}

#[starknet::contract]
pub mod GameLedger {
    use core::dict::Felt252Dict;
    use core::num::traits::Zero;
    use game_ledger::mmr::MmrCalculatorImpl;
    use game_ledger::types::{Game, PlayerResult, Preset, Registration};
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::{
        BPS, IGameLedger, IMMRTokenDispatcher, IMMRTokenDispatcherTrait, IPassBurnDispatcher, IPassBurnDispatcherTrait,
        IPiltoverCoreDispatcher, IPiltoverCoreDispatcherTrait, ISeasonPassMetadataDispatcher,
        ISeasonPassMetadataDispatcherTrait, MMR_PRECISION, OPERATOR_ROLE, PAYOUT_WEIGHT_SCALE,
    };

    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);

    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        treasury: ContractAddress,
        lords: ContractAddress,
        mmr_token: ContractAddress,
        season_pass: ContractAddress,
        village_pass: ContractAddress,
        loot_chest: ContractAddress,
        elite_invite: ContractAddress,
        cosmetics: ContractAddress,
        core_contract: ContractAddress,
        l3_entry_system: felt252,
        presets: Map<u32, Preset>,
        preset_exists: Map<u32, bool>,
        games: Map<u32, Game>,
        registrations: Map<(u32, ContractAddress), Registration>,
        registered_owners: Map<(u32, u16), ContractAddress>,
        results: Map<(u32, ContractAddress), PlayerResult>,
        result_seen: Map<(u32, ContractAddress), bool>,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        PresetRegistered: PresetRegistered,
        GameOpened: GameOpened,
        Registered: Registered,
        Funded: Funded,
        GameCancelled: GameCancelled,
        Refunded: Refunded,
        PlayerPaid: PlayerPaid,
        ResultsApplied: ResultsApplied,
        MessagingConfigured: MessagingConfigured,
    }

    #[derive(Drop, starknet::Event)]
    struct PresetRegistered {
        #[key]
        preset_id: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct GameOpened {
        #[key]
        game_id: u32,
        preset_id: u32,
        start: u64,
        end: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Registered {
        #[key]
        game_id: u32,
        #[key]
        owner: ContractAddress,
        realm_id: u256,
        metadata: (felt252, felt252, felt252),
    }

    #[derive(Drop, starknet::Event)]
    struct Funded {
        #[key]
        game_id: u32,
        #[key]
        funder: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct GameCancelled {
        #[key]
        game_id: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct Refunded {
        #[key]
        game_id: u32,
        #[key]
        owner: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PlayerPaid {
        #[key]
        game_id: u32,
        #[key]
        owner: ContractAddress,
        rank: u16,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct ResultsApplied {
        #[key]
        game_id: u32,
        pool: u256,
        protocol_cut: u256,
        dust: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct MessagingConfigured {
        core_contract: ContractAddress,
        l3_entry_system: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        operator: ContractAddress,
        treasury: ContractAddress,
        lords: ContractAddress,
        mmr_token: ContractAddress,
        season_pass: ContractAddress,
        village_pass: ContractAddress,
        loot_chest: ContractAddress,
        elite_invite: ContractAddress,
        cosmetics: ContractAddress,
    ) {
        self
            .assert_constructor_addresses(
                admin,
                operator,
                treasury,
                lords,
                mmr_token,
                season_pass,
                village_pass,
                loot_chest,
                elite_invite,
                cosmetics,
            );
        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, admin);
        self.accesscontrol._grant_role(OPERATOR_ROLE, operator);
        self.treasury.write(treasury);
        self.lords.write(lords);
        self.mmr_token.write(mmr_token);
        self.season_pass.write(season_pass);
        self.village_pass.write(village_pass);
        self.loot_chest.write(loot_chest);
        self.elite_invite.write(elite_invite);
        self.cosmetics.write(cosmetics);
    }

    #[abi(embed_v0)]
    impl GameLedgerImpl of IGameLedger<ContractState> {
        fn register_preset(ref self: ContractState, preset_id: u32, preset: Preset) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(!self.preset_exists.entry(preset_id).read(), "Ledger: preset already registered");
            self.assert_valid_preset(preset);
            self.presets.entry(preset_id).write(preset);
            self.preset_exists.entry(preset_id).write(true);
            self.emit(PresetRegistered { preset_id });
        }

        fn set_messaging(ref self: ContractState, core_contract: ContractAddress, l3_entry_system: felt252) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(core_contract.is_zero() == l3_entry_system.is_zero(), "Ledger: incomplete messaging config");
            self.core_contract.write(core_contract);
            self.l3_entry_system.write(l3_entry_system);
            self.emit(MessagingConfigured { core_contract, l3_entry_system });
        }

        fn open_game(ref self: ContractState, game_id: u32, preset_id: u32, start: u64, end: u64) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            assert!(!self.games.entry(game_id).read().exists, "Ledger: game already opened");
            assert!(self.preset_exists.entry(preset_id).read(), "Ledger: unknown preset");
            assert!(starknet::get_block_timestamp() < start, "Ledger: start must be in the future");
            assert!(start < end, "Ledger: invalid game window");

            self.games.entry(game_id).write(Game { exists: true, preset_id, start, end, ..Default::default() });
            self.emit(GameOpened { game_id, preset_id, start, end });
        }

        fn register(ref self: ContractState, game_id: u32, sword: bool, shield: bool) {
            let owner = starknet::get_caller_address();
            let game = self.assert_registration_open(game_id, owner);
            let preset = self.presets.entry(game.preset_id).read();
            let payment = preset.entry_fee
                + if sword {
                    preset.sword_price
                } else {
                    0
                }
                + if shield {
                    preset.shield_price
                } else {
                    0
                };

            self.record_registration(game_id, owner, sword, shield, payment, 0);
            self.pull_lords(owner, payment);
            self.emit_registration(game_id, owner, 0, (0, 0, 0));
        }

        fn register_with_pass(ref self: ContractState, game_id: u32, pass_id: u256) {
            let owner = starknet::get_caller_address();
            self.assert_registration_open(game_id, owner);
            let season_pass = self.season_pass.read();
            assert!(
                IERC721Dispatcher { contract_address: season_pass }.owner_of(pass_id) == owner,
                "Ledger: not pass owner",
            );
            let metadata = ISeasonPassMetadataDispatcher { contract_address: season_pass }
                .get_encoded_metadata(pass_id.try_into().expect('Ledger: pass id exceeds u16'));

            self.record_registration(game_id, owner, false, false, 0, pass_id);
            IPassBurnDispatcher { contract_address: season_pass }.burn(pass_id);
            self.emit_registration(game_id, owner, pass_id, metadata);
        }

        fn register_village(ref self: ContractState, game_id: u32, village_pass_id: u256) {
            let owner = starknet::get_caller_address();
            self.assert_registration_open(game_id, owner);
            let village_pass = self.village_pass.read();
            assert!(
                IERC721Dispatcher { contract_address: village_pass }.owner_of(village_pass_id) == owner,
                "Ledger: not village pass owner",
            );

            self.record_registration(game_id, owner, false, false, 0, village_pass_id);
            IPassBurnDispatcher { contract_address: village_pass }.burn(village_pass_id);
            self.emit_registration(game_id, owner, village_pass_id, (0, 0, 0));
        }

        fn fund(ref self: ContractState, game_id: u32, amount: u256) {
            let funder = starknet::get_caller_address();
            let game = self.assert_game_open_before_start(game_id);
            assert!(amount > 0, "Ledger: zero funding");

            let mut registration = self.registrations.entry((game_id, funder)).read();
            registration.paid += amount;
            self.registrations.entry((game_id, funder)).write(registration);
            self.add_to_pool(game_id, game, amount);
            self.pull_lords(funder, amount);
            self.emit(Funded { game_id, funder, amount });
        }

        fn cancel_game(ref self: ContractState, game_id: u32) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let mut game = self.assert_game_open_before_start(game_id);
            game.cancelled = true;
            self.games.entry(game_id).write(game);
            self.emit(GameCancelled { game_id });
        }

        fn refund(ref self: ContractState, game_id: u32) {
            let owner = starknet::get_caller_address();
            let mut game = self.games.entry(game_id).read();
            assert!(game.exists && game.cancelled, "Ledger: game not cancelled");
            let mut registration = self.registrations.entry((game_id, owner)).read();
            let amount = registration.paid;
            assert!(amount > 0, "Ledger: nothing to refund");

            registration.paid = 0;
            game.pool -= amount;
            self.registrations.entry((game_id, owner)).write(registration);
            self.games.entry(game_id).write(game);
            self.send_lords(owner, amount);
            self.emit(Refunded { game_id, owner, amount });
        }

        fn apply_results(ref self: ContractState, game_id: u32, ranked: Array<(ContractAddress, u16, u16)>) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let mut game = self.games.entry(game_id).read();
            self.assert_results_open(game);
            self.validate_and_record_results(game_id, game.registered_count, ranked.span());

            let preset = self.presets.entry(game.preset_id).read();
            let pool = game.pool;
            let protocol_cut = pool * preset.protocol_cut_bps.into() / BPS;
            let allocations = self
                .calculate_position_allocations(
                    pool - protocol_cut, game.registered_count, preset.paid_fraction_bps, preset.decay_bps,
                );

            game.finalized = true;
            game.pool = 0;
            self.games.entry(game_id).write(game);
            let total_payout = self.pay_ranked_players(game_id, ranked.span(), allocations.span());
            let treasury_amount = pool - total_payout;
            let dust = treasury_amount - protocol_cut;
            self.send_lords(self.treasury.read(), treasury_amount);
            self.apply_mmr(game_id, ranked.span(), preset);

            game.protocol_cut = protocol_cut;
            game.dust = dust;
            self.games.entry(game_id).write(game);
            assert!(total_payout + protocol_cut + dust == pool, "Ledger: pool conservation failed");
            self.emit(ResultsApplied { game_id, pool, protocol_cut, dust });
        }

        fn get_preset(self: @ContractState, preset_id: u32) -> Preset {
            assert!(self.preset_exists.entry(preset_id).read(), "Ledger: unknown preset");
            self.presets.entry(preset_id).read()
        }

        fn get_game(self: @ContractState, game_id: u32) -> Game {
            let game = self.games.entry(game_id).read();
            assert!(game.exists, "Ledger: unknown game");
            game
        }

        fn get_registration(self: @ContractState, game_id: u32, owner: ContractAddress) -> Registration {
            self.registrations.entry((game_id, owner)).read()
        }

        fn get_registered_owner(self: @ContractState, game_id: u32, index: u16) -> ContractAddress {
            let game = self.games.entry(game_id).read();
            assert!(game.exists && index < game.registered_count, "Ledger: registration index out of bounds");
            self.registered_owners.entry((game_id, index)).read()
        }

        fn get_player_result(self: @ContractState, game_id: u32, owner: ContractAddress) -> PlayerResult {
            self.results.entry((game_id, owner)).read()
        }
    }

    #[generate_trait]
    impl LedgerAssertionsImpl of LedgerAssertionsTrait {
        fn assert_constructor_addresses(
            self: @ContractState,
            admin: ContractAddress,
            operator: ContractAddress,
            treasury: ContractAddress,
            lords: ContractAddress,
            mmr_token: ContractAddress,
            season_pass: ContractAddress,
            village_pass: ContractAddress,
            loot_chest: ContractAddress,
            elite_invite: ContractAddress,
            cosmetics: ContractAddress,
        ) {
            assert!(
                admin.is_non_zero()
                    && operator.is_non_zero()
                    && treasury.is_non_zero()
                    && lords.is_non_zero()
                    && mmr_token.is_non_zero()
                    && season_pass.is_non_zero()
                    && village_pass.is_non_zero()
                    && loot_chest.is_non_zero()
                    && elite_invite.is_non_zero()
                    && cosmetics.is_non_zero(),
                "Ledger: zero constructor address",
            );
        }

        fn assert_valid_preset(self: @ContractState, preset: Preset) {
            assert!(
                preset.paid_fraction_bps > 0 && preset.paid_fraction_bps <= 10_000, "Ledger: invalid paid fraction",
            );
            assert!(preset.decay_bps > 0 && preset.decay_bps <= 10_000, "Ledger: invalid payout decay");
            assert!(preset.protocol_cut_bps <= 10_000, "Ledger: invalid protocol cut");
            assert!(preset.pm.fee_bps <= 10_000, "Ledger: invalid PM fee");
            assert!(preset.mmr.regression_bps <= 10_000, "Ledger: invalid MMR regression");
            if preset.mmr.enabled {
                assert!(
                    preset.mmr.spread > 0 && preset.mmr.max_delta > 0 && preset.mmr.k > 0 && preset.mmr.min_players > 1,
                    "Ledger: invalid MMR parameters",
                );
            }
        }

        fn assert_game_open_before_start(self: @ContractState, game_id: u32) -> Game {
            let game = self.games.entry(game_id).read();
            assert!(game.exists, "Ledger: unknown game");
            assert!(!game.cancelled && !game.finalized, "Ledger: game closed");
            assert!(starknet::get_block_timestamp() < game.start, "Ledger: game already started");
            game
        }

        fn assert_registration_open(self: @ContractState, game_id: u32, owner: ContractAddress) -> Game {
            let game = self.assert_game_open_before_start(game_id);
            assert!(!self.registrations.entry((game_id, owner)).read().registered, "Ledger: already registered");
            game
        }

        fn assert_results_open(self: @ContractState, game: Game) {
            assert!(game.exists, "Ledger: unknown game");
            assert!(!game.cancelled, "Ledger: game cancelled");
            assert!(!game.finalized, "Ledger: results already applied");
            assert!(starknet::get_block_timestamp() >= game.end, "Ledger: game not ended");
            assert!(game.registered_count > 0, "Ledger: empty roster");
        }
    }

    #[generate_trait]
    impl RegistrationWriterImpl of RegistrationWriterTrait {
        fn record_registration(
            ref self: ContractState,
            game_id: u32,
            owner: ContractAddress,
            sword: bool,
            shield: bool,
            payment: u256,
            realm_id: u256,
        ) {
            let mut game = self.games.entry(game_id).read();
            let mut registration = self.registrations.entry((game_id, owner)).read();
            registration.registered = true;
            registration.sword = sword;
            registration.shield = shield;
            registration.paid += payment;
            registration.realm_id = realm_id;
            self.registrations.entry((game_id, owner)).write(registration);
            self.registered_owners.entry((game_id, game.registered_count)).write(owner);
            game.registered_count += 1;
            game.pool += payment;
            self.games.entry(game_id).write(game);
        }

        fn add_to_pool(ref self: ContractState, game_id: u32, mut game: Game, amount: u256) {
            game.pool += amount;
            self.games.entry(game_id).write(game);
        }

        fn emit_registration(
            ref self: ContractState,
            game_id: u32,
            owner: ContractAddress,
            realm_id: u256,
            metadata: (felt252, felt252, felt252),
        ) {
            self.emit(Registered { game_id, owner, realm_id, metadata });
            let core_contract = self.core_contract.read();
            if core_contract.is_non_zero() {
                let mut payload = array![];
                game_id.serialize(ref payload);
                owner.serialize(ref payload);
                realm_id.serialize(ref payload);
                metadata.serialize(ref payload);
                IPiltoverCoreDispatcher { contract_address: core_contract }
                    .send_message_to_appchain(
                        self.l3_entry_system.read(), selector!("register_from_l2"), payload.span(),
                    );
            }
        }
    }

    #[generate_trait]
    impl ResultsValidatorImpl of ResultsValidatorTrait {
        fn validate_and_record_results(
            ref self: ContractState, game_id: u32, registered_count: u16, ranked: Span<(ContractAddress, u16, u16)>,
        ) {
            assert!(ranked.len() == registered_count.into(), "Ledger: roster size mismatch");
            let mut index: u32 = 0;
            let mut expected_rank: u16 = 1;
            while index < ranked.len() {
                let (_, rank, _) = *ranked.at(index);
                assert!(rank == expected_rank, "Ledger: invalid competition rank");
                let group_start = index;
                loop {
                    if index >= ranked.len() {
                        break;
                    }
                    let (owner, _, chests) = *ranked.at(index);
                    let (_, current_rank, _) = *ranked.at(index);
                    if current_rank != rank {
                        break;
                    }
                    assert!(
                        self.registrations.entry((game_id, owner)).read().registered,
                        "Ledger: unregistered result owner",
                    );
                    assert!(!self.result_seen.entry((game_id, owner)).read(), "Ledger: duplicate result owner");
                    self.result_seen.entry((game_id, owner)).write(true);
                    self.results.entry((game_id, owner)).write(PlayerResult { rank, chests, ..Default::default() });
                    index += 1;
                }
                let group_size: u16 = (index - group_start).try_into().unwrap();
                expected_rank += group_size;
            }
        }
    }

    #[generate_trait]
    impl PayoutCalculatorImpl of PayoutCalculatorTrait {
        fn calculate_position_allocations(
            self: @ContractState, prize_pool: u256, player_count: u16, paid_fraction_bps: u16, decay_bps: u16,
        ) -> Array<u256> {
            let player_count_u32: u32 = player_count.into();
            let paid_fraction_u32: u32 = paid_fraction_bps.into();
            let winner_count: u16 = ((player_count_u32 * paid_fraction_u32 + 9_999) / 10_000).try_into().unwrap();
            let mut weights: Array<u256> = array![];
            let mut weight = PAYOUT_WEIGHT_SCALE;
            let mut total_weight = 0;
            for _ in 0..winner_count {
                weights.append(weight);
                total_weight += weight;
                weight = weight * decay_bps.into() / BPS;
            }

            let mut allocations = array![];
            for position in 0..winner_count {
                allocations.append(prize_pool * *weights.at(position.into()) / total_weight);
            }
            allocations
        }

        fn pay_ranked_players(
            ref self: ContractState, game_id: u32, ranked: Span<(ContractAddress, u16, u16)>, allocations: Span<u256>,
        ) -> u256 {
            let mut total_payout = 0;
            let mut index: u32 = 0;
            while index < ranked.len() {
                let (_, rank, _) = *ranked.at(index);
                let group_start = index;
                loop {
                    if index >= ranked.len() {
                        break;
                    }
                    let (_, current_rank, _) = *ranked.at(index);
                    if current_rank != rank {
                        break;
                    }
                    index += 1;
                }

                let group_size: u256 = (index - group_start).into();
                let mut group_allocation = 0;
                let mut position: u32 = (rank - 1).into();
                while position < index - group_start + (rank - 1).into() && position < allocations.len() {
                    group_allocation += *allocations.at(position);
                    position += 1;
                }
                let payout = group_allocation / group_size;

                let mut member = group_start;
                while member < index {
                    let (owner, _, _) = *ranked.at(member);
                    let mut result = self.results.entry((game_id, owner)).read();
                    result.payout = payout;
                    self.results.entry((game_id, owner)).write(result);
                    self.send_lords(owner, payout);
                    self.emit(PlayerPaid { game_id, owner, rank, amount: payout });
                    total_payout += payout;
                    member += 1;
                }
            }
            total_payout
        }
    }

    #[generate_trait]
    impl MmrWriterImpl of MmrWriterTrait {
        fn apply_mmr(ref self: ContractState, game_id: u32, ranked: Span<(ContractAddress, u16, u16)>, preset: Preset) {
            if !preset.mmr.enabled || ranked.len() < preset.mmr.min_players.into() {
                self.consume_registration_flags(game_id, ranked);
                return;
            }

            let mmr_token = IMMRTokenDispatcher { contract_address: self.mmr_token.read() };
            let mut current_mmrs: Array<u128> = array![];
            let mut sorted_mmrs: Felt252Dict<u128> = Default::default();
            let mut index: u32 = 0;
            while index < ranked.len() {
                let (owner, _, _) = *ranked.at(index);
                let current_mmr: u128 = (mmr_token.get_player_mmr(owner) / MMR_PRECISION).try_into().unwrap();
                current_mmrs.append(current_mmr);
                Self::insert_sorted(ref sorted_mmrs, index, current_mmr);
                index += 1;
            }
            let median = Self::median(ref sorted_mmrs, ranked.len());

            let mut updates = array![];
            index = 0;
            while index < ranked.len() {
                let (owner, rank, _) = *ranked.at(index);
                let group_size = Self::tie_count(ranked, index, rank);
                let current_mmr = *current_mmrs.at(index);
                let calculated_mmr = MmrCalculatorImpl::calculate_player_mmr(
                    preset.mmr, current_mmr, rank, group_size, ranked.len().try_into().unwrap(), median,
                );
                let mut registration = self.registrations.entry((game_id, owner)).read();
                let new_mmr = MmrCalculatorImpl::apply_flag_modifier(
                    current_mmr, calculated_mmr, registration.sword, registration.shield,
                );
                registration.flags_consumed = true;
                self.registrations.entry((game_id, owner)).write(registration);
                let mut result = self.results.entry((game_id, owner)).read();
                result.mmr_before = current_mmr;
                result.mmr_after = new_mmr;
                self.results.entry((game_id, owner)).write(result);
                updates.append((owner, new_mmr.into() * MMR_PRECISION));
                index += 1;
            }
            mmr_token.update_mmr_batch(updates);
        }

        fn consume_registration_flags(
            ref self: ContractState, game_id: u32, ranked: Span<(ContractAddress, u16, u16)>,
        ) {
            for entry in ranked {
                let (owner, _, _) = *entry;
                let mut registration = self.registrations.entry((game_id, owner)).read();
                registration.flags_consumed = true;
                self.registrations.entry((game_id, owner)).write(registration);
            }
        }

        fn insert_sorted(ref values: Felt252Dict<u128>, length: u32, value: u128) {
            let mut index = length;
            while index > 0 && values.get((index - 1).into()) > value {
                values.insert(index.into(), values.get((index - 1).into()));
                index -= 1;
            }
            values.insert(index.into(), value);
        }

        fn median(ref values: Felt252Dict<u128>, length: u32) -> u128 {
            if length % 2 == 1 {
                values.get((length / 2).into())
            } else {
                (values.get((length / 2 - 1).into()) + values.get((length / 2).into())) / 2
            }
        }

        fn tie_count(ranked: Span<(ContractAddress, u16, u16)>, index: u32, rank: u16) -> u16 {
            let mut first = index;
            while first > 0 {
                let (_, previous_rank, _) = *ranked.at(first - 1);
                if previous_rank != rank {
                    break;
                }
                first -= 1;
            }
            let mut last = index;
            while last + 1 < ranked.len() {
                let (_, next_rank, _) = *ranked.at(last + 1);
                if next_rank != rank {
                    break;
                }
                last += 1;
            }
            (last - first + 1).try_into().unwrap()
        }
    }

    #[generate_trait]
    impl LordsTransferImpl of LordsTransferTrait {
        fn pull_lords(ref self: ContractState, owner: ContractAddress, amount: u256) {
            if amount > 0 {
                assert!(
                    IERC20Dispatcher { contract_address: self.lords.read() }
                        .transfer_from(owner, starknet::get_contract_address(), amount),
                    "Ledger: LORDS transfer_from failed",
                );
            }
        }

        fn send_lords(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            if amount > 0 {
                assert!(
                    IERC20Dispatcher { contract_address: self.lords.read() }.transfer(recipient, amount),
                    "Ledger: LORDS transfer failed",
                );
            }
        }
    }
}
