use std::{num::NonZero, sync::Arc};

use dojo_types::primitive::Primitive::ContractAddress;
use eyre::OptionExt;
use serde::Deserialize;
use serenity::{
    all::{CreateMessage, UserId},
    model::id::ChannelId,
};
use shuttle_runtime::SecretStore;
use sqlx::{prelude::FromRow, PgPool};
use starknet_crypto::Felt;
use tokio::sync::mpsc;
use torii_grpc::types::schema::Entity;

use crate::{
    check_user_in_database,
    events::{BattleClaim, BattleJoin, BattleLeave, BattlePillage, BattleStart},
};
use crate::{
    events::{SettleRealm, ToDiscordMessage},
    utils::Position,
};
use starknet::core::utils::parse_cairo_short_string;

pub struct EventProcessor<'a, 'b> {
    database: &'a PgPool,
    message_sender: &'b mpsc::Sender<DiscordMessage>,
    channel_id: NonZero<u64>,
}

impl<'a, 'b> EventProcessor<'a, 'b> {
    pub fn new(
        database: &'a PgPool,
        message_sender: &'b mpsc::Sender<DiscordMessage>,
        channel_id: NonZero<u64>,
    ) -> Self {
        Self {
            database,
            message_sender,
            channel_id,
        }
    }

    async fn send_messages_for_user(&self, address: &str, event: &impl ToDiscordMessage) {
        if let Ok(Some(Some(discord_id))) = check_user_in_database(self.database, address).await {
            tracing::info!("User found in the database: {}", discord_id);
            if let Ok(user_id) = discord_id.parse::<u64>() {
                let channel_message =
                    event.to_discord_message(DiscordMessageType::ChannelMessage(self.channel_id));
                self.message_sender
                    .send(channel_message.clone())
                    .await
                    .unwrap();
                tracing::info!("Sent channel message for user {:?}", channel_message);

                let direct_message =
                    event.to_discord_message(DiscordMessageType::DirectMessage(user_id));
                self.message_sender
                    .send(direct_message.clone())
                    .await
                    .unwrap();
                tracing::info!("Sent direct message to user {:?}", direct_message);
            }
        } else if event.should_send_in_channel_if_no_user_found() {
            let channel_message =
                event.to_discord_message(DiscordMessageType::ChannelMessage(self.channel_id));
            self.message_sender
                .send(channel_message.clone())
                .await
                .unwrap();
        }
    }

    pub async fn process_event(&self, event: GameEventData) {
        match event {
            GameEventData::SettleRealm(event) => {
                tracing::info!("Processing SettleRealm event");
                self.send_messages_for_user(&event.owner_name, &event).await;
            }
            GameEventData::BattleStart(event) => {
                tracing::info!("Processing BattleStart event");
                self.send_messages_for_user(&event.defender, &event).await;
            }
            GameEventData::BattleJoin(event) => {
                tracing::info!("Processing BattleJoin event");
                self.send_messages_for_user(&event.joiner, &event).await;
            }
            GameEventData::BattleLeave(event) => {
                tracing::info!("Processing BattleLeave event");
                self.send_messages_for_user(&event.leaver, &event).await;
            }
            GameEventData::BattleClaim(event) => {
                tracing::info!("Processing BattleClaim event");
                self.send_messages_for_user(&event.previous_owner, &event)
                    .await;
            }
            GameEventData::BattlePillage(event) => {
                tracing::info!("Processing BattlePillage event");
                self.send_messages_for_user(&event.pillaged_structure_owner, &event)
                    .await;
            }
        }
    }
}

#[allow(dead_code)]
pub enum GameEventData {
    BattleStart(BattleStart),
    BattleJoin(BattleJoin),
    BattleLeave(BattleLeave),
    BattleClaim(BattleClaim),
    BattlePillage(BattlePillage),
    SettleRealm(SettleRealm),
}

impl ToDiscordMessage for GameEventData {
    fn to_discord_message(&self, msg_type: DiscordMessageType) -> DiscordMessage {
        match self {
            GameEventData::BattleStart(event) => event.to_discord_message(msg_type),
            GameEventData::BattleJoin(event) => event.to_discord_message(msg_type),
            GameEventData::BattleLeave(event) => event.to_discord_message(msg_type),
            GameEventData::BattleClaim(event) => event.to_discord_message(msg_type),
            GameEventData::BattlePillage(event) => event.to_discord_message(msg_type),
            GameEventData::SettleRealm(event) => event.to_discord_message(msg_type),
        }
    }

