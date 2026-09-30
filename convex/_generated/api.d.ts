/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agentAnalysis from "../agentAnalysis.js";
import type * as agentTools from "../agentTools.js";
import type * as chat from "../chat.js";
import type * as chatAction from "../chatAction.js";
import type * as devices from "../devices.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as safetyPolicy from "../safetyPolicy.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agentAnalysis: typeof agentAnalysis;
  agentTools: typeof agentTools;
  chat: typeof chat;
  chatAction: typeof chatAction;
  devices: typeof devices;
  http: typeof http;
  notifications: typeof notifications;
  safetyPolicy: typeof safetyPolicy;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

