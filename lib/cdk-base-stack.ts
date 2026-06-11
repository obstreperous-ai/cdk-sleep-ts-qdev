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
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

/**
 * Environment-specific configuration interface
 */
export interface EnvironmentConfig {
  environment: string;
  account: string;
  region: string;
  logRetentionDays: number;
  tracingEnabled: boolean;
  inputBucketName?: string;
  outputBucketName?: string;
  lambdaMemorySize?: number;
}

/**
 * Extended stack props with environment configuration
 */
export interface CdkBaseStackProps extends cdk.StackProps {
  envConfig?: EnvironmentConfig;
}

/**
 * Sleep Audio Pipeline Stack with multi-environment support
 * 
 * Supports dev, stage, and prod environments with different configurations:
 * - Log retention (7 days for dev, 14 for stage, 30 for prod)
 * - X-Ray tracing (disabled in dev, enabled in stage/prod)
 * - Resource sizing and naming conventions
 */
export class CdkBaseStack extends cdk.Stack {
  public readonly inputBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly eventRule: events.Rule;
  public readonly stateMachine: sfn.StateMachine;
  public readonly metadataTable: dynamodb.Table;
  public readonly completedTopic: sns.Topic;
  public readonly failedTopic: sns.Topic;
  public readonly audioProcessorFunction: lambda.Function;

  private readonly envConfig: EnvironmentConfig;

