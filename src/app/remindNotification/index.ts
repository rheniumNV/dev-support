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
import {
  MessageEmbed,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";

function parseJsonSafe<T>(str: string): T | undefined {
  try {
    return JSON.parse(str);
  } catch (e) {
    return undefined;
  }
}
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
    reactionFunctions: new NotionDatabasePropRichTextString(
      "reactionFunctions"
    ),
  };
}

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
      const taskTitle = record.props.title.value;
      if (!taskTitle) {
        throw new Error("taskTitle is undefined");
      }

      const targetDatabaseId = _.get(record.props.targetDatabaseLinks, [
        "value",
        0,
        "target",
      ]);
      if (!targetDatabaseId) {
        throw new Error("targetDatabaseId is undefined.");
      }

      const timingTriggersDatabaseLinkId = _.get(
        record.props.timingTriggersDatabaseLink,
        ["value", 0, "target"]
      );
      if (!timingTriggersDatabaseLinkId) {
        throw new Error("timingTriggersDatabaseLinkId is undefined.");
      }

      const discordChannelId = record.props.discordChannelId.value;
      if (!discordChannelId) {
        throw new Error("discordChannelId is undefined.");
      }

      const reactionFunctions =
        parseJsonSafe<{ [key: string]: string }>(
          record.props.reactionFunctions.value ?? "{}"
        ) ?? {};

      return new RemindNotificationTask({
        id: record.id,
        notificationTargetDatabase: new NotificationTargetDatabase(
          {
            notionClientOwner: this.project,
            rawId: targetDatabaseId,
          },
          {
            message: record.props.FnMessage.value,
            mentionUsers: record.props.FnMentionUsers.value,
            metaData: record.props.FnMetadata.value,
            date: record.props.FnDate.value,
          },
          _.map(reactionFunctions, (value) => ({ name: value }))
        ),
        remindNotificationTimingsDatabase:
          new RemindNotificationTimingsDatabase({
            notionClientOwner: this.project,
            rawId: timingTriggersDatabaseLinkId,
          }),
        discordChannelId: discordChannelId,
        reactionFunctions: reactionFunctions,
        notifyFunction: async (arg: {
          message: string;
          mentionTargets: string;
          activeTimings: Array<RemindNotificationTimingsDatabase["props"]>;
          scheduleDate: Date;
          scheduleId: string;
        }) => {
          const mentionUserNameList = _.map(
            _.split(arg.mentionTargets, ","),
            (str) => str.trim()
          );

          const mentionTypes = _.uniq(
            arg.activeTimings
              .map((record) =>
                record.mentions.value
                  ? record.mentions.value.map((select) => select.name)
                  : []
              )
              .flatMap((v) => v)
          );
          const mentionTargetUser = _.includes(mentionTypes, "targetUser");

          const mentionUserList = mentionUserNameList
            .map((userName) => {
              const member = mentionTargetUser
                ? _.find(
                    this.project.membersManager.members,
                    (member) => member.notionUser.name === userName
                  )
                : undefined;
              return (
                member?.discordUser ??
                (userName && userName != " " ? userName : [])
              );
            })
            .flatMap((v) => v);

          const messageText = _.join(
            [
              arg.message,
              mentionTargetUser ? `${mentionUserList}` : "",
              mentionTypes.filter((str) => str !== "targetUser"),
            ],
            "\n"
          );
          const embed = new MessageEmbed()
            .setAuthor({
              name: taskTitle,
              url: `https://empty.com/${record.id}`,
            })
            .setDescription(messageText)
            .setURL(`https://empty.com/${arg.scheduleId}`)
            .setTimestamp(arg.scheduleDate);

          const message = await this.project.discordClient.sendMessage(
            this.project.discordGuildId,
            discordChannelId,
            { embeds: [embed] }
          );

          const reactionFunctions = _.map(
            parseJsonSafe<{ [key: string]: string }>(
              record.props.reactionFunctions.value ?? "{}"
            ) ?? {},
            (value: string, key: string) => ({
              emojiId: key,
              targetFieldId: value,
            })
          );

          reactionFunctions.forEach(({ emojiId }) => {
            message.react(emojiId);
          });
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

  override async onMessageReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    if (reaction.message.embeds.length !== 1) {
      return;
    }

    const taskUrlList = reaction.message.embeds[0].author?.url?.split("/");
    if (!taskUrlList || taskUrlList.length < 2) {
      return;
    }
    const taskId = taskUrlList[taskUrlList.length - 1];

    const targetIdList = reaction.message.embeds[0].url?.split("/");
    if (!targetIdList || targetIdList.length < 2) {
      return;
    }
    const targetId = targetIdList[targetIdList.length - 1];

    const targetMember = this.project.membersManager.members.find(
      (member) => member.discordUser?.id === user.id
    );

    if (!targetMember) {
      return;
    }

    await Promise.all(
      this.remindNotificationTasks
        .filter((task) => {
          return (
            task.discordChannelId === reaction.message.channel.id &&
            task.id === taskId
          );
        })
        .map(async (task) => {
          const targetFieldName =
            task.reactionFunctions[reaction.emoji.id ?? ""];
          const targetSchedule = task.notificationTargetDatabase.cache.find(
            (record) => record.id === targetId
          );
          const target = _.get(targetSchedule?.props, [targetFieldName]);
          if (targetFieldName && targetSchedule && target) {
            const newUsers = _.uniq([
              ...target.value,
              targetMember?.notionUser,
            ]);
            await task.notificationTargetDatabase.updateUserField(
              target,
              newUsers
            );
          }
        })
    );
  }
}
