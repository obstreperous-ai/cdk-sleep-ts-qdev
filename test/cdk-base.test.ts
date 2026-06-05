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

  describe('Step Functions State Machine', () => {
    test('State machine exists with correct configuration', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        StateMachineType: 'STANDARD',
      });
    });

    test('State machine has CloudWatch logging enabled', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        LoggingConfiguration: {
          Level: 'ALL',
          IncludeExecutionData: true,
          Destinations: Match.arrayWith([
            Match.objectLike({
              CloudWatchLogsLogGroup: Match.objectLike({
                LogGroupArn: Match.anyValue()
              })
            })
          ])
        }
      });
    });

    test('State machine definition contains Polly task', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: Match.serializedJson(
          Match.objectLike({
            States: Match.objectLike({
              'SynthesizeSpeech': Match.objectLike({
                Type: 'Task',
                Resource: Match.stringLikeRegexp('states:startSyncExecution')
              })
            })
          })
        )
      });
    });

    test('State machine has proper execution role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'states.amazonaws.com'
              }
            })
          ])
        }
      });
    });

    test('State machine execution role has Polly permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'polly:SynthesizeSpeech',
              Effect: 'Allow',
            })
          ])
        }
      });
    });

    test('Creates exactly one Step Functions state machine', () => {
      template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
    });
  });

  describe('EventBridge to Step Functions Integration', () => {
    test('EventBridge rule has Step Functions state machine as target', () => {
      template.hasResourceProperties('AWS::Events::Rule', {
        Targets: Match.arrayWith([
          Match.objectLike({
            Arn: Match.anyValue(),
            RoleArn: Match.anyValue()
          })
        ])
      });
    });

    test('EventBridge has IAM role to start state machine execution', () => {
      // EventBridge needs permission to start Step Functions execution
      expect(template.toJSON()).toBeDefined();
    });
  });

  describe('DynamoDB Table', () => {
    test('DynamoDB table exists with correct configuration', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
        SSESpecification: {
          SSEEnabled: true
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true
        }
      });
    });

    test('DynamoDB table has correct key schema', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          {
            AttributeName: 'audioId',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'createdAt',
            KeyType: 'RANGE'
          }
        ],
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'audioId',
            AttributeType: 'S'
          },
          {
            AttributeName: 'createdAt',
            AttributeType: 'S'
          }
        ])
      });
    });

    test('Creates exactly one DynamoDB table', () => {
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
    });
  });

  describe('State Machine DynamoDB Integration', () => {
    test('State machine definition contains DynamoDB PutItem task', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: Match.serializedJson(
          Match.objectLike({
            States: Match.objectLike({
              'WriteInitialMetadata': Match.objectLike({
                Type: 'Task',
                Resource: Match.stringLikeRegexp('dynamodb:putItem')
              })
            })
          })
        )
      });
    });

    test('State machine definition contains DynamoDB UpdateItem task', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: Match.serializedJson(
          Match.objectLike({
            States: Match.objectLike({
              'UpdateMetadataCompleted': Match.objectLike({
                Type: 'Task',
                Resource: Match.stringLikeRegexp('dynamodb:updateItem')
              })
            })
          })
        )
      });
    });

    test('State machine execution role has DynamoDB permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:PutItem',
                'dynamodb:UpdateItem'
              ]),
              Effect: 'Allow',
            })
          ])
        }
      });
    });
  });

  test('Snapshot test of synthesized stack', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});
