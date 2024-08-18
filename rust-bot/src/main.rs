// mod commands;

use serenity::async_trait;
use serenity::builder::{CreateInteractionResponse, CreateInteractionResponseMessage};
use serenity::model::application::{Command, Interaction};
use serenity::model::prelude::*;
use serenity::prelude::*;

struct Bot {
    database: sqlx::SqlitePool,
}

use poise::serenity_prelude as serenity;
use sqlx::SqlitePool;

struct Data {
    database: SqlitePool,
}

type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;

/// Add a new user to the database
#[poise::command(slash_command)]
async fn add_user(
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

/// Update an existing user in the database
#[poise::command(slash_command)]
async fn update_user(
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

/// Get user information from the database
#[poise::command(slash_command)]
async fn get_user(
    ctx: Context<'_>,
    #[description = "User's address"] address: String,
) -> Result<(), Error> {
    let user = sqlx::query!("SELECT * FROM users WHERE address = ?", address)
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

#[tokio::main]
async fn main() {
    let token = std::env::var("DISCORD_TOKEN").expect("missing DISCORD_TOKEN");
    let database_url = std::env::var("DATABASE_URL").expect("missing DATABASE_URL");
    let intents = serenity::GatewayIntents::non_privileged();

    let database = SqlitePool::connect(&database_url)
        .await
        .expect("Failed to connect to the database");

    let framework = poise::Framework::builder()
        .options(poise::FrameworkOptions {
            commands: vec![add_user(), update_user(), get_user()],
            ..Default::default()
        })
        .setup(|ctx, _ready, framework| {
            Box::pin(async move {
                poise::builtins::register_globally(ctx, &framework.options().commands).await?;
                Ok(Data { database })
            })
        })
        .build();

    let client = serenity::ClientBuilder::new(token, intents)
        .framework(framework)
        .await;
    client.unwrap().start().await.unwrap();
}
