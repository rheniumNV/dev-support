import NotionDatabase, {
  NotionClientOwner,
} from "../../lib/notion/notionDatabase";
import {
  NotionDatabasePropDate,
  NotionDatabasePropTitleString,
  NotionDatabasePropRichTextString,
  NotionDatabasePropFormula,
  NotionDatabasePropNumber,
  NotionDatabasePropMultiSelect,
  NotionDatabasePropUser,
  TNotionUser,
} from "../../lib/notion/notionDatabase/notionDatabaseProp";
import moment from "moment";
import _ from "lodash";

function parseJsonSafe<T>(str: string): T | undefined {
  try {
    return JSON.parse(str);
  } catch (e) {
    return undefined;
  }
}

export class NotificationTargetDatabase extends NotionDatabase {
  props = {
    message: new NotionDatabasePropFormula<string>("message"),
    mentionUsers: new NotionDatabasePropFormula<string>("mentionUsers"),
    metaData: new NotionDatabasePropRichTextString("metaData"),
    date: new NotionDatabasePropDate("date"),
  };

  constructor(
    init: { notionClientOwner: NotionClientOwner; rawId: string },
    rawNames: {
      message?: string;
      mentionUsers?: string;
      metaData?: string;
      date?: string;
    },
    userFields: Array<{ name: string }>
  ) {
    super({ notionClientOwner: init.notionClientOwner, rawId: init.rawId });
    this.props.message.rawName = rawNames.message ?? "message";
    this.props.mentionUsers.rawName = rawNames.mentionUsers ?? "mentionUsers";
    this.props.metaData.rawName = rawNames.metaData ?? "metaData";
    this.props.date.rawName = rawNames.date ?? "date";
    userFields.forEach(({ name }) => {
      this.props = {
        ...this.props,
        ...{ [name]: new NotionDatabasePropUser(name) },
      };
    });
  }

  async updateMetaDate(target: this["props"]["metaData"], value: string) {
    await this.directUpdate<this["props"]["metaData"]>(target, [
      {
        type: "text",
        text: {
          content: value,
        },
      },
    ]);
  }

  async updateUserField(
    target: NotionDatabasePropUser,
    value: Array<TNotionUser>
  ) {
    const prop = value.map((user) => ({ object: "user", id: user.id }));
    await this.directUpdate<NotionDatabasePropUser>(target, prop);
  }
}

export class RemindNotificationTimingsDatabase extends NotionDatabase {
  props = {
    title: new NotionDatabasePropTitleString("title"),
    code: new NotionDatabasePropRichTextString("code"),
    minutes: new NotionDatabasePropNumber("minutes"),
    mentions: new NotionDatabasePropMultiSelect("mentions"),
  };
}

type TNotifyFunctionInput = {
  message: string;
  mentionTargets: string;
  activeTimings: Array<RemindNotificationTimingsDatabase["props"]>;
  scheduleDate: Date;
  scheduleId: string;
};
export default class RemindNotificationTask {
  id: string;
  notificationTargetDatabase: NotificationTargetDatabase;
  remindNotificationTimingsDatabase: RemindNotificationTimingsDatabase;
  discordChannelId: string;
  reactionFunctions: { [key: string]: string };

  notifyFunction: (data: TNotifyFunctionInput) => void = () => {};

  constructor(init: {
    id: string;
    notificationTargetDatabase: NotificationTargetDatabase;
    remindNotificationTimingsDatabase: RemindNotificationTimingsDatabase;
    discordChannelId: string;
    reactionFunctions: { [key: string]: string };
    notifyFunction: (data: TNotifyFunctionInput) => void;
  }) {
    this.id = init.id;
    this.notificationTargetDatabase = init.notificationTargetDatabase;
    this.remindNotificationTimingsDatabase =
      init.remindNotificationTimingsDatabase;
    this.discordChannelId = init.discordChannelId;
    this.reactionFunctions = init.reactionFunctions;
    this.notifyFunction = init.notifyFunction;
  }

  public async setup() {}

  public async update() {
    await this.remindNotificationTimingsDatabase.list();

    await this.notificationTargetDatabase.list();

    const nowDate = moment();

    this.notificationTargetDatabase.cache.forEach((record) => {
      const metaData =
        parseJsonSafe<{ [key: string]: boolean }>(
          record.props.metaData.value ?? "{}"
        ) ?? {};

      const startDate = moment(record.props.date.value?.start);
      const diffMin = startDate.diff(nowDate, "minutes");

      if (diffMin <= 0) {
        return;
      }
      const activeTimings = _.filter(
        this.remindNotificationTimingsDatabase?.cache,
        (timing) => {
          return (
            Number(timing.props.minutes.value) > diffMin &&
            !_.get(metaData, timing.props.code.value ?? "", false)
          );
        }
      );

      const newMetadata = {
        ...metaData,
        ..._.reduce(
          activeTimings,
          (prev, curr) => ({
            ...prev,
            [curr.props.code.value ?? "-"]: true,
          }),
          {}
        ),
      };

      if (activeTimings.length > 0) {
        this.notificationTargetDatabase?.updateMetaDate(
          record.props.metaData,
          JSON.stringify(newMetadata)
        );

        this.notifyFunction({
          message: record.props.message.value ?? "",
          mentionTargets: record.props.mentionUsers.value ?? "",
          activeTimings: activeTimings.map((record) => record.props),
          scheduleDate: startDate.toDate(),
          scheduleId: record.id,
        });
      }
    });
  }
}
