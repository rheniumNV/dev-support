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
  channel: undefined | null | AnyChannel
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

  private token: string | undefined;
  private allowedGuildIds: Array<string> = [];
  private allowAllGuild: boolean = false;

  constructor(init: {
    token?: string;
    allowedGuildIds?: Array<string>;
    allowAllGuild?: boolean;
  }) {
    this.token = init.token;
    this.allowedGuildIds = init.allowedGuildIds ?? [];
    this.allowAllGuild = init.allowAllGuild ?? false;
  }

  public async login(token?: string) {
    if (token) {
      this.token = token;
    }
    await this.client.login(this.token);
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

  public async getUser(userId: string) {
    await this.client.users.fetch(userId);
  }

  public async sendMessage(
    guildId: string,
    channelId: string,
    message: string
  ) {
    if (!this.allowAllGuild && !_.includes(this.allowedGuildIds, guildId)) {
      throw new Error(`guildId is not allowed. guildId=${guildId}`);
    }

    const guild = await this.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);

    if (!channel) {
      throw new Error(`channel is not found. channelId=${channelId}`);
    }

    if (!isTextChannel(channel)) {
      throw new Error(`channel is not TextChannel. channelId=${channelId}`);
    }
    await channel.send(message);
  }

  public interaction() {}
}
