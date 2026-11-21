// Loads what the signed-in person must obey (features, the banner for their job, read-only mode) and hands it to the
// shared store the top bar and the pages read (shared/lib/site.ts). It loads again whenever data changes, so a save in
// the advanced settings reaches every open page of this browser at once. Draws nothing.
import { useEffect } from "react";
import { useUser } from "@/shared/lib/session";
import { setSiteLive } from "@/shared/lib/site";
import { useLoad } from "@/shared/lib/use-load";
import { advancedApi } from "../api";

export function SiteRules() {
  const me = useUser();
  const { data } = useLoad(() => advancedApi.live(), [me.id]);
  useEffect(() => {
    if (data) setSiteLive(data);
  }, [data]);
  return null;
}
