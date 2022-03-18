import NotionClient from "../client";
import _ from "lodash";
import {
  NotionDatabaseProp,
  generateNotionDatabasePropData,
} from "./notionDatabaseProp";

type TTableRecord<TProps extends { [key: string]: NotionDatabaseProp<any> }> = {
  id: string;
  props: TProps;
};

export class Record<TProps extends { [key: string]: NotionDatabaseProp<any> }> {
  id: string;
  props: TProps;

  constructor(id: string, props: TProps) {
    this.id = id;
    this.props = props;
  }
  async update(props: TProps) {}
}
export default abstract class NotionDatabase {
  props: { [key: string]: NotionDatabaseProp<any> } = {};
  cache: Array<TTableRecord<this["props"]>> = [];
  notionClient: NotionClient;
  rawId: string = "";
  records: Array<TTableRecord<this["props"]>> = [];

  constructor(init: { notionClient: NotionClient; rawId: string }) {
    this.notionClient = init.notionClient;
    this.rawId = init.rawId;
  }

  async update() {
    const response = await this.notionClient.databasesQuery({
      database_id: this.rawId,
    });
    const newRecords = _.map(response.results, (data) => {
      const pageId = data.id;
      const notionDataProps = _.get(data, "properties", {});
      const hitRecord = _.find(this.records, (record) => record.id === pageId);
      if (hitRecord) {
        return [];
      } else {
        return [
          {
            id: data.id,
            props: _.reduce(
              this.props,
              (prev, curr, key) => {
                return {
                  ...prev,
                  ...{
                    [key]: generateNotionDatabasePropData(
                      pageId,
                      curr,
                      _.get(notionDataProps, curr.rawName ?? key)
                    ),
                  },
                };
              },
              {}
            ),
          },
        ];
      }
    }).flatMap((v) => v);
  }

  async list(): Promise<Array<TTableRecord<this["props"]>>> {
    const response = await this.notionClient.databasesQuery({
      database_id: this.rawId,
    });

    const result = _(response.results)
      .map((data) => {
        const pageId = data.id;
        const notionDataProps = _.get(data, "properties", {});
        return {
          id: data.id,
          props: _.reduce(
            this.props,
            (prev, curr, key) => {
              return {
                ...prev,
                ...{
                  [key]: generateNotionDatabasePropData(
                    pageId,
                    curr,
                    _.get(notionDataProps, curr.rawName ?? key)
                  ),
                },
              };
            },
            {}
          ),
        };
      })
      .value();

    this.cache = result;
    return result;
  }

  public async directUpdate<T extends NotionDatabaseProp<any>>(
    target: T,
    value: T["rawValue"]
  ) {
    if (target.pageId) {
      await this.notionClient.update(target.pageId, target.rawName, {
        [target.typeName]: value,
      });
    } else {
      throw new Error("pageId is nothing");
    }
  }
}
