import { Paperclip, Send, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ACCEPT, attachmentsApi, fileProblem, isImage, voiceProblem } from "@/features/attachments";
import type { User } from "@/shared/api/types";
import { isTyping, pastedFiles } from "@/shared/lib/clipboard";
import { useFmt } from "@/shared/lib/i18n";
import { cn, matches } from "@/shared/lib/utils";
import { Avatar, errorText, IconButton } from "@/shared/ui";
import { chatApi } from "../api";
import { CHAT_LIMITS as L, mentionQuery } from "../rules";
import type { ChatKey, Message } from "../types";
import type { Outbox } from "./thread";
import { messageSummary, spokenDuration } from "../voice";
import { featureOn, useSiteLive } from "@/shared/lib/site";
import { useVoiceRecorder } from "./use-voice-recorder";
import { micProblemText, MicButton, PreviewBar, RecordingBar } from "./voice-recorder";
import { EmojiPicker } from "./emoji-picker";

/**
 * Writing a message. Enter sends (Shift+Enter makes a new line). Typing "@" shows the chat's members: picking one writes
 * their name and makes them a mention (they get a notification). Files are sent with the message. While the box is
 * empty, the microphone records a voice message (hold to talk, or click to start and stop), heard before sending.
 * Ctrl+V pastes pictures and files (a screenshot, a picture copied from a page or the chat, files copied in the file
 * explorer) as files of the message, even when the cursor isn't in the box; they can be dropped on it too. The smile
 * button adds emoji, and the GIF button picks an animated GIF.
 */
/** Temporary ids for messages shown before the server has them (negative, so never a real one). */
let nextTemp = 0;

