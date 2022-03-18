import { Client } from "@notionhq/client";
import {
  QueryDatabaseParameters,
  QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";
import _ from "lodash";

export default class NotionClient {
  private client: Client;

  public constructor({ token }: { token?: string }) {
    if (token) {
      this.client = new Client({ auth: token });
    } else {
      this.client = new Client({ auth: "" });
    }
  }

  public setup({ token }: { token: string }) {
    this.client = new Client({ auth: token });
  }

  public async getMembers() {
    return _.get(await this.client.users.list({}), "results", []);
  }

  public async databasesQuery(
    query: QueryDatabaseParameters
  ): Promise<QueryDatabaseResponse> {
    return await this.client.databases.query(query);
  }

  public async update(pageId: string, propName: string, value: any) {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        [propName]: value,
      },
    });
  }
}
