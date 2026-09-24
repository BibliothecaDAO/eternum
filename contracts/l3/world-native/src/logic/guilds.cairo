use starknet::ContractAddress;
use starknet::storage::StorageMapReadAccess;
use crate::guilds::*;

pub fn guild_member(game_id: u32, actor: ContractAddress) -> ContractAddress {
    crate::state::read().guilds.members.read((game_id, actor))
}
#[starknet::component]
pub mod GuildState {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use crate::guilds::{CreateGuild, Guild, JoinGuild, SetWhitelist, WhitelistKey};
    use crate::logic::release::ReleaseState;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }
    #[embeddable_as(GuildsImpl)]
    pub impl Commands<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::guilds::IGuilds<ComponentState<TContractState>> {
        fn guild_member(
            self: @ComponentState<TContractState>, game_id: u32, actor: ContractAddress,
        ) -> ContractAddress {
            crate::logic::guilds::guild_member(game_id, actor)
        }
        fn guild(self: @ComponentState<TContractState>, game_id: u32, guild_id: ContractAddress) -> Option<Guild> {
            let value = self.data.guilds.guilds.read((game_id, guild_id));
            if value.name == 0 {
                None
            } else {
                Some(value)
            }
        }
        fn guild_whitelisted(self: @ComponentState<TContractState>, key: WhitelistKey) -> bool {
            self.data.guilds.whitelist.read((key.game_id, key.guild_id, key.player))
        }
        fn create_guild(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: CreateGuild,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.authorize(game_id, context.timestamp, context);
            assert!(command.name != 0, "guild name must be set");
            self.require_structure(game_id, actor, command.owned_structure_id);
            assert!(self.guild(game_id, actor).is_none(), "guild already exists");
            self.detach_member(game_id, actor);
            let guild = Guild { public: command.public, name: command.name };
            self.data.guilds.guilds.write((game_id, actor), guild);
            let mut values = array![];
            guild.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'Guild',
                        keys: array![game_id.into(), actor.into()].span(),
                        values: values.span(),
                    },
                );
            self.attach_member(game_id, actor, actor);
        }
        fn join_guild(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: JoinGuild,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.authorize(game_id, context.timestamp, context);
            self.require_structure(game_id, actor, command.owned_structure_id);
            let guild = self.guild(game_id, command.guild_id).expect('guild does not exist');
            assert!(
                guild.public
                    || self.guild_whitelisted(WhitelistKey { game_id, guild_id: command.guild_id, player: actor }),
                "player is not whitelisted",
            );
            if self.data.guilds.members.read((game_id, actor)) == command.guild_id {
                return;
            }
            self.detach_member(game_id, actor);
            self.attach_member(game_id, actor, command.guild_id);
        }
        fn leave_guild(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.authorize(game_id, context.timestamp, context);
            assert!(self.data.guilds.members.read((game_id, actor)) != 0.try_into().unwrap(), "not a guild member");
            self.detach_member(game_id, actor);
        }
        fn set_guild_whitelist(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: SetWhitelist,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.authorize(game_id, context.timestamp, context);
            self.guild(game_id, actor).expect('guild does not exist');
            self.require_structure(game_id, command.player, command.owned_structure_id);
            self.data.guilds.whitelist.write((game_id, actor, command.player), command.allowed);
            let keys = array![game_id.into(), actor.into(), command.player.into()].span();
            if command.allowed {
                self.emit(RowSet { version: 1, model: 'GuildWhitelist', keys, values: array![1].span() });
            } else {
                self.emit(RowDeleted { version: 1, model: 'GuildWhitelist', keys });
            }
        }
        fn remove_guild_member(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            member: ContractAddress,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.authorize(game_id, context.timestamp, context);
            assert!(self.data.guilds.members.read((game_id, member)) == actor, "not a member of this guild");
            self.detach_member(game_id, member);
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn authorize(
            self: @ComponentState<TContractState>,
            game_id: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            crate::game::assert_playing(game_context.game.unbox(), timestamp);
        }
        fn require_structure(
            self: @ComponentState<TContractState>, game_id: u32, player: ContractAddress, structure_id: u32,
        ) {
            assert!(player != 0.try_into().unwrap(), "invalid guild player");
            assert!(
                crate::logic::structures::owner(
                    crate::resources::ResourceKey { game_id, entity_id: structure_id },
                ) == player,
                "player does not own this structure",
            );
        }
        fn attach_member(
            ref self: ComponentState<TContractState>, game_id: u32, player: ContractAddress, guild_id: ContractAddress,
        ) {
            self
                .data
                .guilds
                .member_count
                .write((game_id, guild_id), self.data.guilds.member_count.read((game_id, guild_id)) + 1);
            self.data.guilds.members.write((game_id, player), guild_id);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'GuildMember',
                        keys: array![game_id.into(), player.into()].span(),
                        values: array![guild_id.into()].span(),
                    },
                );
        }
        fn detach_member(ref self: ComponentState<TContractState>, game_id: u32, player: ContractAddress) {
            let guild_id = self.data.guilds.members.read((game_id, player));
            if guild_id == 0.try_into().unwrap() {
                return;
            }
            self.data.guilds.members.write((game_id, player), 0.try_into().unwrap());
            self
                .emit(
                    RowDeleted { version: 1, model: 'GuildMember', keys: array![game_id.into(), player.into()].span() },
                );
            let remaining = self.data.guilds.member_count.read((game_id, guild_id)) - 1;
            self.data.guilds.member_count.write((game_id, guild_id), remaining);
            if remaining == 0 {
                self.data.guilds.guilds.write((game_id, guild_id), Guild { name: 0, public: false });
                self
                    .emit(
                        RowDeleted { version: 1, model: 'Guild', keys: array![game_id.into(), guild_id.into()].span() },
                    );
            }
        }
    }
}
