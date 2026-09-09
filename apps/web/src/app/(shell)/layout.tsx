import { Sidebar } from "@/components/Sidebar";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PresenceHeartbeat />
        {children}
      </div>
    </div>
  );
}
