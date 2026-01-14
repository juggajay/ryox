import { FullConfig } from '@playwright/test';
import { cleanupTestData } from './utils/test-data';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up test data...');

  try {
    await cleanupTestData();
    console.log('✅ Test data cleaned up successfully');
  } catch (error) {
    console.error('⚠️ Failed to cleanup test data:', error);
    // Don't throw - cleanup failures shouldn't fail the test run
  }
}

export default globalTeardown;
