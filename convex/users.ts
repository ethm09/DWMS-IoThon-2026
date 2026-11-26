import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// ── Helpers ────────────────────────────────────────────────────────────────

export async function getCurrentUserOrThrow(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "User not logged in",
    });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getCurrentUserOrThrow(ctx);
  if (user.role !== "admin") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return user;
}

// ── Auth sync ──────────────────────────────────────────────────────────────

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      const initialAdminEmail =
        process.env.DWMS_INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
      if (
        initialAdminEmail &&
        identity.emailVerified === true &&
        identity.email?.trim().toLowerCase() === initialAdminEmail &&
        user.role !== "admin"
      ) {
        await ctx.db.patch(user._id, { role: "admin" });
      }
      return user._id;
    }

    // Auth0 issues a new tokenIdentifier. Link an existing role record only
    // when the identity provider confirms ownership of the same email address.
    if (identity.email) {
      const normalizedEmail = identity.email.trim().toLowerCase();
      const matchingUsers = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .take(2);

      // Preserve links for existing records saved before normalized storage.
      if (normalizedEmail !== identity.email) {
        const legacy = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", identity.email!))
          .take(2);
        for (const record of legacy)
          if (!matchingUsers.some((match) => match._id === record._id))
            matchingUsers.push(record);
      }
      if (matchingUsers.length > 1) {
        throw new ConvexError({
          code: "AMBIGUOUS_IDENTITY",
          message:
            "Multiple DWMS users share this email. Ask an administrator to resolve the account link.",
        });
      }

      const existingUser = matchingUsers[0];
      if (existingUser) {
        if (identity.emailVerified !== true) {
          throw new ConvexError({
            code: "EMAIL_NOT_VERIFIED",
            message:
              "Verify your Auth0 email address before linking your existing DWMS account.",
          });
        }

        await ctx.db.patch(existingUser._id, {
          tokenIdentifier: identity.tokenIdentifier,
          name: identity.name ?? existingUser.name,
          email: identity.email?.trim().toLowerCase(),
          role:
            identity.emailVerified === true &&
            normalizedEmail ===
              process.env.DWMS_INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
              ? "admin"
              : existingUser.role,
        });
        return existingUser._id;
      }
    }

    // Only a verified, explicitly configured owner can bootstrap admin access.
    // New accounts otherwise start as viewers, even when the database is empty.
    const initialAdminEmail =
      process.env.DWMS_INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    const isInitialAdmin =
      !!initialAdminEmail &&
      identity.emailVerified === true &&
      identity.email?.trim().toLowerCase() === initialAdminEmail;
    const role = isInitialAdmin ? ("admin" as const) : ("viewer" as const);
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email?.trim().toLowerCase(),
      tokenIdentifier: identity.tokenIdentifier,
      role,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});

// ── Admin queries ──────────────────────────────────────────────────────────

export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

// ── Admin mutations ────────────────────────────────────────────────────────

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("operator"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (admin._id === args.userId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Cannot change your own role",
      });
    }

    const target = await ctx.db.get(args.userId);
    if (!target)
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    // Registration order does not establish ownership. Only the explicitly
    // configured bootstrap administrator retains protected admin access.
    const ownerEmail =
      process.env.DWMS_INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    if (
      ownerEmail &&
      target.email?.trim().toLowerCase() === ownerEmail &&
      target.role === "admin" &&
      args.role !== "admin"
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot remove the configured owner's administrator access",
      });
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});
