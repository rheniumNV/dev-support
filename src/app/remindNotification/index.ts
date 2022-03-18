import NotionDatabase from "../../lib/notion/notionDatabase";
import {
  NotionDatabasePropRichTextMentionList,
  NotionDatabasePropRichTextString,
  NotionDatabasePropTitleString,
} from "../../lib/notion/notionDatabase/notionDatabaseProp";
import App from "..";
import RemindNotificationTask, {
  NotificationTargetDatabase,
  RemindNotificationTimingsDatabase,
} from "./remindNotificationTask";
import _ from "lodash";
import Project from "../../project";

export class RemindNotificationTasksDatabase extends NotionDatabase {
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

export default class RemindNotificationApp extends App<RemindNotificationTasksDatabase> {
  remindNotificationTasks: Array<RemindNotificationTask> = [];

  constructor(init: {
    project: Project;
    id: string;
    name: string;
    configDatabase: RemindNotificationTasksDatabase;
  }) {
    super(init);
  }

  async setup() {
    this.remindNotificationTasks = await (
      await this.configDatabase.list()
    ).map((record) => {
      return new RemindNotificationTask({
        notificationTargetDatabase: new NotificationTargetDatabase(
          {
            notionClientOwner: this.project,
            rawId: record.props.targetDatabaseLinks.value[0].target,
          },
          {
            message: record.props.FnMessage.value,
            mentionUsers: record.props.FnMentionUsers.value,
            metaData: record.props.FnMetadata.value,
            date: record.props.FnDate.value,
          }
        ),
        remindNotificationTimingsDatabase:
          new RemindNotificationTimingsDatabase({
            notionClientOwner: this.project,
            rawId: record.props.timingTriggersDatabaseLink.value[0].target,
          }),
        notifyFunction: (arg: {
          message: string;
          mentionTargets: string;
          activeTimings: Array<RemindNotificationTimingsDatabase["props"]>;
        }) => {
          const mentionUserNameList = _.split(arg.mentionTargets, ",");

          const mentionTypes = _.uniq(
            arg.activeTimings
              .map((record) =>
                record.mentions.value.map((select) => select.name)
              )
              .flatMap((v) => v)
          );
          const mentionTargetUser = _.includes(mentionTypes, "targetUser");

          const mentionUserList = mentionUserNameList.map((userName) => {
            const member = mentionTargetUser
              ? _.find(
                  this.project.membersManager.members,
                  (member) => member.name === userName
                )
              : undefined;
            return member?.discordUser ?? userName;
          });

          console.log("-------------");
          console.log(arg.message);
          console.log("-------------");

          this.project.discordClient.sendMessage(
            this.project.discordGuildId,
            record.props.discordChannelId.value,
            `${arg.message}
            ${mentionTargetUser ? `参加予定者：${mentionUserList}` : ""}
            ${mentionTypes.filter((str) => str !== "targetUser")}`
          );
        },
      });
    });
    await Promise.all(
      this.remindNotificationTasks.map(async (task) => await task.setup())
    );
  }

  override async update(): Promise<void> {
    await Promise.all(
      this.remindNotificationTasks.map(async (task) => {
        await task.update();
      })
    );
  }
}
