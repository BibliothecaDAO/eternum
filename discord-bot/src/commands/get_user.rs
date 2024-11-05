use crate::init::Context;
use crate::init::Error;
use crate::types::User;

#[poise::command(slash_command)]
pub async fn get_user(
    ctx: Context<'_>,
    #[description = "User's address"] address: String,
) -> Result<(), Error> {
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE address = $1")
        .bind(address)
        .fetch_optional(&ctx.data().database)
        .await?;

    match user {
        Some(user) => {
            let response = format!(
                "User found:\nAddress: {}\nDiscord: {}\nTelegram: {}\nCreated at: {}\nUpdated at: {}",
                user.address,
                user.discord.unwrap_or_else(|| "Not set".to_string()),
                user.telegram.unwrap_or_else(|| "Not set".to_string()),
                user.created_at,
                user.updated_at
            );
            ctx.say(response).await?;
        }
        None => {
            ctx.say("User not found.").await?;
        }
    }
    Ok(())
}
