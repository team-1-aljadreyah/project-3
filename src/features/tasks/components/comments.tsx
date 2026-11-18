import { useState } from "react";
import { Avatar, Button, Field, Textarea, errorText, useToast } from "@/shared/ui";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { tasksApi } from "../api";
import type { TaskComment } from "../types";
import { useFmt } from "@/shared/lib/i18n";
import { LIMITS } from "../rules";

/** The task's comments, oldest first, and a box to add one (Ctrl+Enter sends). */
export function Comments({
  taskId,
  comments,
  people,
  canWrite,
  onAdded,
}: {
  taskId: number;
  comments: TaskComment[];
  people: Map<number, User>;
  canWrite: boolean;
  onAdded: () => void;
}) {
  const { tr, lang, ago, dateTime } = useFmt();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!body.trim()) {
      setError(tr("اكتب التعليق أولاً.", "Write the comment first."));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await tasksApi.addComment(taskId, body);
      setBody("");
      toast(tr("أُضيف التعليق.", "Comment added."));
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError && e.errors?.body ? e.errors.body : errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted">{tr("لا توجد تعليقات بعد.", "No comments yet.")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => {
            const author = people.get(c.author_id);
            return (
              <li key={c.id} className="flex gap-3">
                {author && <Avatar user={author} size="md" />}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <b className="font-semibold">{author ? (lang === "en" && author.name_en ? author.name_en : author.name) : "-"}</b>
                    <time dateTime={c.created_at} title={dateTime(c.created_at)} className="text-xs text-faint">
                      {ago(c.created_at)}
                    </time>
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Field label={tr("أضف تعليقاً", "Add a comment")} htmlFor="comment-body" error={error} hint={tr("Ctrl+Enter للإرسال", "Ctrl+Enter to send")}>
            <Textarea
              id="comment-body"
              maxLength={LIMITS.comment}
              value={body}
              invalid={!!error}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  send();
                }
              }}
            />
          </Field>
          <Button type="submit" disabled={busy} className="self-end">
            {busy ? tr("جارٍ الإرسال…", "Sending…") : tr("أرسل التعليق", "Send")}
          </Button>
        </form>
      )}
    </div>
  );
}
