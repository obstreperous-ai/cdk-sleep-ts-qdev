import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';

export class CdkBaseStack extends cdk.Stack {
  public readonly inputBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly eventRule: events.Rule;

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
    this.eventRule = new events.Rule(this, 'AudioUploadedRule', {
      description: 'Triggers when audio files are uploaded to the input bucket',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
      },
      enabled: true,
    });

    // CFN Outputs for easy access to bucket names
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
  }
}
