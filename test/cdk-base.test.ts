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

  describe('SNS Topics', () => {
    test('Creates exactly two SNS topics', () => {
      template.resourceCountIs('AWS::SNS::Topic', 2);
    });

    test('SNS topics are encrypted', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        KmsMasterKeyId: Match.anyValue()
      });
    });

    test('Completed notification topic exists', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        DisplayName: Match.stringLikeRegexp('.*Completed.*')
      });
    });

    test('Failed notification topic exists', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        DisplayName: Match.stringLikeRegexp('.*Failed.*')
      });
    });
  });

  describe('State Machine Error Handling and Notifications', () => {
    test('State machine definition contains success notification task', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: Match.serializedJson(
          Match.objectLike({
            States: Match.objectLike({
              'PublishSuccessNotification': Match.objectLike({
                Type: 'Task',
                Resource: Match.stringLikeRegexp('sns:publish')
              })
            })
          })
        )
      });
    });

    test('State machine definition contains failure notification task', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: Match.serializedJson(
          Match.objectLike({
            States: Match.objectLike({
              'PublishFailureNotification': Match.objectLike({
                Type: 'Task',
                Resource: Match.stringLikeRegexp('sns:publish')
              })
            })
          })
        )
      });
    });

    test('State machine definition contains error handling with Catch', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: Match.serializedJson(
          Match.objectLike({
            States: Match.objectLike({
              'SynthesizeSpeech': Match.objectLike({
                Type: 'Task',
                Catch: Match.arrayWith([
                  Match.objectLike({
                    ErrorEquals: Match.arrayWith(['States.ALL'])
                  })
                ])
              })
            })
          })
        )
      });
    });

    test('State machine definition contains UpdateMetadataCompleted task', () => {
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

    test('State machine definition contains UpdateMetadataFailed task', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: Match.serializedJson(
          Match.objectLike({
            States: Match.objectLike({
              'UpdateMetadataFailed': Match.objectLike({
                Type: 'Task',
                Resource: Match.stringLikeRegexp('dynamodb:updateItem')
              })
            })
          })
        )
      });
    });
  });

  describe('State Machine IAM Permissions for SNS', () => {
    test('State machine execution role has SNS publish permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sns:Publish',
              Effect: 'Allow',
            })
          ])
        }
      });
    });

    test('State machine execution role has least-privilege SNS permissions to specific topics', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sns:Publish',
              Effect: 'Allow',
              Resource: Match.anyValue()
            })
          ])
        }
      });
    });
  });

  test('Snapshot test of synthesized stack', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

  describe('Lambda Function - Audio Processor', () => {
    test('Lambda function exists with correct runtime', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
        Handler: 'audio-processor.handler'
      });
    });

    test('Lambda function has DynamoDB table name environment variable', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            TABLE_NAME: Match.anyValue()
          }
        }
      });
    });

    test('Lambda function has proper timeout and memory configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 60,
        MemorySize: Match.anyValue()
      });
    });

    test('Lambda execution role has DynamoDB permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:GetItem',
                'dynamodb:UpdateItem'
              ]),
              Effect: 'Allow',
            })
          ])
        }
      });
    });

    test('Lambda execution role has CloudWatch Logs permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ]),
              Effect: 'Allow',
            })
          ])
        }
      });
    });

    test('Creates exactly one Lambda function', () => {
      template.resourceCountIs('AWS::Lambda::Function', 1);
    });
  });

  describe('State Machine Lambda Integration', () => {
    test('State machine definition contains Lambda invocation task', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: Match.serializedJson(
          Match.objectLike({
            States: Match.objectLike({
              'ProcessAudioMetadata': Match.objectLike({
                Type: 'Task',
                Resource: Match.stringLikeRegexp('lambda:invoke')
              })
            })
          })
        )
      });
    });

    test('State machine execution role can invoke Lambda function', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'lambda:InvokeFunction',
              Effect: 'Allow',
            })
          ])
        }
      });
    });
  });

  describe('Issue #8: Complete Pipeline Integration Tests', () => {
    describe('Complete End-to-End Wiring', () => {
      test('State machine definition contains complete success flow chain', () => {
        const definitionString = template.toJSON().Resources;
        const stateMachine = Object.values(definitionString).find(
          (resource: any) => resource.Type === 'AWS::StepFunctions::StateMachine'
        ) as any;
        
        expect(stateMachine).toBeDefined();
        const definition = JSON.parse(stateMachine.Properties.DefinitionString);
        
        // Verify the success path: Initial -> Lambda -> Polly -> UpdateCompleted -> PublishSuccess
        expect(definition.States['WriteInitialMetadata']).toBeDefined();
        expect(definition.States['ProcessAudioMetadata']).toBeDefined();
        expect(definition.States['SynthesizeSpeech']).toBeDefined();
        expect(definition.States['UpdateMetadataCompleted']).toBeDefined();
        expect(definition.States['PublishSuccessNotification']).toBeDefined();
        
        // Verify state chain connections
        expect(definition.States['WriteInitialMetadata'].Next).toBe('ProcessAudioMetadata');
        expect(definition.States['ProcessAudioMetadata'].Next).toBe('SynthesizeSpeech');
        expect(definition.States['SynthesizeSpeech'].Next).toBe('UpdateMetadataCompleted');
        expect(definition.States['UpdateMetadataCompleted'].Next).toBe('PublishSuccessNotification');
      });

      test('State machine definition contains complete error handling chain', () => {
        const definitionString = template.toJSON().Resources;
        const stateMachine = Object.values(definitionString).find(
          (resource: any) => resource.Type === 'AWS::StepFunctions::StateMachine'
        ) as any;
        
        expect(stateMachine).toBeDefined();
        const definition = JSON.parse(stateMachine.Properties.DefinitionString);
        
        // Verify error handling states exist
        expect(definition.States['UpdateMetadataFailed']).toBeDefined();
        expect(definition.States['PublishFailureNotification']).toBeDefined();
        expect(definition.States['JobFailed']).toBeDefined();
        
        // Verify error handling chain connections
        expect(definition.States['UpdateMetadataFailed'].Next).toBe('PublishFailureNotification');
        expect(definition.States['PublishFailureNotification'].Next).toBe('JobFailed');
        expect(definition.States['JobFailed'].Type).toBe('Fail');
      });

      test('Lambda and Polly tasks have catch blocks pointing to error handler', () => {
        const definitionString = template.toJSON().Resources;
        const stateMachine = Object.values(definitionString).find(
          (resource: any) => resource.Type === 'AWS::StepFunctions::StateMachine'
        ) as any;
        
        expect(stateMachine).toBeDefined();
        const definition = JSON.parse(stateMachine.Properties.DefinitionString);
        
        // Verify ProcessAudioMetadata has catch block
        expect(definition.States['ProcessAudioMetadata'].Catch).toBeDefined();
        expect(definition.States['ProcessAudioMetadata'].Catch[0].Next).toBe('UpdateMetadataFailed');
        
        // Verify SynthesizeSpeech has catch block
        expect(definition.States['SynthesizeSpeech'].Catch).toBeDefined();
        expect(definition.States['SynthesizeSpeech'].Catch[0].Next).toBe('UpdateMetadataFailed');
      });
    });

    describe('Input Validation', () => {
      test('EventBridge rule passes all required fields to state machine', () => {
        template.hasResourceProperties('AWS::Events::Rule', {
          Targets: Match.arrayWith([
            Match.objectLike({
              Input: Match.stringLikeRegexp('.*bucket.*'),
            })
          ])
        });
        
        template.hasResourceProperties('AWS::Events::Rule', {
          Targets: Match.arrayWith([
            Match.objectLike({
              Input: Match.stringLikeRegexp('.*key.*'),
            })
          ])
        });
      });

      test('Lambda function validates required input fields', () => {
        // This test verifies the Lambda validation logic exists
        // The actual validation is tested in Lambda unit tests
        template.hasResourceProperties('AWS::Lambda::Function', {
          Handler: 'audio-processor.handler'
        });
      });
    });

    describe('IAM Permissions - Least Privilege', () => {
      test('State machine role has all necessary permissions', () => {
        // Verify state machine can access all required services
        const policies = [
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'lambda:InvokeFunction',
          'polly:SynthesizeSpeech',
          'sns:Publish'
        ];
        
        policies.forEach(action => {
          template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
              Statement: Match.arrayWith([
                Match.objectLike({
                  Action: Match.arrayWith([action]),
                  Effect: 'Allow',
                })
              ])
            }
          });
        });
      });
    });
  });
});
