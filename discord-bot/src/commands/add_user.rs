use crate::init::Context;
use crate::init::Error;

#[poise::command(slash_command)]
pub async fn add_user(
    ctx: Context<'_>,
    #[description = "User's address"] address: String,
    #[description = "Telegram username"] telegram: Option<String>,
) -> Result<(), Error> {
    let discord_id = ctx.author().id.to_string();

    tracing::info!("Adding user: {} {}", address, discord_id);

    sqlx::query("INSERT INTO users (address, discord, telegram) VALUES ($1, $2, $3)")
        .bind(address)
        .bind(discord_id)
        .bind(telegram)
        .execute(&ctx.data().database)
        .await?;

    ctx.say("User added successfully!").await?;
    Ok(())
}
