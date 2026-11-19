import { GitCommitHorizontal, GitMerge, GitPullRequest, GitPullRequestClosed } from "lucide-react";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Pill } from "@/shared/ui";
import { githubApi } from "../api";
import { safeGithubUrl } from "../rules";
import type { GithubItem } from "../types";

const STATE = {
  open: { ar: "مفتوح", en: "Open", tone: "progress", Icon: GitPullRequest },
  merged: { ar: "مدموج", en: "Merged", tone: "done", Icon: GitMerge },
  closed: { ar: "مغلق", en: "Closed", tone: "blocked", Icon: GitPullRequestClosed },
} as const;

/**
 * The pull requests and commits that mention a task's or bug's code (the brief: show commits and PRs on the task). Shown
 * only when GitHub is on for the project. Links open GitHub in a new tab; only https://github.com/ addresses are links.
 */
export function GithubPanel({ owner }: { owner: { type: "task" | "bug"; id: number } }) {
  const { tr, ago } = useFmt();
  const load = useLoad(() => githubApi.links(owner), [owner.type, owner.id]);
  const data = load.data;
  if (!data?.enabled) return null;

  const row = (g: GithubItem) => {
    const href = safeGithubUrl(g.url);
    const s = g.state ? STATE[g.state] : undefined;
    const Icon = s ? s.Icon : GitCommitHorizontal;
    const body = (
      <>
        <Icon size={16} aria-hidden="true" className={cn("mt-0.5 shrink-0", g.state === "merged" ? "text-success" : "text-muted")} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span dir="auto" className="truncate font-medium">
            {g.title}
          </span>
          <span dir="ltr" className="truncate text-start text-xs text-muted">
            {g.repo} {g.ref} · {g.author} · {ago(g.at)}
          </span>
        </span>
        {s && <Pill tone={s.tone}>{tr(s.ar, s.en)}</Pill>}
      </>
    );
    return (
      <li key={g.id}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-chip">
            {body}
            <span className="sr-only">{tr("(يفتح GitHub في نافذة جديدة)", "(opens GitHub in a new tab)")}</span>
          </a>
        ) : (
          <div className="flex items-start gap-2.5 px-2 py-2 text-sm">{body}</div>
        )}
      </li>
    );
  };

  const prs = data.items.filter((g) => g.kind === "pr");
  const commits = data.items.filter((g) => g.kind === "commit");
  return (
    <section aria-labelledby={`gh-${owner.type}-${owner.id}`} className="rounded-xl border border-line bg-card p-4">
      <h2 id={`gh-${owner.type}-${owner.id}`} className="mb-2 text-sm font-semibold text-muted">
        GitHub
      </h2>
      {data.items.length === 0 ? (
        <p className="text-sm text-faint">
          {tr("لا طلبات سحب ولا إيداعات تذكر هذا الرمز بعد. اكتب الرمز في عنوان طلب السحب أو رسالة الإيداع ليُربط هنا.", "No pull requests or commits mention this code yet. Put the code in a PR title or commit message to link it here.")}
        </p>
      ) : (
        <>
          {prs.length > 0 && (
            <>
              <h3 className="mt-1 text-xs font-medium text-faint">{tr("طلبات السحب", "Pull requests")}</h3>
              <ul className="flex flex-col">{prs.map(row)}</ul>
            </>
          )}
          {commits.length > 0 && (
            <>
              <h3 className="mt-2 text-xs font-medium text-faint">{tr("الإيداعات", "Commits")}</h3>
              <ul className="flex flex-col">{commits.map(row)}</ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
