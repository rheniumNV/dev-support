import Project from "../project";
import NotionDatabase from "../lib/notion/notionDatabase";

export default abstract class App<TConfigDatabase extends NotionDatabase> {
  project: Project;

  isEmpty: boolean = false;

  id: string;
  name: string;

  // todo: move to child class
  configDatabase: TConfigDatabase;

  constructor(init: {
    project: Project;
    id: string;
    name: string;
    configDatabase: TConfigDatabase;
  }) {
    this.project = init.project;

    this.id = init.id;
    this.name = init.name;
    this.configDatabase = init.configDatabase;
  }

  abstract setup(): Promise<void>;

  abstract update(): Promise<void>;
}
