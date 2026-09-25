import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { motion } from "motion/react";
import { Shield, Users, Crown, Eye, Settings2, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { api } from "@/convex/_generated/api.js";
import { useUserRole } from "@/hooks/use-user-role.ts";
import type { Id } from "@/convex/_generated/dataModel.js";

type Role = "admin" | "operator" | "viewer";

const ROLE_CFG: Record<Role, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; desc: string }> = {
  admin: {
    label: "ADMIN",
    color: "#ef4444",
    bg: "#ef444415",
    border: "#ef444444",
    icon: <Crown className="w-3.5 h-3.5" />,
    desc: "Full system access — control, configure, manage users",
  },
  operator: {
    label: "OPERATOR",
    color: "#f59e0b",
    bg: "#f59e0b15",
    border: "#f59e0b44",
    icon: <Settings2 className="w-3.5 h-3.5" />,
    desc: "Can operate controls and run simulations — no user management",
  },
  viewer: {
    label: "VIEWER",
    color: "#06b6d4",
    bg: "#06b6d415",
    border: "#06b6d444",
    icon: <Eye className="w-3.5 h-3.5" />,
    desc: "Read-only access — dashboards and monitoring only",
  },
};

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CFG[role];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function AdminPanelInner() {
  const users = useQuery(api.users.listAllUsers);
  const updateRole = useMutation(api.users.updateUserRole);
  const { user: me, isAdmin } = useUserRole();
  const [updating, setUpdating] = useState<string | null>(null);

  // The first user (earliest _creationTime) is the system owner.
  const systemOwnerId = users && users.length > 0
    ? [...users].sort((a, b) => a._creationTime - b._creationTime)[0]._id
    : null;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <div className="text-center">
          <div className="font-mono font-bold tracking-widest text-sm">ACCESS DENIED</div>
          <div className="text-xs text-muted-foreground mt-1 tracking-wider">Administrator privileges required</div>
        </div>
      </div>
    );
  }

  const handleRoleChange = async (userId: Id<"users">, role: Role) => {
    setUpdating(userId);
    try {
      await updateRole({ userId, role });
      toast.success(`Role updated to ${role}`);
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Failed to update role");
      }
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Role reference */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(ROLE_CFG) as [Role, typeof ROLE_CFG[Role]][]).map(([role, cfg]) => (
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-4"
            style={{ borderColor: cfg.border, background: cfg.bg }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div style={{ color: cfg.color }}>{cfg.icon}</div>
              <span className="font-mono font-bold text-xs tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
            </div>
            <p className="text-[10px] text-muted-foreground tracking-wide leading-relaxed">{cfg.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-xs tracking-widest">REGISTERED USERS</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{users?.length ?? "—"} TOTAL</span>
        </div>

        {!users ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground tracking-widest">NO USERS FOUND</div>
        ) : (
          <div className="divide-y divide-border/50">
            {users.map((u, i) => {
              const isMe = u._id === me?._id;
              const isOwner = u._id === systemOwnerId;
              const isUpdating = updating === u._id;
              return (
                <motion.div
                  key={u._id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn("flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-accent/10 transition-colors", isMe && "bg-primary/5")}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span className="font-mono font-bold text-xs text-primary">
                      {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm tracking-wide truncate">{u.name ?? "Unnamed User"}</span>
                      {isMe && (
                        <span className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">YOU</span>
                      )}
                      {isOwner && (
                        <span className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">OWNER</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{u.email ?? "No email"}</div>
                  </div>

                  {/* Current role */}
                  <div className="shrink-0">
                    <RoleBadge role={u.role as Role} />
                  </div>

                  {/* Role selector — only for non-owner, non-self users */}
                  {!isMe && !isOwner && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(["admin", "operator", "viewer"] as Role[]).map(role => {
                        const cfg = ROLE_CFG[role];
                        const isActive = u.role === role;
                        return (
                          <button
                            key={role}
                            disabled={isUpdating || isActive}
                            onClick={() => handleRoleChange(u._id, role)}
                            className={cn(
                              "px-2.5 py-1 rounded text-[9px] font-bold tracking-widest transition-all cursor-pointer disabled:cursor-not-allowed",
                              isActive
                                ? "opacity-100"
                                : "opacity-40 hover:opacity-80"
                            )}
                            style={isActive
                              ? { color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }
                              : { color: cfg.color, border: `1px solid ${cfg.border}` }
                            }
                          >
                            {isUpdating && isActive ? "..." : cfg.label}
                          </button>
                        );
                      })}
                      {isUpdating && (
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-primary"
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity }}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Access matrix */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <span className="font-mono font-bold text-xs tracking-widest">ACCESS MATRIX</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-5 py-3 text-left font-bold tracking-widest text-muted-foreground">FEATURE</th>
                {(["admin", "operator", "viewer"] as Role[]).map(r => (
                  <th key={r} className="px-4 py-3 text-center font-bold tracking-widest" style={{ color: ROLE_CFG[r].color }}>{ROLE_CFG[r].label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "Dashboard & Analytics", admin: true, operator: true, viewer: true },
                { feature: "Alerts & Monitoring", admin: true, operator: true, viewer: true },
                { feature: "Digital Twin Viewer", admin: true, operator: true, viewer: true },
                { feature: "Historical Data", admin: true, operator: true, viewer: true },
                { feature: "Simulation Controls", admin: true, operator: true, viewer: false },
                { feature: "Return Flow Control", admin: true, operator: true, viewer: false },
                { feature: "System Control Panel", admin: true, operator: true, viewer: false },
                { feature: "AI Decision Engine", admin: true, operator: true, viewer: false },
                { feature: "User Management", admin: true, operator: false, viewer: false },
                { feature: "Role Assignment", admin: true, operator: false, viewer: false },
              ].map((row, i) => (
                <tr key={i} className={cn("border-b border-border/30 hover:bg-accent/5 transition-colors", i % 2 === 0 ? "bg-muted/5" : "")}>
                  <td className="px-5 py-3 font-bold tracking-wider text-foreground/80">{row.feature}</td>
                  {(["admin", "operator", "viewer"] as Role[]).map(r => (
                    <td key={r} className="px-4 py-3 text-center">
                      {row[r]
                        ? <CheckCircle className="w-3.5 h-3.5 inline text-green-400" />
                        : <span className="text-muted-foreground/30">—</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest">USER ACCESS CONTROL</h1>
        </div>
        <p className="text-xs text-muted-foreground tracking-widest ml-11">ROLE MANAGEMENT · PERMISSIONS · ACCESS MATRIX</p>
      </motion.div>

      <AuthLoading>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <div className="font-mono font-bold tracking-widest text-sm mb-1">AUTHENTICATION REQUIRED</div>
            <div className="text-xs text-muted-foreground mb-4 tracking-wider">Sign in to access user management</div>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <AdminPanelInner />
      </Authenticated>
    </div>
  );
}
