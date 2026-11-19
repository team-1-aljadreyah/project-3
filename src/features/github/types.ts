// The data shapes of the GitHub link (the brief: link tasks and bugs to repositories, show commits and pull requests on
// the task, turned on per project). The real link is made by the server (the company's GitHub App and its webhooks).

/** A project's GitHub setting. */
export interface GithubSettings {
  project_id: number;
  enabled: boolean;
  /** "owner/name", for example "aljadreyah/booking-web". */
  repos: string[];
}

/** A pull request or a commit that mentions a task's or bug's code (TSK-104, BUG-3) in its title, branch or message. */
export interface GithubItem {
  id: string;
  kind: "pr" | "commit";
  repo: string;
  /** The PR's number, or the commit's short id. */
  ref: string;
  title: string;
  /** A PR's state. Commits have none. */
  state?: "open" | "merged" | "closed";
  author: string;
  at: string;
  /** Always an https://github.com/… address (anything else is never shown as a link). */
  url: string;
}

/** What the task or bug page shows: whether GitHub is on for its project, and the linked items, newest first. */
export interface GithubLinks {
  enabled: boolean;
  repos: string[];
  items: GithubItem[];
}
