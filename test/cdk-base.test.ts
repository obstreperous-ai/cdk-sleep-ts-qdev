import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as CdkBase from '../lib/cdk-base-stack';

describe('CdkBaseStack', () => {
  let app: cdk.App;
  let stack: CdkBase.CdkBaseStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new CdkBase.CdkBaseStack(app, 'MyTestStack');
    template = Template.fromStack(stack);
  });

  test('Stack creates successfully', () => {
    // Verify template can be synthesized
    expect(template.toJSON()).toBeDefined();
  });

  describe('S3 Buckets', () => {
    test('Input bucket exists with encryption and versioning', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256'
              }
            }
          ]
        },
        VersioningConfiguration: {
          Status: 'Enabled'
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        },
        NotificationConfiguration: {
          EventBridgeConfiguration: {
            EventBridgeEnabled: true
          }
        }
      });
    });

    test('Output bucket exists with encryption and versioning', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256'
              }
            }
          ]
        },
        VersioningConfiguration: {
          Status: 'Enabled'
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        }
      });
    });

    test('Creates exactly two S3 buckets', () => {
      template.resourceCountIs('AWS::S3::Bucket', 2);
    });
  });

  describe('EventBridge Rule', () => {
    test('EventBridge rule exists for S3 object created events', () => {
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          source: ['aws.s3'],
          'detail-type': ['Object Created']
        },
        State: 'ENABLED'
      });
    });
  });
});