export function Composer({
  chatKey,
  members,
  me,
  outbox,
  replyTo,
  replyName,
  onCancelReply,
}: {
  chatKey: ChatKey;
  members: User[];
  me: User;
  /** Where a message shows at once, before the server answers. */
  outbox?: Outbox;
  replyTo?: Message;
  replyName?: string;
  onCancelReply: () => void;
}) {
  const { tr, lang } = useFmt();
  const [text, setText] = useState("");
  const [mentioned, setMentioned] = useState<User[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const gifPicker = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const labelId = useId();
  const nameOf = (u: User) => (lang === "en" && u.name_en ? u.name_en : u.name);
  /** Files chosen, pasted or dropped: the allowed ones join the message; the first one that isn't says why. */
  const addFiles = (chosen: File[]) => {
    if (!chosen.length) return;
    const bad = chosen.find((f) => fileProblem(f));
    setError(bad ? tr(`«${bad.name}»: نوع أو حجم غير مسموح.`, `"${bad.name}": type or size not allowed.`) : undefined);
    setFiles((l) => [...l, ...chosen.filter((f) => !fileProblem(f))]);
  };

  /** Puts text where the cursor is (an emoji, or text pasted while the cursor was elsewhere) and keeps typing after it. */
  const insertText = (add: string) => {
    const el = box.current;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const next = (text.slice(0, start) + add + text.slice(end)).slice(0, L.body);
    setText(next);
    caret.current = Math.min(start + add.length, next.length);
  };

  const rec = useVoiceRecorder();
  const live = useSiteLive();
  const [holding, setHolding] = useState(false);
  const [drag, setDrag] = useState(0);
  const voiceState = rec.state;
  // Back to the text box after a voice message was sent or thrown away.
  const wasVoice = useRef(false);
  useEffect(() => {
    if (voiceState === "recording" || voiceState === "preview") wasVoice.current = true;
    else if (voiceState === "idle" && wasVoice.current) {
      wasVoice.current = false;
      box.current?.focus({ preventScroll: true });
    }
  }, [voiceState]);
  // Ctrl+V anywhere in the chat (not only in the box): pictures and files join the message, text goes into the box.
  // Not while another box has the cursor (its own paste), a window is open over the page, or a voice message is on.
  const pasteAnywhere = useRef<(e: ClipboardEvent) => void>(() => {});
  useEffect(() => {
    pasteAnywhere.current = (e: ClipboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target) || document.querySelector("dialog[open]") || voiceState !== "idle") return;
      const pasted = pastedFiles(e.clipboardData);
      const plain = e.clipboardData?.getData("text/plain") ?? "";
      if (!pasted.length && !plain) return;
      e.preventDefault();
      if (pasted.length && !plain.trim()) addFiles(pasted);
      else insertText(plain);
      box.current?.focus({ preventScroll: true });
    };
  });
  useEffect(() => {
    const on = (e: ClipboardEvent) => pasteAnywhere.current(e);
    document.addEventListener("paste", on);
    return () => document.removeEventListener("paste", on);
  }, []);
  const [dropping, setDropping] = useState(false);

  // A microphone problem shows where the other errors show, with how to fix it.
  const micError = rec.problem && micProblemText(rec.problem, tr);

  // The people who match what is typed after "@" (not me: nobody mentions themselves).
  const choices = query === null ? [] : members.filter((u) => u.id !== me.id && matches(query, u.name, u.name_en)).slice(0, 6);

  const pick = (u: User) => {
    const cursor = box.current!.selectionStart;
    const at = text.slice(0, cursor).lastIndexOf("@");
    // Replace "@سا" with "@سارة علي " and keep typing after it.
    const next = `${text.slice(0, at)}@${u.name} ${text.slice(cursor)}`;
    setText(next);
    setMentioned((list) => (list.some((x) => x.id === u.id) ? list : [...list, u]));
    setQuery(null);
    caret.current = at + u.name.length + 2;
  };

  // After a name is picked, put the cursor right after it as soon as the new text is drawn (before the next key press).
  useLayoutEffect(() => {
    const el = box.current;
    if (caret.current === null || !el) return;
    el.focus({ preventScroll: true });
    el.selectionStart = el.selectionEnd = caret.current;
    caret.current = null;
  }, [text]);

  // Messages go to the server one after the other, in the order they were written.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const send = async () => {
    const body = text.trim();
    if ((!body && files.length === 0) || busy) return;
    // A mention counts only if its name is still in the text (it may have been deleted while typing).
    const mentions = mentioned.filter((u) => body.includes(`@${u.name}`)).map((u) => u.id);

    // Text only: it shows in the chat at once, as sent, and the box is ready for the next one. The server's answer
    // takes its place quietly; if it fails, the message goes away and its text comes back here with the reason.
    if (files.length === 0 && outbox) {
      const temp = --nextTemp;
      const reply = replyTo;
      const used = mentioned;
      outbox.add({ id: temp, chat: chatKey, author_id: me.id, body, reply_to: reply?.id, mentions, created_at: new Date().toISOString(), files: [] });
      setText("");
      setMentioned([]);
      setError(undefined);
      onCancelReply();
      box.current?.focus({ preventScroll: true });
      queue.current = queue.current.then(async () => {
        try {
          outbox.done(temp, await chatApi.send(chatKey, { body, reply_to: reply?.id, mentions }));
        } catch (e) {
          outbox.drop(temp, reply);
          setText((now) => (now.trim() ? now : body));
          setMentioned((now) => (now.length ? now : used));
          setError(errorText(e, tr));
        }
      });
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const message = await chatApi.send(chatKey, { body, reply_to: replyTo?.id, mentions });
      const sentFiles = [];
      for (const f of files) sentFiles.push(await attachmentsApi.upload({ type: "message", id: message.id }, f));
      // With its files: in the chat now, not at the next refresh.
      outbox?.done(null, { ...message, files: sentFiles });
      setText("");
      setMentioned([]);
      setFiles([]);
      onCancelReply();
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
      box.current?.focus({ preventScroll: true });
    }
  };

  /** A voice message: an empty message (with the reply, if any), then its recording as the message's file. */
  const sendVoice = async () => {
    const take = rec.take;
    if (!take || busy) return;
    const voice = { duration_s: take.duration_s, peaks: take.peaks };
    if (voiceProblem(take.file, voice)) {
      setError(tr("لا يمكن إرسال هذا التسجيل: نوعه أو حجمه أو مدته غير مسموح.", "This recording can't be sent: its type, size or length isn't allowed."));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const message = await chatApi.send(chatKey, { body: "", reply_to: replyTo?.id });
      const file = await attachmentsApi.upload({ type: "message", id: message.id }, take.file, undefined, voice);
      outbox?.done(null, { ...message, files: [file] });
      rec.discard();
      onCancelReply();
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  // The CEO may switch voice messages off (advanced settings): then the box only sends text and files.
  const voiceOn = featureOn(live, "voice_messages", me.role);
  const showMic = voiceOn && ((!text.trim() && files.length === 0) || voiceState === "recording" || voiceState === "asking");

  return (
    // Files dragged from the computer can be dropped anywhere on the box.
    <div
      className={cn("relative flex flex-col gap-2 border-t border-line p-3 transition-colors", dropping && "bg-accent-soft")}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files") || voiceState !== "idle") return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        addFiles([...e.dataTransfer.files]);
      }}
    >
      {dropping && (
        <p aria-hidden="true" className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-card/90 text-sm font-medium text-accent-ink">
          {tr("أفلت الملفات هنا لإرفاقها", "Drop the files here to attach them")}
        </p>
      )}
      {replyTo && (
        <div className="flex items-center gap-2 rounded-lg bg-chip px-3 py-1.5 text-xs">
          <span className="flex-1 truncate">
            {tr("ردّ على", "Replying to")} <b>{replyName}</b>: <bdi>{messageSummary(replyTo, tr)}</bdi>
          </span>
          <button type="button" onClick={onCancelReply} aria-label={tr("إلغاء الرد", "Cancel the reply")} className="rounded p-0.5 hover:bg-card">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <FileChip key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => setFiles((l) => l.filter((_, j) => j !== i))} label={tr(`أزل ${f.name}`, `Remove ${f.name}`)} />
          ))}
        </ul>
      )}
      {(error || micError) && (
        <p role="alert" className="text-xs leading-relaxed text-danger">
          {micError || error}
        </p>
      )}
      {/* Read out when recording starts and when the recording is ready to hear. */}
      <p role="status" className="sr-only">
        {voiceState === "recording" ? tr("بدأ التسجيل", "Recording started") : voiceState === "preview" && rec.take ? tr(`التسجيل جاهز، مدته ${spokenDuration(rec.take.duration_s, "ar")}`, `Recording ready, ${spokenDuration(rec.take.duration_s, "en")}`) : ""}
      </p>
      <div className="relative flex items-end gap-2">
        {choices.length > 0 && (
          <ul role="listbox" aria-label={tr("اختر من تذكره", "Choose who to mention")} className="absolute start-0 bottom-full z-10 mb-1 w-64 rounded-xl border border-line bg-card p-1 shadow-lg">
            {choices.map((u, i) => (
              <li key={u.id} role="option" aria-selected={i === 0}>
                <button type="button" onClick={() => pick(u)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-chip">
                  <Avatar user={u} size="sm" />
                  {nameOf(u)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {voiceState === "recording" ? (
          <RecordingBar rec={rec} holding={holding} drag={drag} />
        ) : voiceState === "preview" && rec.take ? (
          <PreviewBar rec={rec} busy={busy} onSend={sendVoice} />
        ) : (
          <>
            <input
              ref={picker}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <input
              ref={gifPicker}
              type="file"
              multiple
              accept=".gif,image/gif"
              className="hidden"
              onChange={(e) => {
                addFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <IconButton label={tr("أرفق ملفاً", "Attach a file")} onClick={() => picker.current?.click()} className="size-10 bg-transparent">
              <Paperclip size={18} aria-hidden="true" />
            </IconButton>
            <EmojiPicker onPick={insertText} />
            <IconButton label={tr("أضف صورة GIF متحركة", "Add an animated GIF")} onClick={() => gifPicker.current?.click()} className="hidden size-10 bg-transparent sm:flex">
              <span aria-hidden="true" className="rounded-[5px] border-[1.5px] border-current px-1 text-[10px] leading-[14px] font-bold tracking-wide">
                GIF
              </span>
            </IconButton>
            <label id={labelId} htmlFor={`${labelId}-text`} className="sr-only">
              {tr("اكتب رسالة", "Write a message")}
            </label>
            <textarea
              ref={box}
              id={`${labelId}-text`}
              dir="auto"
              rows={1}
              maxLength={L.body}
              value={text}
              placeholder={tr("اكتب رسالة… استخدم @ لذكر زميل", "Write a message… use @ to mention someone")}
              onChange={(e) => {
                setText(e.target.value);
                rec.clearProblem();
                setQuery(mentionQuery(e.target.value, e.target.selectionStart));
              }}
              onPaste={(e) => {
                // A picture or file on the clipboard (with no text) joins the message as a file. Text pastes as usual,
                // so copying from Word, which puts both text and a picture of it, pastes the text.
                const pasted = pastedFiles(e.clipboardData);
                if (!pasted.length || e.clipboardData.getData("text/plain").trim()) return;
                e.preventDefault();
                addFiles(pasted);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  // With the list of people open, Enter picks the first one; otherwise it sends.
                  if (choices.length) pick(choices[0]);
                  else send();
                }
                if (e.key === "Escape") setQuery(null);
              }}
              className="max-h-40 min-h-10 flex-1 resize-y rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </>
        )}
        {voiceState === "preview" ? null : showMic ? (
          <MicButton
            key="mic"
            rec={rec}
            holding={holding}
            onHolding={(on) => {
              setHolding(on);
              if (on) setError(undefined);
            }}
            onDrag={setDrag}
          />
        ) : (
          <IconButton key="send" label={tr("أرسل", "Send")} onClick={send} disabled={busy || (!text.trim() && !files.length)} className="size-10 bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50">
            <Send size={17} aria-hidden="true" className="rtl:-scale-x-100" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

/** A file waiting to be sent: a small preview for a picture (a GIF moves), the name for other files, and a remove button. */
function FileChip({ file, label, onRemove }: { file: File; label: string; onRemove: () => void }) {
  const picture = isImage(file.type);
  // The preview is a short-lived link to the file on this computer, made when the picture shows and freed after.
  const show = (img: HTMLImageElement | null) => {
    if (!img) return;
    const url = URL.createObjectURL(file);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  };
  return (
    <li className={cn("flex items-center gap-1.5 rounded-full bg-chip py-1 pe-1 text-xs", picture ? "ps-1" : "ps-3")}>
      {/* A local picture the person just chose (a blob: link): next/image can't optimise those. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {picture && <img ref={show} alt="" className="size-8 rounded-full object-cover" />}
      <span dir="auto" className="max-w-40 truncate">
        {file.name}
      </span>
      <button type="button" onClick={onRemove} aria-label={label} className="rounded-full p-0.5 hover:bg-card">
        <X size={12} aria-hidden="true" />
      </button>
    </li>
  );
}
