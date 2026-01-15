#[starknet::interface]
trait IMockPaymentERC721<T> {
    fn mint(ref self: T, to: starknet::ContractAddress, token_id: u256);
}

// Mock ERC721 contract for payment tokens
#[starknet::contract]
mod MockPaymentERC721 {
    use openzeppelin::token::erc721::{ERC721Component, ERC721HooksEmptyImpl};
    use openzeppelin::introspection::src5::SRC5Component;
    use starknet::ContractAddress;

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    pub(crate) impl ERC721MixinImpl = ERC721Component::ERC721MixinImpl<ContractState>;
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, name: ByteArray, symbol: ByteArray) {
        self.erc721.initializer(name, symbol, "");
    }

    #[generate_trait]
    #[abi(per_item)]
    impl ExternalImpl of ExternalTrait {
        #[external(v0)]
        fn mint(ref self: ContractState, to: ContractAddress, token_id: u256) {
            self.erc721.mint(to, token_id);
        }
    }
}

// Mock ERC721 contract for collectible tokens
#[starknet::contract]
mod MockCollectibleERC721 {
    use collectibles_claim::contracts::cosmetics::CollectibleMintTrait;
    use openzeppelin::token::erc721::{ERC721Component};
    use openzeppelin::token::erc721::extensions::ERC721EnumerableComponent;
    use openzeppelin::introspection::src5::SRC5Component;
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: ERC721EnumerableComponent, storage: erc721_enumerable, event: ERC721EnumerableEvent);

    #[abi(embed_v0)]
    impl ERC721MixinImpl = ERC721Component::ERC721MixinImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC721EnumerableImpl = ERC721EnumerableComponent::ERC721EnumerableImpl<ContractState>;

    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;
    impl ERC721EnumerableInternalImpl = ERC721EnumerableComponent::InternalImpl<ContractState>;


    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        erc721_enumerable: ERC721EnumerableComponent::Storage,
        token_attributes: Map<u256, u128>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        ERC721EnumerableEvent: ERC721EnumerableComponent::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, name: ByteArray, symbol: ByteArray) {
        self.erc721.initializer(name, symbol, "");
        self.erc721_enumerable.initializer();
    }

    #[abi(embed_v0)]
    impl CollectibleMintImpl of CollectibleMintTrait<ContractState> {
        fn safe_mint(ref self: ContractState, recipient: ContractAddress, attributes_raw: u128) {
            let token_id = self.erc721_enumerable.total_supply() + 1;
            self.erc721.mint(recipient, token_id);
            self.token_attributes.entry(token_id).write(attributes_raw);
        }
    }

    impl ERC721HooksImpl of ERC721Component::ERC721HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC721Component::ComponentState<ContractState>,
            to: ContractAddress,
            token_id: u256,
            auth: ContractAddress,
        ) {
            let mut contract_state = self.get_contract_mut();
            contract_state.erc721_enumerable.before_update(to, token_id);
        }
    }

    #[generate_trait]
    #[abi(per_item)]
    impl ExternalImpl of ExternalTrait {
        #[external(v0)]
        fn get_token_attributes(self: @ContractState, token_id: u256) -> u128 {
            self.token_attributes.entry(token_id).read()
        }
    }
}