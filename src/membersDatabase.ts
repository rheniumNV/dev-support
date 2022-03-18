import NotionDatabase from "./lib/notion/notionDatabase";
import {
  NotionDatabasePropRichTextString,
  NotionDatabasePropTitleString,
  NotionDatabasePropUser,
} from "./lib/notion/notionDatabase/notionDatabaseProp";
import Project from "./project";

export default class MembersDatabase extends NotionDatabase {
  props = {
    name: new NotionDatabasePropTitleString("name"),
    user: new NotionDatabasePropUser("user"),
    discordId: new NotionDatabasePropRichTextString("discordId"),
  };
}

type TMember = {
  id: string;
  name: string;
  discordId: string;
};

export class MemberManager {
  project: Project;
  members: Array<TMember> = [];
  constructor(init: { project: Project }) {
    this.project = init.project;
  }

  async setup() {}
}
