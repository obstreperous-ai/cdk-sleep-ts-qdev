/**
 * Sleep Audio Processor Lambda Function
 * 
 * This Lambda function performs complete audio processing from input to output:
 * - Receives input from the Step Functions state machine (S3 event details, audioId)
 * - Validates required input fields and file extensions
 * - Downloads files from input S3 bucket
 * - Processes audio or converts text-to-speech using Polly
 * - Uploads processed audio to output S3 bucket
 * - Updates DynamoDB with output metadata
 * - Returns enriched metadata response
 * 
 * Future enhancements:
 * - Audio format validation
 * - Metadata extraction (duration, bitrate, codec)
 * - Quality checks and validation
 * - Content analysis
 */

import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

const dynamoDBClient = new DynamoDBClient({});
const s3Client = new S3Client({});
const pollyClient = new PollyClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const INPUT_BUCKET = process.env.INPUT_BUCKET_NAME;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET_NAME;

// Supported file extensions for audio processing
const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.flac', '.ogg'];
const SUPPORTED_TEXT_EXTENSIONS = ['.txt'];
const ALL_SUPPORTED_EXTENSIONS = [...SUPPORTED_AUDIO_EXTENSIONS, ...SUPPORTED_TEXT_EXTENSIONS];

/**
 * Validates if the file extension is supported for processing
 */
function isValidFileExtension(key: string): boolean {
  return ALL_SUPPORTED_EXTENSIONS.some(ext => key.toLowerCase().endsWith(ext));
}

export interface AudioProcessorInput {
  executionId: string;
  timestamp: string;
  bucket: string;
  key: string;
  size: string;
  etag: string;
  text?: string;
  voiceId?: string;
  dynamoResult?: any;
}

export interface AudioProcessorOutput {
  success: boolean;
  message: string;
  outputBucket?: string;
  outputKey?: string;
  fileSize?: number;
  metadata: {
    audioId: string;
    processingTimestamp: string;
    bucket: string;
    key: string;
    status: string;
  };
}

/**
 * Structured logging helper - logs in JSON format for better CloudWatch Insights queries
 * Helper to convert stream to buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Helper to convert stream to string
 */
async function streamToString(stream: any): Promise<string> {
  const buffer = await streamToBuffer(stream);
  return buffer.toString('utf-8');
}

/**
 * Structured logging helper - logs in JSON format for better CloudWatch Insights queries
 */
