import DiscordClient from "../../lib/discord/client";
import NotionClient from "../../lib/notion/client";
import NotionDatabase from "../../lib/notion/notionDatabase";
import {
  NotionDatabasePropRichTextMentionList,
  NotionDatabasePropRichTextString,
  NotionDatabasePropTitleString,
} from "../../lib/notion/notionDatabase/notionDatabaseProp";
import App from "..";
import RemindNotificationTask from "./remindNotificationTask";
import _ from "lodash";

class RemindNotificationTasksDatabase extends NotionDatabase {
  props = {
    title: new NotionDatabasePropTitleString("title"),
    targetDatabaseLinks: new NotionDatabasePropRichTextMentionList(
      "targetDatabaseLinks"
    ),
    FnMessage: new NotionDatabasePropRichTextString("FnMessage"),
    FnMentionUsers: new NotionDatabasePropRichTextString("FnMentionUsers"),
    FnMetadata: new NotionDatabasePropRichTextString("FnMetadata"),
    FnDate: new NotionDatabasePropRichTextString("FnDate"),
    timingTriggersDatabaseLink: new NotionDatabasePropRichTextMentionList(
      "timingTriggersDatabaseLink"
    ),
    discordChannelId: new NotionDatabasePropRichTextString("discordChannelId"),
  };
}

type TTask = {
  targetDatabaseId: string;
  task: RemindNotificationTask;
  discordChannelId: string;
  arg: RemindNotificationTasksDatabase["props"];
};

export default class RemindNotificationApp extends App {
  remindNotificationTasksDatabase: RemindNotificationTasksDatabase =
    new RemindNotificationTasksDatabase({
      notionClient: new NotionClient({ token: "" }),
      rawId: "",
    });

  remindNotificationTriggers: Array<TTask> = [];

  override async setup(init: {
    clients: { notionClient: NotionClient; discordClient: DiscordClient };
    tasksDatabaseId: string;
    discordGuildId: string;
  }): Promise<void> {
    this.remindNotificationTasksDatabase = new RemindNotificationTasksDatabase({
      notionClient: init.clients.notionClient,
      rawId: init.tasksDatabaseId,
    });
    this.discordGuildId = init.discordGuildId;
    this.remindNotificationTriggers = (
      await this.remindNotificationTasksDatabase.list()
    )
      .map((table) => {
        return (
          table.props.targetDatabaseLinks.value.map((targetDatabaseLink) => ({
            targetDatabaseId: targetDatabaseLink.target,
            task: new RemindNotificationTask(),
            discordChannelId: table.props.discordChannelId.value,
            arg: table.props,
          })) ?? []
        );
      })
      .flatMap((v) => v);
    await Promise.all(
      this.remindNotificationTriggers.map(
        async ({ targetDatabaseId, task, arg, discordChannelId }) => {
          const timingTriggersDatabaseId = _.get(
            arg.timingTriggersDatabaseLink.value,
            [0, "target"]
          );
          if (timingTriggersDatabaseId) {
            await task.setup({
              notionClient: init.clients.notionClient,
              rawNames: {
                message: arg.FnMessage.value,
                date: arg.FnDate.value,
                metaData: arg.FnMetadata.value,
                mentionUsers: arg.FnMentionUsers.value,
              },
              targetDatabaseId,
              timingTriggersDatabaseId,
              notifyFunction: (arg: {
                message: string;
                mentionTargets: string;
                activeTimings: Array<string>;
              }) => {
                const mentionUserNameList = _.split(arg.mentionTargets, ",");
                const mentionText = mentionUserNameList.map((userName) => {
                  const discordUserId = _.find(
                    this.membersDatabase.cache ?? [],
                    (member) => {
                      console.log(
                        member.props.user.value,
                        _.get(member.props.user.value, [0, "name"]),
                        userName
                      );
                      return (
                        _.get(member.props.user.value, [0, "name"]) === userName
                      );
                    }
                  )?.props.discordId.value;
                  return discordUserId
                    ? `<@${discordUserId}>:${userName}`
                    : userName;
                });
                console.log("-------------");
                console.log(
                  arg.mentionTargets,
                  mentionUserNameList,
                  mentionText
                );
                console.log(arg.message);
                console.log(arg.activeTimings);
                console.log("-------------");
                this.discordClient.sendMessage(
                  this.discordGuildId,
                  discordChannelId,
                  `${mentionText} ${arg.message}`
                );
              },
            });
          }
        }
      )
    );
  }

  override async update(): Promise<void> {
    await Promise.all(
      this.remindNotificationTriggers.map(async ({ task }) => {
        await task.update();
      })
    );
  }
}
