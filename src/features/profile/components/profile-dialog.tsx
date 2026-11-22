import { Cake, Camera, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ROLES } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { updateSessionUser, useUser } from "@/shared/lib/session";
import { cn } from "@/shared/lib/utils";
import { Avatar, Button, Dialog, errorText, useToast } from "@/shared/ui";
import { profileApi } from "../api";
import { makeSquare, readPicture } from "../picture";
import { centredCrop, PICTURE, PICTURE_ACCEPT, pickProblem, type Crop } from "../rules";
import type { PickedPicture, ProfileStart } from "../types";
import { CROP_VIEW, PictureCropper } from "./picture-cropper";

/**
 * "My profile": the signed-in person's picture, name, job and email, and the place to set, change or remove the
 * picture. A picture is picked (or dropped on the window), cropped to a square, and the browser sends a small
 * 256×256 copy. Opened from the account menu (the item, or the camera on the big avatar: `start="pick"`).
 */
export function ProfileDialog({ start = "view", onClose }: { start?: ProfileStart; onClose: () => void }) {
  const user = useUser();
  const { tr, lang } = useFmt();
  const toast = useToast();
  const fileId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(start === "pick");
  const [picked, setPicked] = useState<PickedPicture | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [dropping, setDropping] = useState(false);

  // The picked file's short-lived address is freed when another is picked or the window closes.
  useEffect(() => () => void (picked && URL.revokeObjectURL(picked.url)), [picked]);

  const name = lang === "en" && user.name_en ? user.name_en : user.name;

  const take = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const problem = pickProblem(file);
    if (problem === "type") return setError(tr("اختر صورة بصيغة JPEG أو PNG أو WebP.", "Choose a JPEG, PNG or WebP picture."));
    if (problem === "empty") return setError(tr("الملف فارغ. اختر صورة أخرى.", "The file is empty. Choose another picture."));
    if (problem === "size") return setError(tr("الصورة أكبر من 5 م.ب. اختر صورة أصغر.", "The picture is bigger than 5 MB. Choose a smaller one."));
    const read = await readPicture(file);
    if (!read) return setError(tr("تعذّرت قراءة هذه الصورة، فقد تكون تالفة. جرّب صورة أخرى.", "This picture can't be read; it may be damaged. Try another one."));
    setPicked(read);
    setCrop(centredCrop(read, CROP_VIEW));
    setEditing(true);
  };

  const save = async () => {
    if (!picked || !crop) return;
    setBusy(true);
    setError(null);
    try {
      const me = await profileApi.setMyPicture(await makeSquare(picked, crop, CROP_VIEW));
      updateSessionUser(me);
      toast(tr("حُفظت صورتك.", "Your picture is saved."));
      onClose();
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      updateSessionUser(await profileApi.removeMyPicture());
      setConfirmRemove(false);
      toast(tr("أُزيلت صورتك.", "Your picture is removed."));
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  /** Back from choosing to the profile (or closed, when the window opened straight on choosing). */
  const back = () => {
    setError(null);
    setPicked(null);
    setCrop(null);
    if (start === "pick") onClose();
    else setEditing(false);
  };

  const footer = editing ? (
    <>
      <Button variant="secondary" onClick={back} disabled={busy}>
        {tr("إلغاء", "Cancel")}
      </Button>
      <Button onClick={save} disabled={busy || !picked}>
        {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ الصورة", "Save picture")}
      </Button>
    </>
  ) : (
    <Button variant="secondary" onClick={onClose}>
      {tr("إغلاق", "Close")}
    </Button>
  );

  return (
    <Dialog open onClose={onClose} title={editing ? tr("صورتي الشخصية", "My picture") : tr("ملفي الشخصي", "My profile")} footer={footer}>
      {/* A picture can be dropped anywhere on the window. */}
      <div
        className="relative"
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropping(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          void take(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={input}
          id={fileId}
          type="file"
          accept={PICTURE_ACCEPT}
          className="peer sr-only"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {!editing && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-start">
              <Avatar user={user} size="xxl" className="ring-4 ring-accent-soft" />
              <div className="flex min-w-0 flex-col items-center gap-1 sm:items-start">
                <p className="text-lg font-semibold">{name}</p>
                {user.title && <p className="text-sm text-muted">{user.title}</p>}
                <span className="mt-1 inline-flex rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-ink">{tr(ROLES[user.role].ar, ROLES[user.role].en)}</span>
                <p dir="ltr" className="mt-1 max-w-full truncate text-sm text-muted">
                  {user.email}
                </p>
                {/* Your own birth date, with the year: only you, the admin and the CEO see the year. */}
                {user.birth_date && (
                  <p className="inline-flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-muted sm:justify-start">
                    <Cake size={13} aria-hidden="true" className="text-accent" />
                    {new Intl.DateTimeFormat(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${user.birth_date}T00:00:00`))}
                    <span className="text-faint">· {tr("يرى زملاؤك اليوم والشهر فقط", "Colleagues see only the day and month")}</span>
                  </p>
                )}
              </div>
            </div>
            <section aria-labelledby={`${fileId}-h`} className="rounded-xl border border-line bg-card-2 p-4">
              <h3 id={`${fileId}-h`} className="font-medium">
                {tr("الصورة الشخصية", "Profile picture")}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {tr("يراها زملاؤك أينما ظهر اسمك: في المحادثات والمهام والتعليقات.", "Your colleagues see it wherever your name shows: chats, tasks and comments.")}
              </p>
              {confirmRemove ? (
                <div role="alert" className="mt-3 flex flex-col gap-3 rounded-lg bg-danger-soft p-3 text-sm sm:flex-row sm:items-center">
                  <p className="flex-1 text-danger">{tr("أتريد إزالة صورتك؟ سيظهر الحرف الأول من اسمك بدلاً منها.", "Remove your picture? The first letter of your name shows instead.")}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setConfirmRemove(false)} disabled={busy}>
                      {tr("أبقِها", "Keep it")}
                    </Button>
                    <Button size="sm" className="bg-danger text-card hover:bg-danger hover:opacity-90" onClick={remove} disabled={busy}>
                      {tr("نعم، أزِلها", "Yes, remove it")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setEditing(true)}>
                    <Camera size={15} aria-hidden="true" />
                    {user.avatar_url ? tr("غيّر الصورة", "Change picture") : tr("أضف صورة", "Add a picture")}
                  </Button>
                  {user.avatar_url && (
                    <Button size="sm" variant="secondary" className="text-danger" onClick={() => setConfirmRemove(true)}>
                      <Trash2 size={15} aria-hidden="true" />
                      {tr("أزل الصورة", "Remove picture")}
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {editing && !picked && (
          <label
            htmlFor={fileId}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-card-2 px-4 py-10 text-center transition-colors hover:bg-chip peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
              dropping && "bg-accent-soft",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <ImagePlus size={22} aria-hidden="true" />
            </span>
            <span className="font-medium">{tr("اسحب صورة إلى هنا، أو اخترها من جهازك", "Drag a picture here, or choose one from your device")}</span>
            <span className="text-sm text-muted">
              {tr(`JPEG أو PNG أو WebP، حتى ${PICTURE.maxPickBytes / 1024 / 1024} م.ب`, `JPEG, PNG or WebP, up to ${PICTURE.maxPickBytes / 1024 / 1024} MB`)}
            </span>
          </label>
        )}

        {editing && picked && crop && (
          <div className="flex flex-col gap-4">
            <PictureCropper picked={picked} crop={crop} onCrop={setCrop} />
            <p className="text-center text-sm text-muted sm:text-start">
              {tr("اسحب الصورة لتضعها في الدائرة، وكبّرها بالشريط.", "Drag the picture into the circle, and zoom with the slider.")}{" "}
              <button type="button" onClick={() => input.current?.click()} className="font-medium text-accent underline-offset-2 hover:underline">
                {tr("اختر صورة أخرى", "Choose another picture")}
              </button>
            </p>
          </div>
        )}

        {dropping && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-card/90 font-medium text-accent-ink">
            {tr("أفلت الصورة هنا", "Drop the picture here")}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