    fn should_send_in_channel_if_no_user_found(&self) -> bool {
        match self {
            GameEventData::BattleStart(e) => e.should_send_in_channel_if_no_user_found(),
            GameEventData::BattleJoin(e) => e.should_send_in_channel_if_no_user_found(),
            GameEventData::BattleLeave(e) => e.should_send_in_channel_if_no_user_found(),
            GameEventData::BattleClaim(e) => e.should_send_in_channel_if_no_user_found(),
            GameEventData::BattlePillage(e) => e.should_send_in_channel_if_no_user_found(),
            GameEventData::SettleRealm(e) => e.should_send_in_channel_if_no_user_found(),
        }
    }
}

pub enum DiscordMessageType {
    DirectMessage(u64),
    ChannelMessage(NonZero<u64>),
}

#[derive(Debug, Clone)]
pub enum DiscordMessage {
    DirectMessage {
        user_id: u64,
        content: CreateMessage,
    },
    ChannelMessage {
        channel_id: ChannelId,
        content: CreateMessage,
    },
}

pub struct MessageDispatcher {
    pub http: Arc<serenity::all::Http>,
    pub message_receiver: mpsc::Receiver<DiscordMessage>,
}

pub struct EventHandler {
    pub event_sender: mpsc::Sender<GameEventData>,
}

impl MessageDispatcher {
    pub async fn run(&mut self) {
        while let Some(message) = self.message_receiver.recv().await {
            tracing::info!("Received message through channel");
            if let Err(e) = self.send_message(message).await {
                tracing::warn!("Failed to send message: {:?}", e);
            }
        }
    }

    pub async fn send_message(&self, message: DiscordMessage) -> Result<(), serenity::Error> {
        match message {
            DiscordMessage::DirectMessage { user_id, content } => {
                let user = UserId::new(user_id);
                match user.create_dm_channel(&self.http).await {
                    Ok(channel) => {
                        tracing::info!("DM channel created for user {}", user_id);

                        channel.send_message(&self.http, content).await?;

                        tracing::info!("DM sent to user {}", user_id);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to create DM channel for user {}: {:?}", user_id, e);
                        return Err(e);
                    }
                }
            }
            DiscordMessage::ChannelMessage {
                channel_id,
                content,
            } => {
                channel_id.send_message(&self.http, content).await?;
                tracing::info!("Message sent to channel {}", channel_id);
            }
        }
        Ok(())
    }
}

impl EventHandler {
    pub async fn handle_event(&self, entity: Entity) {
        if let Some(event) = self.parse_event(entity) {
            self.event_sender.send(event).await.unwrap();
        }
    }

    pub fn parse_event(&self, entity: Entity) -> Option<GameEventData> {
        entity
            .models
            .iter()
            .find_map(|model| match model.name.as_str() {
                "eternum-BattleStartData" => self.parse_battle_start(model),
                "eternum-BattleJoinData" => self.parse_battle_join(model),
                "eternum-BattleLeaveData" => self.parse_battle_leave(model),
                "eternum-BattleClaimData" => self.parse_battle_claim(model),
                "eternum-BattlePillageData" => self.parse_battle_pillage(model),
                "eternum-SettleRealmData" => self.parse_settle_realm(model),
                _ => {
                    tracing::warn!("Unknown model name: {}", model.name); // Add this line for debugging
                    None
                }
            })
    }

    fn parse_battle_start(&self, model: &dojo_types::schema::Struct) -> Option<GameEventData> {
        // ... Parse BattleStart event
        let id = self.extract_u32(&model.children[0]);
        let event_id = self.extract_u32(&model.children[1]);
        let battle_entity_id = self.extract_u32(&model.children[2]);
        let attacker = self.extract_address(&model.children[3]).unwrap();
        let attacker_name = self.extract_string(&model.children[4]);
        let attacker_army_entity_id = self.extract_u32(&model.children[5]);
        let defender_name = self.extract_string(&model.children[6]);
        let defender = self.extract_address(&model.children[7]).unwrap();
        let defender_army_entity_id = self.extract_u32(&model.children[8]);
        let duration_left = self.extract_u64(&model.children[9]);
        let x = self.extract_u32(&model.children[10]);
        let y = self.extract_u32(&model.children[11]);
        let structure_type = self.extract_string(&model.children[12]);

        Some(GameEventData::BattleStart(BattleStart {
            id,
            event_id,
            battle_entity_id,
            attacker,
            attacker_name,
            attacker_army_entity_id,
            defender,
            defender_name,
            defender_army_entity_id,
            duration_left,
            position: Position::new(x, y),
            structure_type,
        }))
    }

