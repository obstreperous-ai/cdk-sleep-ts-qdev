#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { CdkBaseStack, EnvironmentConfig } from '../lib/cdk-base-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environmentName = app.node.tryGetContext('environment') || 'dev';

// Get environment-specific configuration from cdk.json
const environments = app.node.tryGetContext('environments');
let envConfig: EnvironmentConfig | undefined;

if (environments && environments[environmentName]) {
  const config = environments[environmentName];
  envConfig = {
    environment: environmentName,
    account: config.account,
    region: config.region,
    logRetentionDays: config.logRetentionDays,
    tracingEnabled: config.tracingEnabled,
    inputBucketName: config.inputBucketName,
    outputBucketName: config.outputBucketName,
    lambdaMemorySize: config.lambdaMemorySize,
  };
}

// Create stack with environment configuration
new CdkBaseStack(app, `CdkSleepAudioStack-${environmentName}`, {
  envConfig,
  env: envConfig ? {
    account: envConfig.account,
    region: envConfig.region,
  } : {
    // Fallback to environment variables for backward compatibility
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: `Sleep Audio Pipeline - ${environmentName} environment`,
  tags: {
    Environment: environmentName,
    Application: 'SleepAudioPipeline',
    ManagedBy: 'CDK',
  },
});

/**
 * Deployment instructions:
 * - npx cdk deploy --context environment=dev
 * - npx cdk deploy --context environment=stage
 * - npx cdk deploy --context environment=prod
 */
