import NotionClient from "../../lib/notion/client";
import NotionDatabase from "../../lib/notion/notionDatabase";
import {
  NotionDatabasePropDate,
  NotionDatabasePropTitleString,
  NotionDatabasePropRichTextString,
  NotionDatabasePropRaw,
  NotionDatabasePropFormula,
  NotionDatabasePropNumber,
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
    init: { notionClient: NotionClient; rawId: string },
    rawNames: {
      message?: string;
      mentionUsers?: string;
      metaData?: string;
      date?: string;
    }
  ) {
    super({ notionClient: init.notionClient, rawId: init.rawId });
    this.props.message.rawName = rawNames.message ?? "message";
    this.props.mentionUsers.rawName = rawNames.mentionUsers ?? "mentionUsers";
    this.props.metaData.rawName = rawNames.metaData ?? "metaData";
    this.props.date.rawName = rawNames.date ?? "date";
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
}

export class RemindNotificationTimingsDatabase extends NotionDatabase {
  props = {
    title: new NotionDatabasePropTitleString("title"),
    code: new NotionDatabasePropRichTextString("code"),
    minutes: new NotionDatabasePropNumber("minutes"),
    mentions: new NotionDatabasePropRaw("mentions"),
  };
}

type TNotifyFunctionInput = {
  message: string;
  mentionTargets: string;
  activeTimings: Array<string>;
};
export default class RemindNotificationTask {
  notificationTarget: NotificationTargetDatabase | undefined;
  remindNotificationTimingsDatabase:
    | RemindNotificationTimingsDatabase
    | undefined;

  notifyFunction: (data: TNotifyFunctionInput) => void = () => {};

  public async setup(init: {
    notionClient: NotionClient;
    targetDatabaseId: string;
    rawNames: {
      message?: string;
      date?: string;
      metaData?: string;
      mentionUsers?: string;
    };
    timingTriggersDatabaseId: string;
    notifyFunction: (data: TNotifyFunctionInput) => void;
  }) {
    this.notificationTarget = new NotificationTargetDatabase(
      {
        notionClient: init.notionClient,
        rawId: init.targetDatabaseId,
      },
      init.rawNames
    );
    this.remindNotificationTimingsDatabase =
      new RemindNotificationTimingsDatabase({
        notionClient: init.notionClient,
        rawId: init.timingTriggersDatabaseId,
      });
    await this.remindNotificationTimingsDatabase.list();
    this.notifyFunction = init.notifyFunction;
  }

  public async update() {
    if (this.notificationTarget) {
      const dataList = await this.notificationTarget.list();

      const nowDate = moment();
      dataList.forEach((table) => {
        const metaData =
          parseJsonSafe<{ [key: string]: boolean }>(
            table.props.metaData.value
          ) ?? {};

        const startDate = moment(table.props.date.value.start);
        const diffMin = startDate.diff(nowDate, "minutes");

        if (diffMin <= 0) {
          return;
        }
        console.log("METADATA", metaData);
        const activeTimings = _.filter(
          this.remindNotificationTimingsDatabase?.cache,
          (timing) => {
            return (
              Number(timing.props.minutes.value) > diffMin &&
              !_.get(metaData, timing.props.code.value, false)
            );
          }
        ).map((timing) => timing.props.code.value);
        const newMetadata = {
          ...metaData,
          ..._.reduce(
            activeTimings,
            (prev, curr) => ({ ...prev, [curr]: true }),
            {}
          ),
        };
        if (activeTimings.length > 0) {
          this.notificationTarget?.updateMetaDate(
            table.props.metaData,
            JSON.stringify(newMetadata)
          );

          this.notifyFunction({
            message: table.props.message.value ?? "",
            mentionTargets: table.props.mentionUsers.value ?? "",
            activeTimings: activeTimings.map((table) => JSON.stringify(table)),
          });
        }
      });
    }
  }
}
