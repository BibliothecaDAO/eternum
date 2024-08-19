mod commands;
use ::serenity::futures::StreamExt;
use poise::serenity_prelude as serenity;
use sqlx::SqlitePool;

type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;
use serenity::builder::{CreateAttachment, CreateEmbed, CreateEmbedFooter, CreateMessage};
use serenity::model::Timestamp;
use starknet_crypto::Felt;
use torii_client::client::Client;
use torii_grpc::{
    client::EntityUpdateStreaming,
    types::{schema::Entity, EntityKeysClause, KeysClause},
};

struct Data {
    database: SqlitePool,
}

async fn setup_torii_client(token: String, database: &SqlitePool) {
    let torii_url = "http://0.0.0.0:8080".to_string();
    let rpc_url = "http://0.0.0.0:5050".to_string();
    let relay_url = "/ip4/127.0.0.1/tcp/9090".to_string();
    let world = Felt::from_hex_unchecked(
        "0x5889930b9e39f7138c9a16b4a68725066a53970d03dfda280a9e479e3d8c2ac",
    );

    tokio::spawn(async move {
        let http = serenity::Http::new(&token.clone());
        println!("Setting up Torii client");
        let client = Client::new(torii_url, rpc_url, relay_url, world)
            .await
            .unwrap();

        let mut rcv = client
            .on_event_message_updated(vec![EntityKeysClause::Keys(KeysClause {
                keys: vec![],
                pattern_matching: torii_grpc::types::PatternMatching::VariableLen,
                models: vec!["eternum-EternumEvent".to_string()],
            })])
            .await
            .unwrap();

        println!("Torii client setup");
        while let Some(Ok((_, entity))) = rcv.next().await {
            println!("Received Dojo entity: {:?}", entity);

            if let Some(user) = http.get_user(340080285993664512.into()).await.ok() {
                let dm_channel = user.create_dm_channel(&http).await;
                if let Ok(channel) = dm_channel {
                    let _ = channel.say(&http, "Received Dojo entity").await;

                    let footer = CreateEmbedFooter::new("This is a footer");
                    let embed = CreateEmbed::new()
                        .title("This is a title")
                        .description("This is a description")
                        .image("attachment://ferris_eyes.png")
                        .fields(vec![
                            ("This is the first field", "This is a field body", true),
                            ("This is the second field", "Both fields are inline", true),
                        ])
                        .field(
                            "This is the third field",
                            "This is not an inline field",
                            false,
                        )
                        .footer(footer)
                        // Add a timestamp for the current time
                        // This also accepts a rfc3339 Timestamp
                        .timestamp(Timestamp::now());
                    let builder = CreateMessage::new()
                        .content("Hello, World!")
                        .embed(embed)
                        .add_file(CreateAttachment::path("./ferris_eyes.png").await.unwrap());

                    let msg = channel.send_message(&http, builder).await;

                    if let Err(why) = msg {
                        println!("Error sending message: {why:?}");
                    }
                }
            }
        }
    });

    println!("Torii client setup task spawned");
}

#[tokio::main]
async fn main() {
    let token = std::env::var("DISCORD_TOKEN").expect("missing DISCORD_TOKEN");
    let token_clone = token.clone();
    let database_url = std::env::var("DATABASE_URL").expect("missing DATABASE_URL");
    let intents = serenity::GatewayIntents::non_privileged();

    let database = SqlitePool::connect(&database_url)
        .await
        .expect("Failed to connect to the database");

    let framework = poise::Framework::builder()
        .options(poise::FrameworkOptions {
            commands: vec![
                commands::add_user::add_user(),
                commands::update_user::update_user(),
                commands::get_user::get_user(),
            ],
            ..Default::default()
        })
        .setup(|ctx, _ready, framework| {
            Box::pin(async move {
                poise::builtins::register_globally(ctx, &framework.options().commands).await?;
                setup_torii_client(token_clone, &database).await;
                Ok(Data { database })
            })
        })
        .build();

    let client = serenity::ClientBuilder::new(token, intents)
        .framework(framework)
        .await;
    client.unwrap().start().await.unwrap();
}
