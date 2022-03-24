import { User } from "discord.js";
import NotionDatabase, { NotionClientOwner } from "./lib/notion/notionDatabase";
import {
  NotionDatabasePropRichTextString,
  NotionDatabasePropTitleString,
  NotionDatabasePropUser,
  TNotionUser,
} from "./lib/notion/notionDatabase/notionDatabaseProp";
import Project from "./project";
import _ from "lodash";

export class MembersDatabase extends NotionDatabase {
  props = {
    name: new NotionDatabasePropTitleString("name"),
    user: new NotionDatabasePropUser("user"),
    discordId: new NotionDatabasePropRichTextString("discordId"),
  };
  constructor(init: {
    notionClientOwner: NotionClientOwner;
    rawId: string;
    membersDatabaseFieldNameMap: {
      FnName: string;
      FnUser: string;
      FnDiscordId: string;
    };
  }) {
    super(init);
    this.props.name.rawName = init.membersDatabaseFieldNameMap.FnName;
    this.props.user.rawName = init.membersDatabaseFieldNameMap.FnUser;
    this.props.discordId.rawName = init.membersDatabaseFieldNameMap.FnDiscordId;
  }
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
    this.members = (
      await Promise.all<Member[] | []>(
        await (
          await this.membersDatabase.list()
        ).map(async (record) => {
          const name = record.props.name.value;
          const notionUser = _.get(record.props.user.value, 0);

          if (name && notionUser) {
            const discordId = record.props.discordId.value;
            if (discordId) {
              try {
                const discordUser = await this.project.discordClient.getUser(
                  discordId
                );
                return [{ name, notionUser, discordUser }];
              } catch (e) {}
            }
            return [{ name, notionUser }];
          } else {
            return [];
          }
        })
      )
    ).flatMap((v) => v);
  }
}
