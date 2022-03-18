import NotionClient from "./lib/notion/client";
import DiscordClient from "./lib/discord/client";
import NotionDatabase from "./lib/notion/notionDatabase";
import {
  NotionDatabasePropTitleString,
  NotionDatabasePropRichTextString,
  NotionDatabasePropRichTextMentionList,
} from "./lib/notion/notionDatabase/notionDatabaseProp";
import Project from "./project";
import _ from "lodash";

const {
  NOTION_TOKEN,
  DISCORD_TOKEN,
  PROJECT_CONFIG_LIST_DATABASE_ID,
  CLIENT_MAP,
} = process.env;

class ProjectsDatabase extends NotionDatabase {
  props = {
    projectName: new NotionDatabasePropTitleString("projectName"),
    clientCode: new NotionDatabasePropRichTextString("clientCode"),
    appsDatabaseLinks: new NotionDatabasePropRichTextMentionList(
      "appsDatabaseLinks"
    ),
    membersDatabaseLinks: new NotionDatabasePropRichTextMentionList(
      "membersDatabaseLinks"
    ),
    discordGuildId: new NotionDatabasePropRichTextString("discordGuildId"),
  };
}

async function main() {
  if (typeof NOTION_TOKEN !== "string") {
    throw new Error(`NOTION_TOKEN is not string.`);
  }
  if (typeof DISCORD_TOKEN !== "string") {
    throw new Error(`DISCORD_TOKEN is not string.`);
  }
  if (typeof PROJECT_CONFIG_LIST_DATABASE_ID !== "string") {
    throw new Error(`PROJECT_CONFIG_LIST_DATABASE_ID is not string.`);
  }
  if (typeof CLIENT_MAP !== "string") {
    throw new Error(`CLIENT_MAP is not string.`);
  }

  const projectsDatabase = new ProjectsDatabase({
    notionClientOwner: {
      notionClient: new NotionClient({ token: NOTION_TOKEN }),
    },
    rawId: PROJECT_CONFIG_LIST_DATABASE_ID,
  });
  const projectConfigList = await projectsDatabase.list();

  const clientMap = JSON.parse(CLIENT_MAP);

  const projects = projectConfigList
    .map((table) => {
      const appConfigListDatabaseId = _.get(
        table.props.appsDatabaseLinks.value,
        [0, "target"]
      );
      const { notionToken, discordToken } =
        _.get(clientMap, table.props.clientCode.value) ?? {};

      const discordGuildId = table.props.discordGuildId.value;

      const membersDatabaseId = _.get(table.props.membersDatabaseLinks.value, [
        0,
        "target",
      ]);

      if (
        notionToken &&
        discordToken &&
        appConfigListDatabaseId &&
        discordGuildId &&
        membersDatabaseId
      ) {
        return new Project({
          name: table.props.projectName.value,
          notionClient: new NotionClient({ token: notionToken }),
          discordClient: new DiscordClient({
            token: discordToken,
            allowedGuildIds: [discordGuildId],
          }),
          appConfigListDatabaseId,
          membersDatabaseId,
          discordGuildId,
        });
      }
      return [];
    })
    .flatMap((v) => v);

  await Promise.all(projects.map((project) => project.setup()));
  await Promise.all(projects.map((project) => project.update()));
}

main();
