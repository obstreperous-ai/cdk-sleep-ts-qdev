import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';

export class CdkBaseStack extends cdk.Stack {
  public readonly inputBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly eventRule: events.Rule;
  public readonly stateMachine: sfn.StateMachine;
  public readonly metadataTable: dynamodb.Table;
  public readonly completedTopic: sns.Topic;
  public readonly failedTopic: sns.Topic;

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
    // SNS Topics for pipeline notifications
    this.completedTopic = new sns.Topic(this, 'SleepAudioPipelineCompletedTopic', {
      displayName: 'Sleep Audio Pipeline Completed Notifications',
      topicName: 'SleepAudioPipelineCompleted',
      masterKey: cdk.aws_kms.Alias.fromAliasName(this, 'SnsKeyCompleted', 'alias/aws/sns'),
    });

    this.failedTopic = new sns.Topic(this, 'SleepAudioPipelineFailedTopic', {
      displayName: 'Sleep Audio Pipeline Failed Notifications',
      topicName: 'SleepAudioPipelineFailed',
      masterKey: cdk.aws_kms.Alias.fromAliasName(this, 'SnsKeyFailed', 'alias/aws/sns'),
    });

    // CloudWatch Log Group for State Machine
      logGroupName: `/aws/vendedlogs/states/${this.stackName}-SleepAudioPipeline`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Step Functions State Machine with Polly Integration
    // Step Functions State Machine with DynamoDB, Polly, SNS Integration and Error Handling
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
    // Task 2: Update metadata to FAILED status (for error path)
    const updateMetadataFailed = new tasks.DynamoUpdateItem(this, 'UpdateMetadataFailed', {
      table: this.metadataTable,
      key: {
        audioId: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.executionId')),
        createdAt: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.timestamp')),
      },
      updateExpression: 'SET #status = :failed, #updatedAt = :updatedAt, #errorMsg = :errorMsg',
      expressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#errorMsg': 'errorMessage',
      },
      expressionAttributeValues: {
        ':failed': tasks.DynamoAttributeValue.fromString('FAILED'),
        ':updatedAt': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
        ':errorMsg': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.Error')),
      },
      resultPath: '$.dynamoUpdateResult',
    });

    // Task 3: Publish failure notification to SNS
    const publishFailureNotification = new tasks.SnsPublish(this, 'PublishFailureNotification', {
      topic: this.failedTopic,
      message: sfn.TaskInput.fromObject({
        eventType: 'AudioProcessingFailed',
        executionId: sfn.JsonPath.stringAt('$.executionId'),
        bucket: sfn.JsonPath.stringAt('$.bucket'),
        key: sfn.JsonPath.stringAt('$.key'),
        error: sfn.JsonPath.stringAt('$.Error'),
        timestamp: sfn.JsonPath.stringAt('$$.State.EnteredTime'),
      }),
      subject: 'Sleep Audio Pipeline - Processing Failed',
      resultPath: '$.snsResult',
    });

    // Task 4: Fail state after error handling
    const jobFailed = new sfn.Fail(this, 'JobFailed', {
      error: 'ProcessingFailed',
      cause: 'Audio processing pipeline failed',
    });

    // Define error handling chain
    const errorHandlingChain = updateMetadataFailed
      .next(publishFailureNotification)
      .next(jobFailed);

    // Task 5: Polly task with error handling
    const synthesizeSpeech = new tasks.CallAwsService(this, 'SynthesizeSpeech', {
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

    }).addCatch(errorHandlingChain, {
      errors: ['States.ALL'],
      resultPath: '$.Error',
    // Create state machine definition with basic flow
    const definition = synthesizeSpeech;
    // Task 6: Update metadata to COMPLETED status (success path)
    const updateMetadataCompleted = new tasks.DynamoUpdateItem(this, 'UpdateMetadataCompleted', {
      table: this.metadataTable,
      key: {
        audioId: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.executionId')),
        createdAt: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.timestamp')),
      },
      updateExpression: 'SET #status = :completed, #updatedAt = :updatedAt',
      expressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      expressionAttributeValues: {
        ':completed': tasks.DynamoAttributeValue.fromString('COMPLETED'),
        ':updatedAt': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
      resultPath: '$.dynamoUpdateResult',
    });
    this.stateMachine = new sfn.StateMachine(this, 'SleepAudioPipelineStateMachine', {
    // Task 7: Publish success notification to SNS
    const publishSuccessNotification = new tasks.SnsPublish(this, 'PublishSuccessNotification', {
      topic: this.completedTopic,
      message: sfn.TaskInput.fromObject({
        eventType: 'AudioProcessingCompleted',
        executionId: sfn.JsonPath.stringAt('$.executionId'),
        bucket: sfn.JsonPath.stringAt('$.bucket'),
        key: sfn.JsonPath.stringAt('$.key'),
        status: 'COMPLETED',
        timestamp: sfn.JsonPath.stringAt('$$.State.EnteredTime'),
      }),
      subject: 'Sleep Audio Pipeline - Processing Completed',
      resultPath: '$.snsResult',
    });

    // Create state machine definition with complete flow
    const definition = writeInitialMetadata
      .next(synthesizeSpeech)
      .next(updateMetadataCompleted)
      .next(publishSuccessNotification);

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
    // Grant state machine permissions to publish to SNS topics
    this.completedTopic.grantPublish(this.stateMachine);
    this.failedTopic.grantPublish(this.stateMachine);

    // EventBridge Rule - triggers on S3 object creation events
      description: 'Triggers when audio files are uploaded to the input bucket',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
      },
      enabled: true,
    });

    // CFN Outputs for easy access to bucket names
    // Add Step Functions state machine as target for EventBridge rule
      new targets.SfnStateMachine(this.stateMachine, {
        input: events.RuleTargetInput.fromObject({
          bucket: events.EventField.fromPath('$.detail.bucket.name'),
          key: events.EventField.fromPath('$.detail.object.key'),
          size: events.EventField.fromPath('$.detail.object.size'),
          etag: events.EventField.fromPath('$.detail.object.etag'),
          // Placeholder parameters for Polly
          text: 'Welcome to the sleep audio pipeline. This is a placeholder text for testing.',
          voiceId: 'Joanna',
          // Add execution metadata for DynamoDB
          executionId: events.EventField.fromPath('$.id'),
          timestamp: events.EventField.fromPath('$.time'),
        }),
      })
    );

    new cdk.CfnOutput(this, 'InputBucketName', {
      value: this.inputBucket.bucketName,
      description: 'Name of the input S3 bucket for raw audio files',
    // CFN Outputs for easy access to bucket names and resources
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
