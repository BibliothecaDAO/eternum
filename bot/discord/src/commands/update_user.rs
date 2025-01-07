use crate::init::Context;
use crate::init::Error;

#[poise::command(slash_command)]
pub async fn update_user(
    ctx: Context<'_>,
    #[description = "User's address"] address: String,
    #[description = "New Discord username"] discord: Option<String>,
    #[description = "New Telegram username"] telegram: Option<String>,
) -> Result<(), Error> {
    let mut updates = Vec::new();
    if let Some(discord) = &discord {
        updates.push(("discord", discord.as_str()));
    }
    if let Some(telegram) = &telegram {
        updates.push(("telegram", telegram.as_str()));
    }

    let mut query_parts = Vec::new();
    let mut params: Vec<String> = Vec::new();

    for (field, value) in &updates {
        query_parts.push(format!("{} = ?", field));
        params.push(value.to_string());
    }

    let query = format!(
        "UPDATE users SET {}, updated_at = CURRENT_TIMESTAMP WHERE address = ?",
        query_parts.join(", ")
    );
    params.push(address);

    let mut query = sqlx::query(&query);
    for param in params {
        query = query.bind(param);
    }
    query.execute(&ctx.data().database).await?;

    ctx.say("User updated successfully!").await?;
    Ok(())
}
