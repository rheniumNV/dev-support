import NotionClient from "./lib/notion/client";
import DiscordClient from "./lib/discord/client";

const { NOTION_TOKEN, DISCORD_TOKEN, DISCORD_GUILD_ID } = process.env;

async function main() {
  if (typeof NOTION_TOKEN !== "string") {
    throw new Error(`NOTION_TOKEN is not string.`);
  }
  if (typeof DISCORD_TOKEN !== "string") {
    throw new Error(`DISCORD_TOKEN is not string.`);
  }
  if (typeof DISCORD_GUILD_ID !== "string") {
    throw new Error(`DISCORD_GUILD_ID is not string.`);
  }

  const notionClient = new NotionClient({ token: NOTION_TOKEN });

  const discordClient = new DiscordClient();
  discordClient.onceReady(() => {
    discordClient.setSlashCommandGuild(
      [
        {
          name: "members",
          description: "display notion members",
        },
      ],
      DISCORD_GUILD_ID
    );

    discordClient.onCommandInteractionCreate(async (interaction) => {
      if (interaction.commandName === "members") {
        const members = await notionClient.getMembers();
        const replyMessage = members
          .map(({ name, type }) => `[${type}] ${name}`)
          .join("\n");
        interaction.reply(replyMessage);
      }
    });
  });
  discordClient.login(DISCORD_TOKEN);
}

main();
