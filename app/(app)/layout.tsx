import { AppFrame } from "@/components/shell/app-frame";

// Every page in (app)/ needs a signed-in person and has the top bar. The brackets keep "(app)" out of the address.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppFrame>{children}</AppFrame>;
}
