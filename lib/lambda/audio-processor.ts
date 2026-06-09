/**
 * Sleep Audio Processor Lambda Function
 * 
 * This Lambda function serves as a placeholder for future audio processing,
 * metadata enrichment, or validation logic. It currently:
 * - Receives input from the Step Functions state machine (S3 event details, audioId)
 * - Validates required input fields and file extensions
 * - Performs basic input validation
 * - Returns enriched metadata response
 * 
 * Future enhancements:
 * - Audio format validation
 * - Metadata extraction (duration, bitrate, codec)
 * - Quality checks and validation
 * - Content analysis
 */

import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoDBClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

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
  metadata: {
    audioId: string;
    processingTimestamp: string;
    bucket: string;
    key: string;
    size: string;
    status: string;
  };
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

    // Return enriched metadata
    const output: AudioProcessorOutput = {
      success: true,
      message: 'Audio metadata processed successfully',
      metadata: {
        audioId: event.executionId,
        processingTimestamp: new Date().toISOString(),
        bucket: event.bucket,
        key: event.key,
        size: event.size,
        status: 'VALIDATED'
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
