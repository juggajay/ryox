import { FullConfig } from '@playwright/test';
import { seedAllTestData, TestDataIds } from './utils/test-data';

let testDataIds: TestDataIds;

async function globalSetup(config: FullConfig) {
  console.log('🌱 Seeding test data...');

  try {
    testDataIds = await seedAllTestData();
    console.log('✅ Test data seeded successfully');
    console.log(`   Organization: ${testDataIds.organizationId}`);
    console.log(`   Owner: ${testDataIds.ownerId}`);
    console.log(`   Worker: ${testDataIds.workerId}`);
    console.log(`   Builder: ${testDataIds.builderId}`);
    console.log(`   Job: ${testDataIds.jobId}`);
  } catch (error) {
    console.error('❌ Failed to seed test data:', error);
    throw error;
  }
}

export default globalSetup;
export { testDataIds };
