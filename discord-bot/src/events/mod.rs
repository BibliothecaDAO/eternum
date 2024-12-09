pub mod battle_claim;
pub mod battle_join;
pub mod battle_leave;
pub mod battle_pillage;
pub mod battle_start;
pub mod game_ended;
pub mod hyperstructure_finished;
pub mod hyperstructure_started;
pub mod settle_realm;

use std::time::Duration;

use crate::types::{DiscordMessage, DiscordMessageType};

pub const UNKNOWN_USER: &str = "Unknown User";

pub trait ToDiscordMessage: Send {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage;
    fn should_send_in_channel_if_no_user_found(&self) -> bool;
}

pub fn duration_to_string(duration: u64) -> String {
    let duration = Duration::from_secs(duration);
    let hours = duration.as_secs() / 3600;
    let minutes = (duration.as_secs() % 3600) / 60;
    let seconds = duration.as_secs() % 60;
    format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
}
