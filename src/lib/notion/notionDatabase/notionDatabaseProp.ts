import _ from "lodash";

export abstract class NotionDatabaseProp<T> {
  rawName: string;
  rawValue: any;
  abstract typeName: string;
  abstract value: T;
  abstract parse: (value: any) => T;

  constructor(rawName: string) {
    this.rawName = rawName;
  }
}

export function generateNotionDatabasePropData(
  prop: NotionDatabaseProp<any>,
  rawValue: any
): NotionDatabaseProp<any> {
  const value = prop.parse(rawValue);
  return {
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
  value: string = "";
  parse = (value: any): string =>
    _(_.get(value, "rich_text", []))
      .map((element) => _.get(element, "plain_text", ""))
      .join("\n");
}

export class NotionDatabasePropTitleString extends NotionDatabaseProp<string> {
  typeName: "rich_text" = "rich_text";
  value: string = "";
  parse = (value: any): string =>
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
  value: Array<TMention> = [];
  parse = (value: any): Array<TMention> =>
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

export class NotionDatabasePropSelect extends NotionDatabaseProp<
  TSelect | undefined
> {
  typeName: "rich_text" = "rich_text";
  value: TSelect | undefined;
  parse = (value: any): TSelect | undefined => {
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
  value: { start?: Date; end?: Date } = {};

  parse = (value: any): { start?: Date; end?: Date } => {
    const start = parseDate(_.get(value, ["date", "start"]));
    const end = parseDate(_.get(value, ["date", "end"]));
    return { start, end };
  };
}
