import NotionClient from "../client";
import _ from "lodash";
import {
  NotionDatabaseProp,
  generateNotionDatabasePropData,
} from "./notionDatabaseProp";

type TTable<TProps extends { [key: string]: NotionDatabaseProp<any> }> = {
  id: string;
  props: TProps;
};

export default abstract class NotionDatabase {
  props: { [key: string]: NotionDatabaseProp<any> } = {};
  cache: Array<TTable<this["props"]>> = [];
  notionClient: NotionClient;
  rawId: string = "";

  constructor(init: { notionClient: NotionClient; rawId: string }) {
    this.notionClient = init.notionClient;
    this.rawId = init.rawId;
  }

  async list(): Promise<Array<TTable<this["props"]>>> {
    const response = await this.notionClient.databasesQuery({
      database_id: this.rawId,
    });

    const result = _(response.results)
      .map((data) => {
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
}
