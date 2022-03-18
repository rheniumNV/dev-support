import NotionClient from "./lib/notion/client";
import DiscordClient from "./lib/discord/client";
import NotionDatabase from "./lib/notion/notionDatabase";
import {
  NotionDatabasePropTitleString,
  NotionDatabasePropRichTextMentionList,
  NotionDatabasePropSelect,
} from "./lib/notion/notionDatabase/notionDatabaseProp";
import App from "./app";
import RemindNotificationApp from "./app/remindNotification";
import MembersDatabase from "./membersDatabase";

class AppConfigListDatabase extends NotionDatabase {
  props = {
    appName: new NotionDatabasePropTitleString("appName"),
    appCode: new NotionDatabasePropSelect("appCode"),
    tasksDatabaseLinks: new NotionDatabasePropRichTextMentionList(
      "tasksDatabaseLinks"
    ),
  };
}

type TAppTask = {
  id: string;
  app: App;
  arg: {
    clients: { notionClient: NotionClient; discordClient: DiscordClient };
    tasksDatabaseId: string;
    discordGuildId: string;
  };
};

export default class Project {
  name: string;
  appConfigListDatabase: AppConfigListDatabase;
  membersDatabase: MembersDatabase;
  apps: Array<TAppTask>;
  notionClient: NotionClient;
  discordClient: DiscordClient;
  discordGuildId: string;

  constructor(init: {
    name: string;
    notionClient: NotionClient;
    discordClient: DiscordClient;
    appConfigListDatabaseId: string;
    membersDatabaseId: string;
    discordGuildId: string;
  }) {
    this.apps = [];
    this.name = init.name;
    this.notionClient = init.notionClient;
    this.discordClient = init.discordClient;
    this.appConfigListDatabase = new AppConfigListDatabase({
      notionClient: init.notionClient,
      rawId: init.appConfigListDatabaseId,
    });
    this.membersDatabase = new MembersDatabase({
      notionClient: init.notionClient,
      rawId: init.membersDatabaseId,
    });
    this.discordGuildId = init.discordGuildId;
  }

  async setup() {
    await this.membersDatabase.list();

    this.apps = (await this.appConfigListDatabase.list())
      .map((table) => {
        const appCode = table.props.appCode.value?.name;
        const appName = table.props.appName.value;
        const tasksDatabaseIds = table.props.tasksDatabaseLinks.value.map(
          ({ target }) => target
        );

        switch (appCode) {
          case "remindNotification":
            return tasksDatabaseIds.map((tasksDatabaseId, index) => ({
              id: `${table.id}-${index}`,
              app: new RemindNotificationApp({
                appName,
                tasksDatabaseId,
                discordClient: this.discordClient,
                discordGuildId: this.discordGuildId,
                membersDatabase: this.membersDatabase,
              }),
              arg: {
                clients: {
                  notionClient: this.notionClient,
                  discordClient: this.discordClient,
                },
                tasksDatabaseId,
                discordGuildId: this.discordGuildId,
              },
            }));
          default:
            return [];
        }
      })
      .flatMap((v) => v);
    await Promise.all(
      this.apps.map(async ({ app, arg }) => await app.setup(arg))
    );
  }

  async update() {
    await Promise.all(this.apps.map(async ({ app }) => await app.update()));
  }
}
