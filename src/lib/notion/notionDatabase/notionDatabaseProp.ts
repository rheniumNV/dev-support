import _ from "lodash";

export abstract class NotionDatabaseProp<T> {
  pageId: string | undefined;
  rawName: string;
  rawValue: any;
  abstract typeName: string;
  value: T | undefined;
  abstract parse: (value: any) => T | undefined;

  constructor(rawName: string) {
    this.rawName = rawName;
  }
}

export function generateNotionDatabasePropData(
  pageId: string,
  prop: NotionDatabaseProp<any>,
  rawValue: any
): NotionDatabaseProp<any> {
  const value = prop.parse(rawValue);
  return {
    pageId,
    rawName: prop.rawName,
    typeName: prop.typeName,
    rawValue,
    value,
    parse: prop.parse,
  };
}

export class NotionDatabasePropRaw extends NotionDatabaseProp<any> {
  typeName: "raw" = "raw";
  value: any;
  parse = (value: any): any => value;
}

export class NotionDatabasePropRichTextString extends NotionDatabaseProp<string> {
  typeName: "rich_text" = "rich_text";
  parse = (value: any): this["value"] =>
    _(_.get(value, "rich_text", []))
      .map((element) => _.get(element, "plain_text", ""))
      .join("\n");
}

export class NotionDatabasePropTitleString extends NotionDatabaseProp<string> {
  typeName: "rich_text" = "rich_text";
  parse = (value: any): this["value"] =>
    _(_.get(value, "title", []))
      .map((element) => _.get(element, "plain_text", ""))
      .join("\n");
}

type TMention = {
  type: "database" | "user" | undefined;
  target: string;
  href: string;
  text: string;
};

export class NotionDatabasePropRichTextMentionList extends NotionDatabaseProp<
  Array<TMention>
> {
  typeName: "rich_text" = "rich_text";
  parse = (value: any): this["value"] =>
    _(_.get(value, "rich_text", []))
      .filter(({ type }) => type === "mention")
      .map((element) => {
        const typeName = _.get(element, ["mention", "type"], undefined);
        const target = _.get(element, ["mention", typeName, "id"], "");
        const href = _.get(element, "href", undefined);
        const text = _.get(element, "plain_text", undefined);
        return { target, type: typeName, href, text };
      })
      .value();
}
type TSelect = {
  id: string;
  name: string;
  color: string;
};

export class NotionDatabasePropSelect extends NotionDatabaseProp<TSelect> {
  typeName: "rich_text" = "rich_text";
  parse = (value: any): this["value"] => {
    const { id, name, color } = _.get(value, "select", {}) ?? {};
    if (
      typeof id === "string" &&
      typeof name === "string" &&
      typeof color === "string"
    ) {
      return { id, name, color };
    }
    return undefined;
  };
}

const parseDate = (text?: string): Date | undefined =>
  text ? new Date(text) : undefined;

export class NotionDatabasePropDate extends NotionDatabaseProp<{
  start?: Date;
  end?: Date;
}> {
  typeName: "Date" = "Date";

  parse = (value: any): this["value"] => {
    const start = parseDate(_.get(value, ["date", "start"]));
    const end = parseDate(_.get(value, ["date", "end"]));
    return { start, end };
  };
}

// export abstract class NotionDatabasePropRelationJoined<
//   TJoinedDatabase extends NotionDatabase
// > extends NotionDatabaseProp<TJoinedDatabase["props"]> {
//   joinedNotionDatabase: TJoinedDatabase;
//   constructor(rawName: string, joinedNotionDatabase: TJoinedDatabase) {
//     super(rawName);
//     this.joinedNotionDatabase = joinedNotionDatabase;
//   }
//   parse: (value: any) => TJoinedDatabase["props"];

// }

export class NotionDatabasePropRelationIds extends NotionDatabaseProp<
  Array<{ id: string }>
> {
  typeName: "relation" = "relation";
  parse = (prop: any): this["value"] => {
    return _.get(prop, ["relation"]);
  };
}

export class NotionDatabasePropFormula<
  T extends string
> extends NotionDatabaseProp<T> {
  typeName: "formula" = "formula";
  parse = (prop: any): this["value"] => {
    return _.get(prop, ["formula", "string"]);
  };
}

export class NotionDatabasePropNumber extends NotionDatabaseProp<number> {
  typeName: "number" = "number";
  parse = (prop: any): this["value"] => {
    return Number(_.get(prop, ["number"]));
  };
}

export type TNotionUser = {
  id: string;
  name: string;
  avatar_url: string;
  type: string;
};
export class NotionDatabasePropUser extends NotionDatabaseProp<
  Array<TNotionUser>
> {
  typeName: "people" = "people";
  parse = (records: { people: Array<any> }): this["value"] => {
    if (_.isArray(records?.people)) {
      return records.people
        .map((record) => {
          const id = record?.id;
          const name = record?.name;
          const avatar_url = record?.avatar_url;
          const type = record?.type;
          return id && name && type ? [{ id, name, avatar_url, type }] : [];
        })
        .flatMap((v) => v);
    } else {
      return undefined;
    }
  };
}

export class NotionDatabasePropMultiSelect extends NotionDatabaseProp<
  Array<TSelect>
> {
  typeName: "multi_select" = "multi_select";
  parse = (prop: any): this["value"] => _.get(prop, ["multi_select"]);
}
