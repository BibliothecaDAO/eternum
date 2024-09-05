use std::sync::Arc;

use dojo_types::primitive::Primitive::ContractAddress;
use serde::Deserialize;
use serenity::{
    all::{CreateEmbed, CreateEmbedFooter, CreateMessage, Timestamp, UserId},
    model::id::ChannelId,
};
use shuttle_runtime::SecretStore;
use sqlx::{prelude::FromRow, PgPool};
use starknet_crypto::Felt;
use tokio::sync::mpsc;
use torii_grpc::types::schema::Entity;

use starknet::core::utils::parse_cairo_short_string;

use crate::check_user_in_database;

// Event types
#[allow(dead_code)]
pub enum GameEvent {
    BattleStart {
        id: u32,
        event_id: u32,
        battle_entity_id: u32,
        attacker: String,
        attacker_name: String,
        attacker_army_entity_id: u32,
        defender: String,
        defender_name: String,
        defender_army_entity_id: u32,
        duration_left: u64,
        x: u32,
        y: u32,
        structure_type: String,
    },
    BattleJoin {
        id: u32,
        event_id: u32,
        battle_entity_id: u32,
        joiner: String,
        joiner_name: String,
        joiner_army_entity_id: u32,
        joiner_side: String,
        duration_left: u64,
        x: u32,
        y: u32,
    },
    BattleLeave {
        id: u32,
        event_id: u32,
        battle_entity_id: u32,
        leaver: String,
        leaver_name: String,
        leaver_army_entity_id: u32,
        leaver_side: String,
        duration_left: u64,
        x: u32,
        y: u32,
    },
    BattleClaim {
        id: u32,
        event_id: u32,
        structure_entity_id: u32,
        claimer: String,
        claimer_name: String,
        claimer_army_entity_id: u32,
        previous_owner: String,
        x: u32,
        y: u32,
        structure_type: String,
    },
    BattlePillage {
        id: u32,
        event_id: u32,
        pillager: String,
        pillager_name: String,
        pillager_army_entity_id: u32,
        pillaged_structure_owner: String,
        pillaged_structure_entity_id: u32,
        winner: String,
        x: u32,
        y: u32,
        structure_type: String,
        pillaged_resources: Vec<(u8, u128)>,
    },
}

// Message types
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
    pub event_sender: mpsc::Sender<GameEvent>,
}

