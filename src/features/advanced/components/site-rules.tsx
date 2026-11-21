// Loads what the signed-in person must obey (features, the banner for their job, read-only mode, the CEO's custom
// roles) and hands it to the shared store the top bar and the pages read (shared/lib/site.ts). It loads again whenever
// data changes, so a save in the advanced settings reaches every open page of this browser at once. If an admin has
// changed the person's job since they signed in, the signed-in person is updated too. Draws nothing.
import { useEffect } from "react";
import { setSession, useSession } from "@/shared/lib/session";
import { setSiteLive } from "@/shared/lib/site";
import { useLoad } from "@/shared/lib/use-load";
import { advancedApi } from "../api";

export function SiteRules() {
  const session = useSession();
  const id = session?.user.id;
  const { data } = useLoad(() => advancedApi.live(), [id]);
  useEffect(() => {
    if (!data) return;
    setSiteLive(data);
    const me = data.me;
    if (session && me && (me.role !== session.user.role || (me.custom_role ?? null) !== (session.user.custom_role ?? null))) {
      const { custom_role: _old, ...rest } = session.user;
      void _old;
      setSession({ ...session, user: { ...rest, role: me.role, ...(me.custom_role ? { custom_role: me.custom_role } : {}) } });
    }
  }, [data, session]);
  return null;
}
