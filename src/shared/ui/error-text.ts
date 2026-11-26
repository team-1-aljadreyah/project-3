import { ApiError } from "@/shared/api/errors";
import type { Tr } from "@/shared/lib/i18n";

/** The message for a failed call, in the current language. */
export function errorText(e: unknown, tr: Tr) {
  if (e instanceof ApiError) {
    if (e.message) return e.message;
    if (e.code === "NETWORK") return tr("لا يوجد اتصال بالخادم. تحقّق من اتصالك بالإنترنت.", "Can't reach the server. Check the internet.");
    if (e.status === 403) return tr("ليست لديك صلاحية لهذه الصفحة.", "You don't have access to this page.");
    if (e.status === 404) return tr("لم يُعثر على ما تبحث عنه.", "Not found.");
  }
  return tr("حدث خطأ غير متوقع.", "Something went wrong.");
}
