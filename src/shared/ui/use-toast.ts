import { createContext, useContext } from "react";

export type ToastTone = "success" | "danger" | "info";

/** Shared by ToastProvider (./toast.tsx), which shows the messages, and every component that sends one. */
export const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => {});

/** Shows a short message: `const toast = useToast(); toast("Saved");` */
export const useToast = () => useContext(ToastContext);
