import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as logs from 'aws-cdk-lib/aws-logs';

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
export class CdkBaseStack extends cdk.Stack {
  public readonly inputBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly eventRule: events.Rule;
  public readonly stateMachine: sfn.StateMachine;

  public readonly metadataTable: dynamodb.Table;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Input S3 Bucket - accepts raw audio files and text for processing
    this.inputBucket = new s3.Bucket(this, 'SleepAudioInputBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      eventBridgeEnabled: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Output S3 Bucket - stores processed sleep audio files
    this.outputBucket = new s3.Bucket(this, 'SleepAudioOutputBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // EventBridge Rule - triggers on S3 object creation events
    // DynamoDB Table - stores audio pipeline metadata
    this.metadataTable = new dynamodb.Table(this, 'SleepAudioMetadataTable', {
      partitionKey: {
        name: 'audioId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const stateMachineLogGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: `/aws/vendedlogs/states/${this.stackName}-SleepAudioPipeline`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Step Functions State Machine with Polly Integration
    // Step Functions State Machine with DynamoDB and Polly Integration
    
    // Task 1: Write initial metadata to DynamoDB (status: PROCESSING)
    const writeInitialMetadata = new tasks.DynamoPutItem(this, 'WriteInitialMetadata', {
      table: this.metadataTable,
      item: {
        audioId: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.executionId')),
        createdAt: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.timestamp')),
        status: tasks.DynamoAttributeValue.fromString('PROCESSING'),
        inputBucket: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.bucket')),
        inputKey: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.key')),
        size: tasks.DynamoAttributeValue.numberFromString(sfn.JsonPath.stringAt('$.size')),
        etag: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.etag')),
        text: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.text')),
        voiceId: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.voiceId')),
        updatedAt: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.timestamp')),
      },
      resultPath: '$.dynamoResult',
    });

    // Task 2: Polly task with placeholder parameters
      service: 'polly',
      action: 'synthesizeSpeech',
      parameters: {
        Text: sfn.JsonPath.stringAt('$.text'),
        OutputFormat: 'mp3',
        VoiceId: sfn.JsonPath.stringAt('$.voiceId'),
        Engine: 'neural',
      },
      iamResources: ['*'],
      resultPath: '$.pollyResult',
    });

    // Create state machine definition with basic flow
    const definition = synthesizeSpeech;

    // Create the state machine with CloudWatch logging
    this.stateMachine = new sfn.StateMachine(this, 'SleepAudioPipelineStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      stateMachineType: sfn.StateMachineType.STANDARD,
      logs: {
        destination: stateMachineLogGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
      tracingEnabled: false, // Can be enabled in production
    });

    // Grant state machine permissions to read from input bucket and write to output bucket
    this.inputBucket.grantRead(this.stateMachine);
    this.outputBucket.grantWrite(this.stateMachine);

    this.eventRule = new events.Rule(this, 'AudioUploadedRule', {
      description: 'Triggers when audio files are uploaded to the input bucket',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
      },
      enabled: true,
    });

    // CFN Outputs for easy access to bucket names
    // Add Step Functions state machine as target for EventBridge rule
    this.eventRule.addTarget(
      new targets.SfnStateMachine(this.stateMachine, {
        input: events.RuleTargetInput.fromObject({
          bucket: events.EventField.fromPath('$.detail.bucket.name'),
          key: events.EventField.fromPath('$.detail.object.key'),
          size: events.EventField.fromPath('$.detail.object.size'),
          etag: events.EventField.fromPath('$.detail.object.etag'),
          // Placeholder parameters for Polly
          text: 'Welcome to the sleep audio pipeline. This is a placeholder text for testing.',
          voiceId: 'Joanna',
        }),
      })
    );

    new cdk.CfnOutput(this, 'InputBucketName', {
      value: this.inputBucket.bucketName,
      description: 'Name of the input S3 bucket for raw audio files',
      exportName: `${this.stackName}-InputBucket`,
    });

    new cdk.CfnOutput(this, 'OutputBucketName', {
      value: this.outputBucket.bucketName,
      description: 'Name of the output S3 bucket for processed audio files',
      exportName: `${this.stackName}-OutputBucket`,
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      description: 'ARN of the Step Functions state machine',
      exportName: `${this.stackName}-StateMachine`,
    });
  }
}