impl MessageDispatcher {
    pub async fn run(&mut self) {
        while let Some(message) = self.message_receiver.recv().await {
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

                        if let Err(e) = channel.send_message(&self.http, content).await {
                            tracing::error!("Failed to send DM: {:?}", e);
                        }

                        // channel.say(&self.http, content).await?;
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

pub async fn process_event(
    event: GameEvent,
    database: &PgPool,
    message_sender: &mpsc::Sender<DiscordMessage>,
) {
    match event {
        GameEvent::BattleStart {
            id: _,
            event_id: _,
            battle_entity_id: _,
            attacker: _,
            attacker_name,
            attacker_army_entity_id: _,
            defender,
            defender_name,
            defender_army_entity_id: _,
            duration_left,
            x,
            y,
            structure_type: _,
        } => {
            tracing::info!("BattleStart event: {:?}", defender);
            if let Ok(Some(Some(discord_id))) = check_user_in_database(database, &defender).await {
                tracing::info!("User found in the database: {}", discord_id);
                if let Ok(user_id) = discord_id.parse::<u64>() {
                    let footer = CreateEmbedFooter::new("https://alpha-eternum.realms.world/");
                    let embed = CreateEmbed::new()
                        .title(format!(
                            "{} has attacked {} at ({}, {})",
                            attacker_name, defender_name, x, y
                        ))
                        .description(format!("Battle will end in {} seconds", duration_left))
                        .image("attachment://ferris_eyes.png")
                        .footer(footer)
                        .color(poise::serenity_prelude::Color::RED)
                        .timestamp(Timestamp::now());

                    let content = CreateMessage::new()
                        .content(format!("<@{}> BATTLE STARTED!", user_id))
                        .embed(embed.clone());

                    let message = DiscordMessage::DirectMessage { user_id, content };

                    let channel_message = DiscordMessage::ChannelMessage {
                        channel_id: ChannelId::from(1275439254444441703),
                        content: CreateMessage::new().content("BATTLE STARTED!").embed(embed),
                    };

                    message_sender.send(message).await.unwrap();

                    message_sender.send(channel_message).await.unwrap();
                }
            }
        }
        GameEvent::BattleLeave {
            id: _,
            event_id: _,
            battle_entity_id: _,
            leaver,
            leaver_name,
            leaver_army_entity_id: _,
            leaver_side: _,
            duration_left,
            x,
            y,
        } => {
            tracing::info!("BattleLeave event: {:?}", leaver);
            if let Ok(Some(Some(discord_id))) = check_user_in_database(database, &leaver).await {
                tracing::info!("User found in the database: {}", discord_id);
                if let Ok(user_id) = discord_id.parse::<u64>() {
                    let footer = CreateEmbedFooter::new("https://alpha-eternum.realms.world/");
                    let embed = CreateEmbed::new()
                        .title(format!(
                            "{} has left the battle at ({}, {})",
                            leaver_name, x, y
                        ))
                        .description(format!("Battle will end in {} seconds", duration_left))
                        .footer(footer)
                        .timestamp(Timestamp::now());

                    let content = CreateMessage::new()
                        .content("BATTLE LEFT!")
                        .embed(embed.clone());

                    let message = DiscordMessage::DirectMessage { user_id, content };

                    let channel_message = DiscordMessage::ChannelMessage {
                        channel_id: ChannelId::from(1275439254444441703),
                        content: CreateMessage::new().content("BATTLE LEFT!").embed(embed),
                    };

                    message_sender.send(message).await.unwrap();

                    message_sender.send(channel_message).await.unwrap();
                }
            }
        }
        GameEvent::BattlePillage {
            id: _,
            event_id: _,
            pillager: _,
            pillager_name,
            pillager_army_entity_id: _,
            pillaged_structure_owner,
            pillaged_structure_entity_id: _,
            winner: _,
            x,
            y,
            structure_type,
            pillaged_resources,
        } => {
            tracing::info!("BattlePillage event: {:?}", pillaged_structure_owner);
            if let Ok(Some(Some(discord_id))) =
                check_user_in_database(database, &pillaged_structure_owner).await
            {
                if let Ok(user_id) = discord_id.parse::<u64>() {
                    let footer = CreateEmbedFooter::new("https://alpha-eternum.realms.world/");
                    let embed = CreateEmbed::new()
                        .title(format!(
                            "{} has pillaged a structure at ({}, {})",
                            pillager_name, x, y
                        ))
                        .description(format!(
                            "Pillaged resources: {:?}\nStructure type: {}",
                            pillaged_resources, structure_type
                        ))
                        .footer(footer)
                        .color(poise::serenity_prelude::Color::RED)
                        .timestamp(Timestamp::now());

                    let content = CreateMessage::new()
                        .content("STRUCTURE PILLAGED!")
                        .embed(embed.clone());

                    let message = DiscordMessage::DirectMessage { user_id, content };

                    let channel_message = DiscordMessage::ChannelMessage {
                        channel_id: ChannelId::from(1275439254444441703),
                        content: CreateMessage::new()
                            .content("STRUCTURE PILLAGED!")
                            .embed(embed),
                    };

                    message_sender.send(message).await.unwrap();

                    message_sender.send(channel_message).await.unwrap();
                }
            }
        }
        GameEvent::BattleJoin {
            id: _,
            event_id: _,
            battle_entity_id: _,
            joiner: _,
            joiner_name: _,
            joiner_army_entity_id: _,
            joiner_side: _,
            duration_left: _,
            x: _,
            y: _,
        } => {
            // ... Process BattleJoin event
        }
        GameEvent::BattleClaim {
            id: _,
            event_id: _,
            structure_entity_id: _,
            claimer: _,
            claimer_name: _,
            claimer_army_entity_id: _,
            previous_owner: _,
            x: _,
            y: _,
            structure_type: _,
        } => {}
    }
}

impl EventHandler {
    pub async fn handle_event(&self, entity: Entity) {
        if let Some(event) = self.parse_event(entity) {
            self.event_sender.send(event).await.unwrap();
        }
    }

    pub fn parse_event(&self, entity: Entity) -> Option<GameEvent> {
        entity
            .models
            .iter()
            .find_map(|model| match model.name.as_str() {
                "eternum-BattleStartData" => self.parse_battle_start(model),
                "eternum-BattleJoinData" => self.parse_battle_join(model),
                "eternum-BattleLeaveData" => self.parse_battle_leave(model),
                "eternum-BattleClaimData" => self.parse_battle_claim(model),
                "eternum-BattlePillageData" => self.parse_battle_pillage(model),
                _ => {
                    tracing::warn!("Unknown model name: {}", model.name); // Add this line for debugging
                    None
                }
            })
    }

    fn parse_battle_start(&self, model: &dojo_types::schema::Struct) -> Option<GameEvent> {
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

        Some(GameEvent::BattleStart {
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
            x,
            y,
            structure_type,
        })
    }

    fn parse_battle_join(&self, model: &dojo_types::schema::Struct) -> Option<GameEvent> {
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

        Some(GameEvent::BattleJoin {
            id,
            event_id,
            battle_entity_id,
            joiner,
            joiner_name,
            joiner_army_entity_id,
            joiner_side,
            duration_left,
            x,
            y,
        })
    }

    fn parse_battle_leave(&self, model: &dojo_types::schema::Struct) -> Option<GameEvent> {
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
        Some(GameEvent::BattleLeave {
            id,
            event_id,
            battle_entity_id,
            leaver,
            leaver_name,
            leaver_army_entity_id,
            leaver_side,
            duration_left,
            x,
            y,
        })
    }

    fn parse_battle_claim(&self, model: &dojo_types::schema::Struct) -> Option<GameEvent> {
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
        Some(GameEvent::BattleClaim {
            id,
            event_id,
            structure_entity_id,
            claimer,
            claimer_name,
            claimer_army_entity_id,
            previous_owner,
            x,
            y,
            structure_type,
        })
    }

    fn parse_battle_pillage(&self, model: &dojo_types::schema::Struct) -> Option<GameEvent> {
        tracing::info!("Model: {:?}", model);
        // ... Parse BattlePillage event
        let id = self.extract_u32(&model.children[0]);
        let event_id = self.extract_u32(&model.children[1]);
        let pillager = self.extract_address(&model.children[2]).unwrap();
        let pillager_name: String = self.extract_string(&model.children[3]);
        let pillager_army_entity_id = self.extract_u32(&model.children[3]);
        let pillaged_structure_owner = self.extract_address(&model.children[4])?;
        let pillaged_structure_entity_id = self.extract_u32(&model.children[5]);
        let winner = self.extract_address(&model.children[6]).unwrap();
        let x = self.extract_u32(&model.children[7]);
        let y = self.extract_u32(&model.children[8]);
        let structure_type = self.extract_string(&model.children[9]);
        let pillaged_resources = model
            .children
            .iter()
            .skip(8)
            .map(|member| {
                let resource_id = self.extract_u32(&member);
                let amount = self.extract_u64(&member) as u128;
                (resource_id as u8, amount)
            })
            .collect::<Vec<(u8, u128)>>();

        Some(GameEvent::BattlePillage {
            id,
            event_id,
            pillager,
            pillager_name,
            pillager_army_entity_id,
            pillaged_structure_owner,
            pillaged_structure_entity_id,
            winner,
            x,
            y,
            structure_type,
            pillaged_resources,
        })
    }

    fn extract_address(&self, member: &dojo_types::schema::Member) -> Option<String> {
        if let dojo_types::schema::Ty::Primitive(ContractAddress(Some(address))) = &member.ty {
            Some(format!("0x{:x}", address))
        } else {
            None
        }
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
    pub torii_url: String,
    pub node_url: String,
    pub torii_relay_url: String,
    pub world_address: String,
}

impl Config {
    pub fn from_secrets(secret_store: SecretStore) -> eyre::Result<Self> {
        let discord_token = secret_store.get("DISCORD_TOKEN").unwrap();
        let torii_url = secret_store.get("TORII_URL").unwrap();
        let node_url = secret_store.get("NODE_URL").unwrap();
        let torii_relay_url = secret_store.get("TORII_RELAY_URL").unwrap();
        let world_address = secret_store.get("WORLD_ADDRESS").unwrap();

        let config = Config {
            discord_token,
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
