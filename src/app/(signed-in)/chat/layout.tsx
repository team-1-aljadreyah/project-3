"use client";

// The chat page is drawn here, in the layout of /chat and /chat/p-3, not in the two page files: a layout stays when
// you move from one chat to another, so the list of chats doesn't load again on every click. The page reads the
// open chat from the address (useParams). The two page files below only make the addresses exist.
import { ChatPage } from "@/features/chat";

export default function ChatLayout() {
  return <ChatPage />;
}
