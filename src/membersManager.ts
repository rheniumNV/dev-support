import { User } from "discord.js";
import NotionDatabase from "./lib/notion/notionDatabase";
import {
  NotionDatabasePropRichTextString,
  NotionDatabasePropTitleString,
  NotionDatabasePropUser,
  TNotionUser,
} from "./lib/notion/notionDatabase/notionDatabaseProp";
import Project from "./project";

export class MembersDatabase extends NotionDatabase {
  props = {
    name: new NotionDatabasePropTitleString("name"),
    user: new NotionDatabasePropUser("user"),
    discordId: new NotionDatabasePropRichTextString("discordId"),
  };
}

type Member = {
  name: string;
  notionUser: TNotionUser;
  discordUser?: User;
};

export default class MembersManager {
  private project: Project;
  private membersDatabase: MembersDatabase;
  members: Array<Member> = [];

  constructor(init: { membersDatabase: MembersDatabase; project: Project }) {
    this.membersDatabase = init.membersDatabase;
    this.project = init.project;
  }

  async setup() {
    this.members = await Promise.all<Member>(
      await (
        await this.membersDatabase.list()
      ).map(async (record) => {
        try {
          const discordUser = await this.project.discordClient.getUser(
            record.props.discordId.value
          );
          return {
            name: record.props.name.value,
            notionUser: record.props.user.value[0],
            discordUser,
          };
        } catch (e) {}
        return {
          name: record.props.name.value,
          notionUser: record.props.user.value[0],
        };
      })
    );
  }
}
