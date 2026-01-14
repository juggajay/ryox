/* eslint-disable */
/**
 * Generated API - placeholder until npx convex dev is run
 */

import type { GenericId } from "convex/values";

export type Id<TableName extends string> = GenericId<TableName>;

export declare const api: {
  auth: {
    signIn: any;
    signUp: any;
    getUser: any;
    getUserWithOrganization: any;
    inviteOwner: any;
    setPassword: any;
  };
  workers: {
    list: any;
    get: any;
    create: any;
    update: any;
    addCertification: any;
    deleteCertification: any;
    getExpiringCertifications: any;
  };
  workerInvites: {
    createInvite: any;
    getInviteByToken: any;
    acceptInvite: any;
    listInvites: any;
    cancelInvite: any;
  };
  builders: {
    list: any;
    get: any;
    create: any;
    update: any;
    addContact: any;
    updateContact: any;
    deleteContact: any;
  };
  jobs: {
    list: any;
    get: any;
    create: any;
    update: any;
    allocateWorker: any;
    removeAllocation: any;
    getWorkerJobs: any;
  };
};
