import { Command } from "@sapphire/framework";

import { hc } from "hono/client";
import { AppType, routes } from "..";

export const client = hc<AppType>("http://localhost:7070/");

export class CreateUser extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, description: "Create a new user" });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option.setName("address").setDescription("User's wallet address").setRequired(true),
        )
        .addStringOption((option) =>
          option.setName("telegram").setDescription("User's Telegram username").setRequired(true),
        ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const address = interaction.options.getString("address", true);
    const discordId = interaction.user.id;
    const telegram = interaction.options.getString("telegram", true);

    await interaction.deferReply();

    try {
      await client.users.users.create.$post({ json: { address, discord: discordId, telegram } });
    } catch (error) {
      return interaction.editReply({
        content: "An error occurred while creating the user",
      });
    }

    return interaction.editReply({
      content: `User created with address: ${address}, Discord: ${discordId}, and Telegram: ${telegram}`,
    });
  }
}