    fn parse_battle_join(&self, model: &dojo_types::schema::Struct) -> Option<GameEventData> {
        // ... Parse BattleJoin event
        let id = self.extract_u32(&model.children[0]);
        let event_id = self.extract_u32(&model.children[1]);
        let battle_entity_id = self.extract_u32(&model.children[2]);

        let joiner = self.extract_address(&model.children[3]).unwrap();
        let joiner_name = self.extract_string(&model.children[4]);
        let joiner_army_entity_id = self.extract_u32(&model.children[5]);
        let joiner_side = self.extract_string(&model.children[6]);
        let duration_left = self.extract_u64(&model.children[7]);
        let x = self.extract_u32(&model.children[8]);
        let y = self.extract_u32(&model.children[9]);

        Some(GameEventData::BattleJoin(BattleJoin {
            id,
            event_id,
            battle_entity_id,
            joiner,
            joiner_name,
            joiner_army_entity_id,
            joiner_side,
            duration_left,
            position: Position::new(x, y),
        }))
    }

    fn parse_battle_leave(&self, model: &dojo_types::schema::Struct) -> Option<GameEventData> {
        // ... Parse BattleLeave event
        let id = self.extract_u32(&model.children[0]);
        let event_id = self.extract_u32(&model.children[1]);
        let battle_entity_id = self.extract_u32(&model.children[2]);
        let leaver = self.extract_address(&model.children[3]).unwrap();
        let leaver_name = self.extract_string(&model.children[4]);
        let leaver_army_entity_id = self.extract_u32(&model.children[5]);
        let leaver_side = self.extract_string(&model.children[6]);

        let duration_left = self.extract_u64(&model.children[7]);
        let x = self.extract_u32(&model.children[8]);
        let y = self.extract_u32(&model.children[9]);
        Some(GameEventData::BattleLeave(BattleLeave {
            id,
            event_id,
            battle_entity_id,
            leaver,
            leaver_name,
            leaver_army_entity_id,
            leaver_side,
            duration_left,
            position: Position::new(x, y),
        }))
    }

    fn parse_battle_claim(&self, model: &dojo_types::schema::Struct) -> Option<GameEventData> {
        // ... Parse BattleClaim event
        let id = self.extract_u32(&model.children[0]);
        let event_id = self.extract_u32(&model.children[1]);
        let structure_entity_id = self.extract_u32(&model.children[2]);
        let claimer = self.extract_address(&model.children[3]).unwrap();
        let claimer_name = self.extract_string(&model.children[4]);
        let claimer_army_entity_id = self.extract_u32(&model.children[5]);
        let previous_owner = self.extract_address(&model.children[6]).unwrap();
        let x = self.extract_u32(&model.children[7]);
        let y = self.extract_u32(&model.children[8]);
        let structure_type = self.extract_string(&model.children[9]);
        Some(GameEventData::BattleClaim(BattleClaim {
            id,
            event_id,
            structure_entity_id,
            claimer,
            claimer_name,
            claimer_army_entity_id,
            previous_owner,
            position: Position::new(x, y),
            structure_type,
        }))
    }

    fn parse_battle_pillage(&self, model: &dojo_types::schema::Struct) -> Option<GameEventData> {
        tracing::info!("Model: {:?}", model);
        // ... Parse BattlePillage event
        let id = self.extract_u32(&model.children[0]);
        let event_id = self.extract_u32(&model.children[1]);
        let pillager = self.extract_address(&model.children[2]).unwrap();
        let pillager_name: String = self.extract_string(&model.children[3]);
        let pillager_realm_entity_id = self.extract_u32(&model.children[4]);
        let pillager_army_entity_id = self.extract_u32(&model.children[5]);
        let pillaged_structure_owner = self.extract_address(&model.children[6])?;
        let pillaged_structure_entity_id = self.extract_u32(&model.children[7]);
        let winner = self.extract_address(&model.children[8]).unwrap();
        let x = self.extract_u32(&model.children[9]);
        let y = self.extract_u32(&model.children[10]);
        let structure_type = self.extract_string(&model.children[11]);

        let pillaged_resources = model
            .children
            .iter()
            .skip(8)
            .map(|member| {
                let resource_id = self.extract_u32(member);
                let amount = self.extract_u64(member) as u128;
                (resource_id as u8, amount)
            })
            .collect::<Vec<(u8, u128)>>();

        Some(GameEventData::BattlePillage(BattlePillage {
            id,
            event_id,
            pillager,
            pillager_name,
            pillager_realm_entity_id,
            pillager_army_entity_id,
            pillaged_structure_owner,
            pillaged_structure_entity_id,
            winner,
            position: Position::new(x, y),
            structure_type,
            pillaged_resources,
        }))
    }

