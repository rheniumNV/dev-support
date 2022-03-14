import {
  Message,
  Client,
  Awaitable,
  Intents,
  TextChannel,
  AnyChannel,
  CommandInteraction,
  ButtonInteraction,
} from "discord.js";
import _ from "lodash";

function isTextChannel(
  channel: undefined | AnyChannel
): channel is TextChannel {
  return _.has(channel, "send") !== undefined;
}

function isCommandInteraction(
  interaction: CommandInteraction | ButtonInteraction
): interaction is CommandInteraction {
  return _.has(interaction, "commandName") !== undefined;
}

export default class DiscordClient {
  private client: Client = new Client({
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MEMBERS,
      Intents.FLAGS.GUILD_MESSAGES,
    ],
  });

  public login(token: string) {
    this.client.login(token);
  }

  public onceReady(func: (client: Client<true>) => Awaitable<void>) {
    this.client.once("ready", func);
  }

  public onMessageCreate(func: (message: Message) => Awaitable<void>) {
    this.client.on("messageCreate", func);
  }

  public async setSlashCommandGuild(
    data: [] | [{ name: string; description: string }],
    guildId: string
  ) {
    await this.client.guilds.cache.get(guildId)?.commands.set(data);
    // await this.client.application?.commands.set(data, guildId);
  }

  public async createCommand(
    command: { name: string; description: string },
    guildId: string
  ) {
    const guild = this.client.guilds.cache.get(guildId);
    guild?.commands.create(command);
  }

  public onCommandInteractionCreate(
    func: (commandInteraction: CommandInteraction) => Awaitable<void>
  ) {
    // @ts-ignore
    this.client.on(
      "interactionCreate",
      (interaction: CommandInteraction | ButtonInteraction) => {
        if (isCommandInteraction(interaction)) {
          func(interaction);
        }
      }
    );
  }

  public onButtonInteractionCreate(
    func: (commandInteraction: ButtonInteraction) => Awaitable<void>
  ) {
    // @ts-ignore
    this.client.on(
      "interactionCreate",
      (interaction: CommandInteraction | ButtonInteraction) => {
        if (!isCommandInteraction(interaction)) {
          func(interaction);
        }
      }
    );
  }

  public sendMessage(channelId: string, message: string) {
    const channel = this.client.channels.cache.get(channelId);
    if (!isTextChannel(channel)) {
      throw new Error("channel is not TextChannel");
    }

    channel.send(message);
  }

  public interaction() {}
}
