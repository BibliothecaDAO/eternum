use crate::Context;
use crate::Error;

#[poise::command(slash_command)]
pub async fn add_user(
    ctx: Context<'_>,
    #[description = "User's address"] address: String,
    #[description = "Telegram username"] telegram: Option<String>,
) -> Result<(), Error> {
    let discord_id = ctx.author().id.to_string();

    println!("Adding user: {} {}", address, discord_id);

    sqlx::query!(
        "INSERT INTO users (address, discord, telegram) VALUES (?, ?, ?)",
        address,
        discord_id,
        telegram,
    )
    .execute(&ctx.data().database)
    .await?;

    ctx.say("User added successfully!").await?;
    Ok(())
}
