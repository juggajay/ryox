import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { TEST_OWNER, TEST_WORKER, TEST_BUILDER, TEST_JOB } from './auth-helpers';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface TestDataIds {
  organizationId: string;
  ownerId: string;
  workerId?: string;
  workerUserId?: string;
  builderId?: string;
  jobId?: string;
}

export async function seedAllTestData(): Promise<TestDataIds> {
  // Seed organization and owner
  const orgResult = await convex.mutation(api.testing.seedTestOrganization, {
    orgName: TEST_OWNER.orgName,
    ownerEmail: TEST_OWNER.email,
    ownerName: TEST_OWNER.name,
    ownerPassword: TEST_OWNER.password,
  });

  const ids: TestDataIds = {
    organizationId: orgResult.organizationId,
    ownerId: orgResult.userId!,
  };

  // Seed worker
  const workerResult = await convex.mutation(api.testing.seedTestWorker, {
    organizationId: orgResult.organizationId,
    name: TEST_WORKER.name,
    email: TEST_WORKER.email,
    phone: TEST_WORKER.phone,
    password: TEST_WORKER.password,
    payRate: TEST_WORKER.payRate,
    chargeOutRate: TEST_WORKER.chargeOutRate,
  });
  ids.workerId = workerResult.workerId;
  ids.workerUserId = workerResult.userId;

  // Seed builder
  const builderResult = await convex.mutation(api.testing.seedTestBuilder, {
    organizationId: orgResult.organizationId,
    companyName: TEST_BUILDER.companyName,
    contactName: TEST_BUILDER.contactName,
    contactEmail: TEST_BUILDER.contactEmail,
    contactPhone: TEST_BUILDER.contactPhone,
  });
  ids.builderId = builderResult.builderId;

  // Seed job
  const jobResult = await convex.mutation(api.testing.seedTestJob, {
    organizationId: orgResult.organizationId,
    builderId: builderResult.builderId,
    name: TEST_JOB.name,
    siteAddress: TEST_JOB.siteAddress,
    jobType: TEST_JOB.jobType,
    quotedPrice: TEST_JOB.quotedPrice,
    status: 'active',
  });
  ids.jobId = jobResult.jobId;

  return ids;
}

export async function cleanupTestData(): Promise<void> {
  await convex.mutation(api.testing.cleanupTestData, {
    orgName: TEST_OWNER.orgName,
  });
}
