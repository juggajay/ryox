/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as builders from "../builders.js";
import type * as chat from "../chat.js";
import type * as embeddings from "../embeddings.js";
import type * as expenses from "../expenses.js";
import type * as files from "../files.js";
import type * as invoices from "../invoices.js";
import type * as jobs from "../jobs.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeScraper from "../knowledgeScraper.js";
import type * as knowledgeScraperHelpers from "../knowledgeScraperHelpers.js";
import type * as lib_chunker from "../lib/chunker.js";
import type * as organizations from "../organizations.js";
import type * as overheads from "../overheads.js";
import type * as reports from "../reports.js";
import type * as testing from "../testing.js";
import type * as timesheets from "../timesheets.js";
import type * as workerInvites from "../workerInvites.js";
import type * as workers from "../workers.js";
import type * as xero from "../xero.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  builders: typeof builders;
  chat: typeof chat;
  embeddings: typeof embeddings;
  expenses: typeof expenses;
  files: typeof files;
  invoices: typeof invoices;
  jobs: typeof jobs;
  knowledge: typeof knowledge;
  knowledgeScraper: typeof knowledgeScraper;
  knowledgeScraperHelpers: typeof knowledgeScraperHelpers;
  "lib/chunker": typeof lib_chunker;
  organizations: typeof organizations;
  overheads: typeof overheads;
  reports: typeof reports;
  testing: typeof testing;
  timesheets: typeof timesheets;
  workerInvites: typeof workerInvites;
  workers: typeof workers;
  xero: typeof xero;
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
