import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Role = "admin" | "operator" | "viewer";
export default function AdminPage() {
  const { user: me, isAdmin } = useUserRole();
  const users = useQuery(api.users.listAllUsers, isAdmin ? {} : "skip");
  const updateRole = useMutation(api.users.updateUserRole);
  const updateFleet = useMutation(api.users.updateUserFleetAccess);
  const [pending, setPending] = useState<string | null>(null);
  async function changeRole(userId: Id<"users">, role: Role) {
    setPending(userId);
    try { await updateRole({ userId, role }); toast.success("Role updated"); }
    catch { toast.error("Role could not be changed. Owner and self-access protections remain active."); }
    finally { setPending(null); }
  }
  async function changeFleet(userId: Id<"users">, fleetAccess: boolean) {
    setPending(userId);
    try { await updateFleet({ userId, fleetAccess }); toast.success(fleetAccess ? "Fleet read access granted" : "Fleet read access revoked"); }
    catch { toast.error("Fleet access could not be changed."); }
    finally { setPending(null); }
  }
  if (!isAdmin) return <div className="p-6"><h1 className="text-xl font-semibold">Administrator access required</h1><p className="mt-2 text-sm text-muted-foreground">Only an administrator can approve fleet access or assign operating roles.</p></div>;
  return <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
    <div><p className="mb-2 text-sm font-medium text-primary">DWMS Live</p><h1 className="text-2xl font-semibold">People & access</h1><p className="mt-2 text-sm text-muted-foreground">New accounts cannot read the shared device fleet until approved. Private conversations and notifications remain scoped to their owner.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-primary" />Registered accounts</CardTitle></CardHeader><CardContent className="divide-y divide-border">
      {users === undefined && <p className="py-4 text-sm text-muted-foreground">Loading accounts…</p>}
      {users?.map(user => <div key={user._id} className="flex flex-wrap items-center gap-4 py-4">
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{user.name || "Monitoring account"}{user._id === me?._id && " (you)"}</p><p className="break-all text-sm text-muted-foreground">{user.email || "No email supplied"}</p><p className="mt-1 text-xs text-muted-foreground">{user.role === "admin" || user.role === "operator" ? "Fleet access through assigned role" : user.fleetAccess ? "Approved fleet viewer" : "Awaiting fleet approval"}</p></div>
        <label className="space-y-1 text-xs text-muted-foreground">Role<select aria-label={"Role for " + (user.name || user.email || "account")} value={user.role} disabled={pending === user._id || user._id === me?._id} onChange={event => void changeRole(user._id, event.target.value as Role)} className="block min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="viewer">Viewer</option><option value="operator">Operator</option><option value="admin">Administrator</option></select></label>
        {user.role === "viewer" && <Button variant={user.fleetAccess ? "outline" : "default"} disabled={pending === user._id} onClick={() => void changeFleet(user._id, !user.fleetAccess)}>{user.fleetAccess ? "Revoke fleet access" : "Approve fleet access"}</Button>}
      </div>)}
    </CardContent></Card>
    <div className="flex gap-3 rounded-xl border border-border bg-white p-4"><Shield className="h-5 w-5 shrink-0 text-primary" /><p className="text-sm text-muted-foreground">Viewers can inspect approved fleet records. Operators can request deterministic controls. Administrators manage devices and access. This prototype has one shared fleet; separate customer tenants are not implemented.</p></div>
  </div>;
}
