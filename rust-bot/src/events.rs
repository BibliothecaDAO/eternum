use std::time::Duration;

use serenity::{
    all::{CreateEmbed, CreateEmbedFooter, CreateMessage, Timestamp},
    model::id::ChannelId,
};

use crate::{
    constants::ETERNUM_URL,
    types::{DiscordMessage, DiscordMessageType},
};

pub trait ToDiscordMessage {
    fn to_discord_message(&self, msg_type: DiscordMessageType, user_id: u64) -> DiscordMessage;
}

#[allow(dead_code)]
pub(crate) struct BattleStart {
    pub id: u32,
    pub event_id: u32,
    pub battle_entity_id: u32,
    pub attacker: String,
    pub attacker_name: String,
    pub attacker_army_entity_id: u32,
    pub defender: String,
    pub defender_name: String,
    pub defender_army_entity_id: u32,
    pub duration_left: u64,
    pub x: u32,
    pub y: u32,
    pub structure_type: String,
}

impl ToDiscordMessage for BattleStart {
    fn to_discord_message(&self, msg_type: DiscordMessageType, user_id: u64) -> DiscordMessage {
        let duration_string = duration_to_string(self.duration_left);

        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has attacked {} at ({}, {})",
                self.attacker_name, self.defender_name, self.x, self.y
            ))
            .description(format!("Battle will end in {} seconds", duration_string))
            .image("attachment://ferris_eyes.png")
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content(format!("<@{}> BATTLE STARTED!", user_id))
            .embed(embed.clone());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => DiscordMessage::ChannelMessage {
                channel_id: ChannelId::from(channel_id),
                content,
            },
            DiscordMessageType::DirectMessage => DiscordMessage::DirectMessage { user_id, content },
        }
    }
}

#[allow(dead_code)]
pub(crate) struct BattleJoin {
    pub id: u32,
    pub event_id: u32,
    pub battle_entity_id: u32,
    pub joiner: String,
    pub joiner_name: String,
    pub joiner_army_entity_id: u32,
    pub joiner_side: String,
    pub duration_left: u64,
    pub x: u32,
    pub y: u32,
}

impl ToDiscordMessage for BattleJoin {
    fn to_discord_message(&self, msg_type: DiscordMessageType, user_id: u64) -> DiscordMessage {
        let duration_string = duration_to_string(self.duration_left);

        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has joined the battle at ({}, {})",
                self.joiner_name, self.x, self.y
            ))
            .description(format!("Battle will end in {} seconds", duration_string))
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("BATTLE JOINED!")
            .embed(embed.clone());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => DiscordMessage::ChannelMessage {
                channel_id: ChannelId::from(channel_id),
                content,
            },
            DiscordMessageType::DirectMessage => DiscordMessage::DirectMessage { user_id, content },
        }
    }
}

#[allow(dead_code)]
pub(crate) struct BattleLeave {
    pub id: u32,
    pub event_id: u32,
    pub battle_entity_id: u32,
    pub leaver: String,
    pub leaver_name: String,
    pub leaver_army_entity_id: u32,
    pub leaver_side: String,
    pub duration_left: u64,
    pub x: u32,
    pub y: u32,
}

impl ToDiscordMessage for BattleLeave {
    fn to_discord_message(&self, msg_type: DiscordMessageType, user_id: u64) -> DiscordMessage {
        let duration_string = duration_to_string(self.duration_left);

        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has left the battle at ({}, {})",
                self.leaver_name, self.x, self.y
            ))
            .description(format!("Battle will end in {} seconds", duration_string))
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("BATTLE LEFT!")
            .embed(embed.clone());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => DiscordMessage::ChannelMessage {
                channel_id: ChannelId::from(channel_id),
                content,
            },
            DiscordMessageType::DirectMessage => DiscordMessage::DirectMessage { user_id, content },
        }
    }
}

#[allow(dead_code)]
pub(crate) struct BattleClaim {
    pub id: u32,
    pub event_id: u32,
    pub structure_entity_id: u32,
    pub claimer: String,
    pub claimer_name: String,
    pub claimer_army_entity_id: u32,
    pub previous_owner: String,
    pub x: u32,
    pub y: u32,
    pub structure_type: String,
}

impl ToDiscordMessage for BattleClaim {
    fn to_discord_message(&self, msg_type: DiscordMessageType, user_id: u64) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has claimed a structure at ({}, {})",
                self.claimer_name, self.x, self.y
            ))
            .description(format!("Structure type: {}", self.structure_type))
            .color(poise::serenity_prelude::Color::RED)
            .footer(footer)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("STRUCTURE CLAIMED!")
            .embed(embed.clone());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => DiscordMessage::ChannelMessage {
                channel_id: ChannelId::from(channel_id),
                content,
            },
            DiscordMessageType::DirectMessage => DiscordMessage::DirectMessage { user_id, content },
        }
    }
}

#[allow(dead_code)]
pub(crate) struct BattlePillage {
    pub id: u32,
    pub event_id: u32,
    pub pillager: String,
    pub pillager_name: String,
    pub pillager_army_entity_id: u32,
    pub pillaged_structure_owner: String,
    pub pillaged_structure_entity_id: u32,
    pub winner: String,
    pub x: u32,
    pub y: u32,
    pub structure_type: String,
    pub pillaged_resources: Vec<(u8, u128)>,
}

impl ToDiscordMessage for BattlePillage {
    fn to_discord_message(&self, msg_type: DiscordMessageType, user_id: u64) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has pillaged a structure at ({}, {})",
                self.pillager_name, self.x, self.y
            ))
            .description(format!(
                "Pillaged resources: {:?}\nStructure type: {}",
                self.pillaged_resources, self.structure_type
            ))
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("STRUCTURE PILLAGED!")
            .embed(embed.clone());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => DiscordMessage::ChannelMessage {
                channel_id: ChannelId::from(channel_id),
                content,
            },
            DiscordMessageType::DirectMessage => DiscordMessage::DirectMessage { user_id, content },
        }
    }
}

#[allow(dead_code)]
pub(crate) struct SettleRealm {
    pub id: u32,
    pub event_id: u32,
    pub owner_name: String,
    pub realm_name: String,
    pub resource_types_packed: u128,
    pub resource_types_count: u8,
    pub cities: u8,
    pub harbors: u8,
    pub rivers: u8,
    pub regions: u8,
    pub wonder: u8,
    pub order: u8,
    pub x: u32,
    pub y: u32,
    pub timestamp: u64,
}

impl ToDiscordMessage for SettleRealm {
    fn to_discord_message(&self, msg_type: DiscordMessageType, user_id: u64) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has settled a realm at ({}, {})",
                self.owner_name, self.x, self.y
            ))
            .description("GLHF")
            .footer(footer)
            .color(poise::serenity_prelude::Color::BLURPLE)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("A new Realm has been settled!")
            .embed(embed.clone());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => DiscordMessage::ChannelMessage {
                channel_id: ChannelId::from(channel_id),
                content,
            },
            DiscordMessageType::DirectMessage => DiscordMessage::DirectMessage { user_id, content },
        }
    }
}

fn duration_to_string(duration: u64) -> String {
    let duration = Duration::from_secs(duration);
    let hours = duration.as_secs() / 3600;
    let minutes = (duration.as_secs() % 3600) / 60;
    let seconds = duration.as_secs() % 60;
    format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
}