  constructor(scope: Construct, id: string, props?: CdkBaseStackProps) {
    super(scope, id, props);


    // Set default environment config if not provided (backward compatibility)
    this.envConfig = props?.envConfig ?? {
      environment: 'dev',
      account: this.account,
      region: this.region,
      logRetentionDays: 30,
      tracingEnabled: false,
      lambdaMemorySize: 512
    };

    // Determine log retention based on environment
    const logRetention = this.getLogRetention(this.envConfig.logRetentionDays);

    // Environment-specific naming suffix
    const envSuffix = this.envConfig.environment;
    
    // Input S3 Bucket - accepts raw audio files and text for processing
    this.inputBucket = new s3.Bucket(this, 'SleepAudioInputBucket', {
      ...(this.envConfig.inputBucketName && { bucketName: this.envConfig.inputBucketName }),
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      eventBridgeEnabled: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Output S3 Bucket - stores processed sleep audio files
    this.outputBucket = new s3.Bucket(this, 'SleepAudioOutputBucket', {
      ...(this.envConfig.outputBucketName && { bucketName: this.envConfig.outputBucketName }),
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // DynamoDB Table - stores metadata for sleep audio processing
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

    // SNS Topics - notifications for pipeline completion and failures
    this.completedTopic = new sns.Topic(this, 'SleepAudioPipelineCompletedTopic', {
      displayName: 'Sleep Audio Pipeline Completed Notifications',
      topicName: `SleepAudioPipelineCompleted-${envSuffix}`,
      masterKey: cdk.aws_kms.Alias.fromAliasName(this, 'SnsKeyCompleted', 'alias/aws/sns'),
    });

    this.failedTopic = new sns.Topic(this, 'SleepAudioPipelineFailedTopic', {
      displayName: 'Sleep Audio Pipeline Failed Notifications',
      topicName: `SleepAudioPipelineFailed-${envSuffix}`,
      masterKey: cdk.aws_kms.Alias.fromAliasName(this, 'SnsKeyFailed', 'alias/aws/sns'),
    });

    // CloudWatch Log Group for State Machine with environment-specific retention
    const stateMachineLogGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: `/aws/vendedlogs/states/${this.stackName}-SleepAudioPipeline`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Function - Audio Processor
    this.audioProcessorFunction = new lambda.Function(this, 'SleepAudioProcessorFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'audio-processor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      environment: {
        TABLE_NAME: this.metadataTable.tableName,
        INPUT_BUCKET_NAME: this.inputBucket.bucketName,
        OUTPUT_BUCKET_NAME: this.outputBucket.bucketName,
      },
      description: 'Processes audio metadata and performs validation for the sleep audio pipeline',
      logRetention: logRetention,
      tracing: this.envConfig.tracingEnabled ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    // Grant Lambda permissions to access DynamoDB table
    this.metadataTable.grantReadWriteData(this.audioProcessorFunction);

    // Grant Lambda permissions to read from input bucket
    this.inputBucket.grantRead(this.audioProcessorFunction);

    // Grant Lambda permissions to write to output bucket
    this.outputBucket.grantWrite(this.audioProcessorFunction);

    // Grant Lambda function Polly permissions (for text-to-speech inside Lambda)
    this.audioProcessorFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['polly:SynthesizeSpeech'],
        resources: ['*'],
      })
    );

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


    // Add retry policy to DynamoDB PutItem
    writeInitialMetadata.addRetry({
      errors: [
        'States.TaskFailed',
        'DynamoDB.ProvisionedThroughputExceededException',
        'DynamoDB.RequestLimitExceeded',
        'DynamoDB.InternalServerError',
        'DynamoDB.ServiceUnavailable',
      ],
      interval: cdk.Duration.seconds(1),
      maxAttempts: 2,
      backoffRate: 1.5,
    });
    // Task 2: Process audio metadata with Lambda function
    const processAudioMetadata = new tasks.LambdaInvoke(this, 'ProcessAudioMetadata', {
      lambdaFunction: this.audioProcessorFunction,
      payload: sfn.TaskInput.fromObject({
        executionId: sfn.JsonPath.stringAt('$.executionId'),
        timestamp: sfn.JsonPath.stringAt('$.timestamp'),
        bucket: sfn.JsonPath.stringAt('$.bucket'),
        key: sfn.JsonPath.stringAt('$.key'),
        size: sfn.JsonPath.stringAt('$.size'),
        etag: sfn.JsonPath.stringAt('$.etag'),
        text: sfn.JsonPath.stringAt('$.text'),
        voiceId: sfn.JsonPath.stringAt('$.voiceId'),
      }),
      resultPath: '$.lambdaResult',
    });


    // Add retry policy to Lambda invocation with exponential backoff
    processAudioMetadata.addRetry({
      errors: [
        'States.TaskFailed',
        'Lambda.ServiceException',
        'Lambda.TooManyRequestsException',
        'Lambda.SdkClientException',
      ],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2.0,
    });
    // Task 3: Update metadata to FAILED status (for error path)
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

    // Task 4: Publish failure notification to SNS
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

    // Task 5: Fail state after error handling
    const jobFailed = new sfn.Fail(this, 'JobFailed', {
      error: 'ProcessingFailed',
      cause: 'Audio processing pipeline failed',
    });

    // Define error handling chain
    const errorHandlingChain = updateMetadataFailed
      .next(publishFailureNotification)
      .next(jobFailed);

    // Task 6: Polly task with error handling
    const pollyTask = new tasks.CallAwsService(this, 'SynthesizeSpeech', {
      errors: ['States.ALL'],
      resultPath: '$.Error',
    });

    // Add catch block to Polly task
      errors: ['States.ALL'],
    // Add catch block to Lambda task (handles full audio processing)
    processAudioMetadata.addCatch(errorHandlingChain, {
    });

    // Add error handling to Lambda task
    // Add catch block to Lambda task
      table: this.metadataTable,
    // Note: Lambda now handles full processing (download, process/Polly, upload, DB update)
    // So this UpdateMetadataCompleted task is now optional/redundant but kept for consistency
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


    // Add retry policy to DynamoDB UpdateItem
    updateMetadataCompleted.addRetry({
      errors: [
        'States.TaskFailed',
        'DynamoDB.ProvisionedThroughputExceededException',
        'DynamoDB.RequestLimitExceeded',
        'DynamoDB.InternalServerError',
      ],
      interval: cdk.Duration.seconds(1),
      maxAttempts: 2,
      backoffRate: 1.5,
    });
    // Task 8: Publish success notification to SNS
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
      .next(processAudioMetadata)
      .next(pollyTask)
      .next(publishSuccessNotification);

    // Create the state machine
    this.stateMachine = new sfn.StateMachine(this, 'SleepAudioPipelineStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      stateMachineName: `SleepAudioPipeline-${envSuffix}`,
      stateMachineType: sfn.StateMachineType.STANDARD,
      logs: {
        destination: stateMachineLogGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
      tracingEnabled: this.envConfig.tracingEnabled,

    // Grant state machine permissions to read from input bucket and write to output bucket
    this.inputBucket.grantRead(this.stateMachine);
    this.outputBucket.grantWrite(this.stateMachine);

    // Grant state machine permissions to publish to SNS topics
    this.completedTopic.grantPublish(this.stateMachine);
    this.failedTopic.grantPublish(this.stateMachine);

    // EventBridge Rule - triggers on S3 object creation events
    this.eventRule = new events.Rule(this, 'AudioUploadedRule', {
      description: 'Triggers when audio files are uploaded to the input bucket',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
      },
      enabled: true,
    });

    // Add Step Functions as target with input transformation
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
          // Add execution metadata for DynamoDB
          executionId: events.EventField.fromPath('$.id'),
          timestamp: events.EventField.fromPath('$.time'),
        }),
      })
    );

    // CFN Outputs for easy access to bucket names and resources
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


    // CloudWatch Alarms for critical failure paths
    
    // Alarm 1: State Machine Execution Failures
    const stateMachineFailureAlarm = new cloudwatch.Alarm(this, 'StateMachineFailureAlarm', {
      alarmName: `${this.stackName}-StateMachine-ExecutionFailures`,
      alarmDescription: 'Alert when Step Functions executions fail',
      metric: this.stateMachine.metricFailed({
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Stats.SUM,
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add SNS action to alarm
    stateMachineFailureAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.failedTopic.topicArn }),
    });

    // Alarm 2: Lambda Function Errors
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: `${this.stackName}-Lambda-Errors`,
      alarmDescription: 'Alert when Lambda function errors exceed threshold',
      metric: this.audioProcessorFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Stats.SUM,
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    lambdaErrorAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.failedTopic.topicArn }),
    });

    // Alarm 3: Lambda Duration (p99)
    const lambdaDurationAlarm = new cloudwatch.Alarm(this, 'LambdaDurationAlarm', {
      alarmName: `${this.stackName}-Lambda-HighDuration`,
      alarmDescription: 'Alert when Lambda p99 duration exceeds 50 seconds',
      metric: this.audioProcessorFunction.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'p99',
      }),
      threshold: 50000, // 50 seconds in milliseconds
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    lambdaDurationAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.failedTopic.topicArn }),
    });
    new cdk.CfnOutput(this, 'Environment', {
      value: this.envConfig.environment,
      description: 'Deployment environment (dev/stage/prod)',
    });
  }

  /**
   * Map log retention days to CDK RetentionDays enum
   */
  private getLogRetention(days: number): logs.RetentionDays {
    const retentionMap: { [key: number]: logs.RetentionDays } = {
      7: logs.RetentionDays.ONE_WEEK,
      14: logs.RetentionDays.TWO_WEEKS,
      30: logs.RetentionDays.ONE_MONTH,
      90: logs.RetentionDays.THREE_MONTHS,
    };
    
    return retentionMap[days] ?? logs.RetentionDays.ONE_MONTH;
  }
}