    fn parse_settle_realm(&self, model: &dojo_types::schema::Struct) -> Option<GameEventData> {
        tracing::info!("Model: {:?}", model);
        // ... Parse SettleRealm event
        let id = self.extract_u32(&model.children[0]);
        let event_id = self.extract_u32(&model.children[1]);
        let entity_id = self.extract_u32(&model.children[2]);
        let owner_name: String = self.extract_string(&model.children[3]);
        let realm_name: String = self.extract_string(&model.children[4]);
        let resource_types_packed = self.extract_u128(&model.children[5]);
        let resource_types_count = self.extract_u8(&model.children[6]);
        let cities = self.extract_u8(&model.children[7]);
        let harbors = self.extract_u8(&model.children[8]);
        let rivers = self.extract_u8(&model.children[9]);
        let regions = self.extract_u8(&model.children[10]);
        let wonder = self.extract_u8(&model.children[11]);
        let order = self.extract_u8(&model.children[12]);
        let x = self.extract_u32(&model.children[13]);
        let y = self.extract_u32(&model.children[14]);
        let timestamp = self.extract_u64(&model.children[15]);

        Some(GameEventData::SettleRealm(SettleRealm {
            id,
            event_id,
            entity_id,
            owner_name,
            realm_name,
            resource_types_packed,
            resource_types_count,
            cities,
            harbors,
            rivers,
            regions,
            wonder,
            order,
            position: Position::new(x, y),
            timestamp,
        }))
    }

    fn extract_address(&self, member: &dojo_types::schema::Member) -> Option<String> {
        if let dojo_types::schema::Ty::Primitive(ContractAddress(Some(address))) = &member.ty {
            Some(format!("0x{:x}", address))
        } else {
            None
        }
    }

    fn extract_u8(&self, member: &dojo_types::schema::Member) -> u8 {
        member
            .ty
            .as_primitive()
            .and_then(|p| p.as_u8())
            .unwrap_or(0)
    }

    fn extract_u32(&self, member: &dojo_types::schema::Member) -> u32 {
        member
            .ty
            .as_primitive()
            .and_then(|p| p.as_u32())
            .unwrap_or(0)
    }

    fn extract_u64(&self, member: &dojo_types::schema::Member) -> u64 {
        member
            .ty
            .as_primitive()
            .and_then(|p| p.as_u64())
            .unwrap_or(0)
    }

    fn extract_u128(&self, member: &dojo_types::schema::Member) -> u128 {
        member
            .ty
            .as_primitive()
            .and_then(|p| p.as_u128())
            .unwrap_or(0)
    }

    fn extract_string(&self, member: &dojo_types::schema::Member) -> String {
        member
            .ty
            .as_primitive()
            .and_then(|p| p.as_felt252())
            .map(|felt| {
                parse_cairo_short_string(&felt).expect("Failed to parse Cairo short string")
            })
            .unwrap_or_else(|| {
                parse_cairo_short_string(&Felt::default())
                    .expect("Failed to parse default Cairo short string")
            })
    }
}

#[derive(Deserialize, Debug, Clone)]
pub struct Config {
    pub discord_token: String,
    pub channel_id: NonZero<u64>,
    pub torii_url: String,
    pub node_url: String,
    pub torii_relay_url: String,
    pub world_address: String,
}

impl Config {
    pub fn from_secrets(secret_store: SecretStore) -> eyre::Result<Self> {
        let discord_token = secret_store.get("DISCORD_TOKEN").unwrap();
        let channel_id = NonZero::new(
            secret_store
                .get("CHANNEL_ID")
                .ok_or_eyre("channel id not set")?
                .parse::<u64>()?,
        )
        .ok_or_eyre("Failed to convert string to non zero")?;
        let torii_url = secret_store.get("TORII_URL").unwrap();
        let node_url = secret_store.get("NODE_URL").unwrap();
        let torii_relay_url = secret_store.get("TORII_RELAY_URL").unwrap();
        let world_address = secret_store.get("WORLD_ADDRESS").unwrap();

        let config = Config {
            discord_token,
            channel_id,
            torii_url,
            node_url,
            torii_relay_url,
            world_address,
        };

        Ok(config)
    }
}

#[derive(FromRow)]
pub struct User {
    pub address: String,
    pub discord: Option<String>,
    pub telegram: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
