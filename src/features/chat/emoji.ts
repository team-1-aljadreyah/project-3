// The emoji the picker offers, in groups, and the ones used last (kept on this device only).

export interface EmojiGroup {
  id: string;
  /** The emoji on the group's tab. */
  icon: string;
  ar: string;
  en: string;
  emoji: string[];
}

const list = (s: string) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s.replace(/\s/g, ""))].map((x) => x.segment);

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: "faces",
    icon: "😀",
    ar: "وجوه",
    en: "Faces",
    emoji: list("😀😃😄😁😆😅😂🤣🙂🙃😉😊😇🥰😍🤩😘😗😚😋😛😜🤪😝🤗🤭🤫🤔🫡🤐🤨😐😑😶🫠😏😒🙄😬😮‍💨🤥😌😔😪🤤😴😷🤒🤕🤢🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕🫤😟🙁😮😯😲😳🥺🥹😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈💀🤡👻👽🤖💩"),
  },
  {
    id: "hands",
    icon: "👍",
    ar: "أيادٍ وأشخاص",
    en: "Hands and people",
    emoji: list("👍👎👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆👇☝️✋🤚🖐️🖖👋🤝🙏👏🙌👐🤲💪🫶✍️🤳💅👀🧠🫀👶🧒👦👧🧑👨👩🧔👴👵🙋🙋‍♂️🙋‍♀️🤷🤷‍♂️🤷‍♀️🤦🤦‍♂️🤦‍♀️🙆🙅💁🙇🧑‍💻👨‍💻👩‍💻🧑‍💼👨‍💼👩‍💼🧑‍🔧🧑‍🏫🧑‍⚕️🕵️👷🏃🚶🧍"),
  },
  {
    id: "hearts",
    icon: "❤️",
    ar: "قلوب ورموز",
    en: "Hearts and symbols",
    emoji: list("❤️🧡💛💚💙🩵💜🤎🖤🩶🤍💔❣️💕💞💓💗💖💘💝✅☑️✔️❌❎⭕❗❓‼️⁉️⚠️🚫⛔💯🔥✨⭐🌟💫⚡💥💢💤💬💭🗯️🔔🔕📣📢🆕🆗🆙🔝🔜➡️⬅️⬆️⬇️🔄🔁➕➖✖️➗♻️🟢🟡🟠🔴🔵🟣⚫⚪"),
  },
  {
    id: "work",
    icon: "💼",
    ar: "عمل وأشياء",
    en: "Work and things",
    emoji: list("💼📁📂🗂️📋📌📍📎🖇️📏📐✂️🗃️🗄️🗑️📝✏️🖊️🖋️📒📓📔📕📗📘📙📚📖🔖🏷️📊📈📉🗓️📅📆⏰⏱️⏳⌛🕐💻🖥️⌨️🖱️🖨️📱☎️📞📠🔋🔌💡🔦🔍🔎🔐🔒🔓🔑🛠️🔧🔨⚙️🧰🧪🐞🐛🚀🎯🏆🥇🥈🥉🏅🎖️🎉🎊🎁🎈🎂☕🍵"),
  },
  {
    id: "nature",
    icon: "🌿",
    ar: "طبيعة وطعام",
    en: "Nature and food",
    emoji: list("☀️🌤️⛅🌧️⛈️🌈❄️🌙⭐🌍🌊🌸🌺🌻🌹🌷🌱🌿🍀🌴🌵🍂🍁🐶🐱🐭🐰🦊🐻🐼🐨🦁🐯🐮🐸🐵🐔🐧🐦🦅🦉🐝🦋🐢🐍🐬🐳🐟🐪🐎🍎🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥥🥝🍅🥑🥦🌽🥕🍞🧀🍳🥗🍕🍔🍟🌯🥙🍗🍖🍚🍛🍰🍩🍪🍫🍬🍭🧃🥤"),
  },
  {
    id: "places",
    icon: "🚗",
    ar: "أماكن ومناسبات",
    en: "Places and occasions",
    emoji: list("🏠🏡🏢🏬🏥🏫🏛️🕌🕋⛪🏰🏟️🗼🌉🚗🚕🚌🚑🚒🚓🚚🚲🛵✈️🚆🚇⛵🚢🗺️🧭⛰️🏝️🏜️🌃🌅🌄🎆🎇🏮🕯️🎵🎶🎤🎧🎬🎨🎮⚽🏀🏐🎾🏓🥅🏁🇮🇶"),
  },
];

/** How many recently used emoji are kept and shown first. */
export const RECENT_MAX = 24;

/** The list after one more use: the newest first, each emoji once, no more than RECENT_MAX. */
export const withRecent = (recent: string[], emoji: string) => [emoji, ...recent.filter((e) => e !== emoji)].slice(0, RECENT_MAX);

const KEY = "p3.chat.recent-emoji";

/** The emoji used last on this device ([] when the browser keeps nothing, for example in a private window). */
export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Nothing kept: the picker still works, it just doesn't remember.
  }
}
