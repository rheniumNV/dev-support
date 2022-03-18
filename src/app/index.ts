import NotionClient from "../lib/notion/client";
import DiscordClient from "../lib/discord/client";
import MembersDatabase from "../membersDatabase";

export default abstract class App {
  isEmpty: boolean = false;
  notionClient: NotionClient = new NotionClient({});
  discordClient: DiscordClient = new DiscordClient({});
  appName: string;
  tasksDatabaseId: string;
  discordGuildId: string;
  membersDatabase: MembersDatabase;

  constructor(init: {
    appName: string;
    tasksDatabaseId: string;
    discordClient: DiscordClient;
    discordGuildId: string;
    membersDatabase: MembersDatabase;
  }) {
    this.appName = init.appName;
    this.tasksDatabaseId = init.tasksDatabaseId;
    this.discordGuildId = init.discordGuildId;
    this.discordClient = init.discordClient;
    this.membersDatabase = init.membersDatabase;
  }

  abstract setup(init: {
    clients: { notionClient: NotionClient; discordClient: DiscordClient };
    tasksDatabaseId: string;
    discordGuildId: string;
  }): Promise<void>;

  abstract update(): Promise<void>;
}

export class EmptyApp extends App {
  isEmpty: boolean = true;

  async setup(): Promise<void> {}

  async update(): Promise<void> {}
}
