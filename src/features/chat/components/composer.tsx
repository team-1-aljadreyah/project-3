import { Paperclip, Send, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ACCEPT, attachmentsApi, fileProblem, voiceProblem } from "@/features/attachments";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { matches } from "@/shared/lib/utils";
import { Avatar, errorText, IconButton } from "@/shared/ui";
import { chatApi } from "../api";
import { CHAT_LIMITS as L, mentionQuery } from "../rules";
import type { ChatKey, Message } from "../types";
import { messageSummary, spokenDuration } from "../voice";
import { featureOn, useSiteLive } from "@/shared/lib/site";
import { useVoiceRecorder } from "./use-voice-recorder";
import { micProblemText, MicButton, PreviewBar, RecordingBar } from "./voice-recorder";

/**
 * Writing a message. Enter sends (Shift+Enter makes a new line). Typing "@" shows the chat's members: picking one writes
 * their name and makes them a mention (they get a notification). Files are sent with the message. While the box is
 * empty, the microphone records a voice message (hold to talk, or click to start and stop), heard before sending.
 */
export function Composer({
  chatKey,
  members,
  me,
  replyTo,
  replyName,
  onCancelReply,
}: {
  chatKey: ChatKey;
  members: User[];
  me: User;
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
  const caret = useRef<number | null>(null);
  const labelId = useId();
  const nameOf = (u: User) => (lang === "en" && u.name_en ? u.name_en : u.name);
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

  const send = async () => {
    const body = text.trim();
    if ((!body && files.length === 0) || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      // A mention counts only if its name is still in the text (it may have been deleted while typing).
      const mentions = mentioned.filter((u) => body.includes(`@${u.name}`)).map((u) => u.id);
      const message = await chatApi.send(chatKey, { body, reply_to: replyTo?.id, mentions });
      for (const f of files) await attachmentsApi.upload({ type: "message", id: message.id }, f);
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
      await attachmentsApi.upload({ type: "message", id: message.id }, take.file, undefined, voice);
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
    <div className="flex flex-col gap-2 border-t border-line p-3">
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
            <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full bg-chip py-1 ps-3 pe-1 text-xs">
              <span dir="auto" className="max-w-40 truncate">
                {f.name}
              </span>
              <button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={tr(`أزل ${f.name}`, `Remove ${f.name}`)} className="rounded-full p-0.5 hover:bg-card">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
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
                const chosen = [...(e.target.files ?? [])];
                const bad = chosen.find((f) => fileProblem(f));
                if (bad) setError(tr(`«${bad.name}»: نوع أو حجم غير مسموح.`, `"${bad.name}": type or size not allowed.`));
                setFiles((l) => [...l, ...chosen.filter((f) => !fileProblem(f))]);
                e.target.value = "";
              }}
            />
            <IconButton label={tr("أرفق ملفاً", "Attach a file")} onClick={() => picker.current?.click()} className="size-10 bg-transparent">
              <Paperclip size={18} aria-hidden="true" />
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
