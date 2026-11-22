import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { authApi } from "@/features/auth";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Dialog, errorText, IconButton, Skeleton, useToast } from "@/shared/ui";
import { attachmentsApi } from "../api";
import { ImageViewer } from "./image-viewer";
import { ACCEPT, fileProblem, isImage, MAX_FILE_BYTES, sizeText } from "../rules";
import type { Attachment, AttachmentOwner } from "../types";

/**
 * The files of a task or a project: the list, adding files (a button, or dropping files on the box), and removing.
 * `canAdd`: may this person attach files here. `canManage`: may they remove anyone's file (the project's PM, the CEO);
 * everyone may remove the files they added themselves. The server checks the same rules.
 */
export function AttachmentsPanel({ owner, canAdd, canManage }: { owner: AttachmentOwner; canAdd: boolean; canManage: boolean }) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const user = useUser();
  const load = useLoad(() => Promise.all([attachmentsApi.list(owner), authApi.users()]), [owner.type, owner.id]);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [uploading, setUploading] = useState<{ name: string; ratio: number } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  /** Uploads the chosen files one after another; files that can't go are listed with the reason. */
  const add = async (files: File[]) => {
    const found: string[] = [];
    for (const file of files) {
      const problem = fileProblem(file);
      if (problem) {
        found.push(
          problem === "type"
            ? tr(`«${file.name}»: هذا النوع غير مسموح.`, `"${file.name}": this type isn't allowed.`)
            : problem === "size"
              ? tr(`«${file.name}»: أكبر من ${sizeText(MAX_FILE_BYTES, "ar")}.`, `"${file.name}": bigger than ${sizeText(MAX_FILE_BYTES, "en")}.`)
              : tr(`«${file.name}»: الملف فارغ.`, `"${file.name}": the file is empty.`),
        );
        continue;
      }
      setUploading({ name: file.name, ratio: 0 });
      try {
        await attachmentsApi.upload(owner, file, (ratio) => setUploading({ name: file.name, ratio }));
        toast(tr(`أُرفق «${file.name}».`, `"${file.name}" attached.`));
      } catch (e) {
        found.push(`«${file.name}»: ${e instanceof ApiError && e.errors?.file ? e.errors.file : errorText(e, tr)}`);
      }
    }
    setUploading(null);
    setProblems(found);
  };

  const people = new Map((load.data?.[1] ?? []).map((u) => [u.id, u]));
  const files = load.data?.[0] ?? [];
  // The pictures among them open in the viewer, one after the other.
  const pictures = files.filter((f) => isImage(f.mime));

  return (
    <div className="flex flex-col gap-3">
      {load.state.status === "loading" && <Skeleton className="h-16 rounded-lg" />}
      {load.state.status === "error" && <p className="text-sm text-danger">{errorText(load.state.error, tr)}</p>}

      {load.data && files.length === 0 && !canAdd && <p className="text-sm text-faint">{tr("لا توجد ملفات.", "No files.")}</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((a) => {
            const by = people.get(a.uploaded_by);
            return (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line bg-card-2 pe-1.5">
                {/* The whole row opens the file (click anywhere): a picture in the viewer, anything else downloads. The
                    remove button sits apart. */}
                <a
                  href={a.url}
                  download={a.name}
                  onClick={(e) => {
                    if (!isImage(a.mime)) return;
                    e.preventDefault();
                    setViewing(pictures.findIndex((p) => p.id === a.id));
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 hover:bg-chip"
                >
                  {isImage(a.mime) ? (
                    // A user's file (a data: link in the demo, a short-lived link later): next/image can't optimise those.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" loading="lazy" className="size-11 shrink-0 rounded-md border border-line object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-chip text-muted">
                      <FileText size={20} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium" dir="auto">
                      {a.name}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {sizeText(a.size, lang)} · {by ? (lang === "en" && by.name_en ? by.name_en : by.name) : "-"}
                    </span>
                  </span>
                </a>
                {(canManage || a.uploaded_by === user.id) && (
                  <IconButton label={tr(`احذف ${a.name}`, `Remove ${a.name}`)} onClick={() => setRemoving(a)} className="size-9 bg-transparent text-danger hover:bg-danger-soft">
                    <Trash2 size={15} aria-hidden="true" />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canAdd && (
        <div
          // Dropping files works with a mouse; the button inside works with a keyboard and on phones.
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!uploading) add([...e.dataTransfer.files]);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-4 text-center transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-line-strong",
          )}
        >
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            aria-describedby={hintId}
            onChange={(e) => {
              add([...(e.target.files ?? [])]);
              e.target.value = ""; // so choosing the same file again works
            }}
          />
          {uploading ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <Upload size={15} aria-hidden="true" className="text-accent" />
              {tr(`جارٍ رفع «${uploading.name}»`, `Uploading "${uploading.name}"`)}
              {uploading.ratio > 0 && <span className="num text-muted">{Math.round(uploading.ratio * 100)}%</span>}
            </p>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
              <Paperclip size={15} aria-hidden="true" />
              {tr("أرفق ملفاً", "Attach a file")}
            </Button>
          )}
          <p id={hintId} className="text-xs text-muted">
            {tr(
              `أو اسحب الملفات إلى هنا. صور، PDF، Word، Excel، PowerPoint، نصوص، ZIP، حتى ${sizeText(MAX_FILE_BYTES, "ar")} للملف.`,
              `Or drop files here. Images, PDF, Word, Excel, PowerPoint, text, ZIP, up to ${sizeText(MAX_FILE_BYTES, "en")} each.`,
            )}
          </p>
        </div>
      )}

      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <ImageViewer
        images={pictures.map((f) => {
          const by = people.get(f.uploaded_by);
          return { id: f.id, url: f.url, name: f.name, size: f.size, caption: by ? (lang === "en" && by.name_en ? by.name_en : by.name) : undefined };
        })}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
      />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={tr("حذف الملف", "Remove the file")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button
              className="bg-danger hover:bg-danger"
              onClick={async () => {
                if (!removing) return;
                try {
                  await attachmentsApi.remove(removing.id);
                  toast(tr("حُذف الملف.", "File removed."));
                } catch (e) {
                  toast(errorText(e, tr), "danger");
                }
                setRemoving(null);
              }}
            >
              {tr("احذف", "Remove")}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {tr(`سيُحذف «${removing?.name ?? ""}». يبقى الحذف في السجل.`, `"${removing?.name ?? ""}" will be removed. The removal stays in the history.`)}
        </p>
      </Dialog>
    </div>
  );
}