function logStructured(level: 'INFO' | 'ERROR' | 'WARN', message: string, context: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: context.requestId || 'unknown',
    executionId: context.executionId || 'unknown',
    status: context.status || 'unknown',
    ...context,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Main Lambda handler function - processes audio files from input to output
 */
export const handler = async (event: AudioProcessorInput): Promise<AudioProcessorOutput> => {
  const requestContext = {
    requestId: event.executionId,
    executionId: event.executionId,
    status: 'STARTED',
  };

  logStructured('INFO', 'Audio Processor Lambda invoked', { ...requestContext, input: event });

  try {
    // Validate required input fields
    if (!event.executionId || !event.bucket || !event.key) {
      const missingFields = [];
      if (!event.executionId) missingFields.push('executionId');
      if (!event.bucket) missingFields.push('bucket');
      if (!event.key) missingFields.push('key');
      
      const error = new Error(
        `Input Validation Failed: Missing required fields: ${missingFields.join(', ')}`
      );
      
      logStructured('ERROR', 'Input validation failed', {
        ...requestContext,
        status: 'VALIDATION_FAILED',
        error: error.message,
        missingFields,
      });
      
      throw error;
    }

    // Validate file extension
    if (!isValidFileExtension(event.key)) {
      const error = new Error(
        `Unsupported file format. File: ${event.key}. Supported formats: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}`
      );
      
      logStructured('ERROR', 'File extension validation failed', {
        ...requestContext,
        status: 'INVALID_FILE_FORMAT',
        error: error.message,
        fileName: event.key,
        supportedFormats: ALL_SUPPORTED_EXTENSIONS,
      });
      
      throw error;
    }

    // Additional validation: Check file size (if provided)
    if (event.size) {
      const sizeInBytes = parseInt(event.size, 10);
      const maxSizeInBytes = 100 * 1024 * 1024; // 100 MB limit
      if (sizeInBytes > maxSizeInBytes) {
        const sizeMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
        const error = new Error(
          `File Size Limit Exceeded: File size (${sizeMB} MB) exceeds maximum of 100 MB`
        );
        
        logStructured('ERROR', 'File size limit exceeded', {
          ...requestContext,
          status: 'FILE_TOO_LARGE',
          error: error.message,
          fileSizeMB: sizeMB,
          maxSizeMB: 100,
        });
        
        throw error;
      }
    }

    logStructured('INFO', 'Audio validation successful', {
      ...requestContext,
      status: 'VALIDATING',
      audioId: event.executionId,
      s3Location: `s3://${event.bucket}/${event.key}`,
      fileSize: event.size,
    });

    const isText = SUPPORTED_TEXT_EXTENSIONS.some(ext => event.key.toLowerCase().endsWith(ext));
    let audioBuffer: Buffer;
    let outputFilename: string;
    let mimeType: string;

    if (isText) {
      // Text-to-speech flow
      logStructured('INFO', 'Starting text-to-speech synthesis', { ...requestContext, status: 'SYNTHESIZING' });
      const getCmd = new GetObjectCommand({ Bucket: event.bucket, Key: event.key });
      const s3Obj = await s3Client.send(getCmd);
      const textContent = await streamToString(s3Obj.Body as any);
      
      const pollyCmd = new SynthesizeSpeechCommand({
        Text: textContent,
        OutputFormat: 'mp3',
        VoiceId: event.voiceId || 'Joanna',
        Engine: 'neural',
      });
      const pollyResp = await pollyClient.send(pollyCmd);
      audioBuffer = await streamToBuffer(pollyResp.AudioStream as any);
      
      const ts = Date.now();
      outputFilename = event.key.replace(/\.txt$/i, `_${ts}.mp3`);
      mimeType = 'audio/mpeg';
    } else {
      // Audio processing flow
      logStructured('INFO', 'Processing audio file', { ...requestContext, status: 'PROCESSING_AUDIO' });
      const getCmd = new GetObjectCommand({ Bucket: event.bucket, Key: event.key });
      const s3Obj = await s3Client.send(getCmd);
      audioBuffer = await streamToBuffer(s3Obj.Body as any);
      
      const ts = Date.now();
      const ext = event.key.substring(event.key.lastIndexOf('.'));
      const base = event.key.substring(0, event.key.lastIndexOf('.'));
      outputFilename = `${base}_processed_${ts}${ext}`;
      mimeType = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
    }

    // Upload to output bucket
    if (!OUTPUT_BUCKET) throw new Error('OUTPUT_BUCKET_NAME not configured');
    
    logStructured('INFO', 'Uploading processed audio to output bucket', {
      ...requestContext,
      status: 'UPLOADING',
      outputBucket: OUTPUT_BUCKET,
      outputKey: outputFilename,
      fileSize: audioBuffer.length,
    });
    
    const putCmd = new PutObjectCommand({
      Bucket: OUTPUT_BUCKET,
      Key: outputFilename,
      Body: audioBuffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256',
    });
    await s3Client.send(putCmd);

    const updateCmd = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { audioId: { S: event.executionId }, createdAt: { S: event.timestamp } },
      UpdateExpression: 'SET #st = :st, outputBucket = :ob, outputKey = :ok, fileSize = :fs, updatedAt = :ua',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: {
        ':st': { S: 'COMPLETED' },
        ':ob': { S: OUTPUT_BUCKET },
        ':ok': { S: outputFilename },
        ':fs': { N: audioBuffer.length.toString() },
        ':ua': { S: new Date().toISOString() },
      },
    });
    await dynamoDBClient.send(updateCmd);

    // Return structured output
    const output: AudioProcessorOutput = {
      success: true,
      message: 'Audio metadata processed successfully',
      outputBucket: OUTPUT_BUCKET,
      outputKey: outputFilename,
      fileSize: audioBuffer.length,
      metadata: {
        audioId: event.executionId,
        processingTimestamp: new Date().toISOString(),
        bucket: event.bucket,
        key: event.key,
        status: 'COMPLETED'
      }
    };

    logStructured('INFO', 'Audio processing completed successfully', {
      ...requestContext,
      status: 'COMPLETED',
      output,
    });
    
    return output;
  } catch (error) {
    logStructured('ERROR', 'Fatal error processing audio', {
      ...requestContext,
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
