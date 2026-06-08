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

export const handler = async (event: AudioProcessorInput): Promise<AudioProcessorOutput> => {
  console.log('Audio Processor Lambda invoked with input:', JSON.stringify(event, null, 2));

  try {
    // Validate required input fields
    if (!event.executionId || !event.bucket || !event.key) {
      throw new Error('Missing required input fields: executionId, bucket, or key');
    }

    // Log processing details
    // Validate file extension
    if (!isValidFileExtension(event.key)) {
      const error = new Error(
        `Unsupported file format. File: ${event.key}. Supported formats: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}`
      );
      console.error('File extension validation failed:', error.message);
      throw error;
    }

    // Additional validation: Check file size (if provided)
    if (event.size) {
      const sizeInBytes = parseInt(event.size, 10);
      const maxSizeInBytes = 100 * 1024 * 1024; // 100 MB limit
      if (sizeInBytes > maxSizeInBytes) {
        const error = new Error(`File size exceeds maximum allowed size of 100 MB. Actual size: ${sizeInBytes} bytes`);
        console.error('File size validation failed:', error.message);
        throw error;
      }
    }

    console.log(`Processing audio for audioId: ${event.executionId}`);
    console.log(`S3 Location: s3://${event.bucket}/${event.key}`);
    console.log(`File size: ${event.size} bytes`);

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

    console.log('Audio Processor Lambda completed successfully:', JSON.stringify(output, null, 2));
    return output;
  } catch (error) {
    console.error('Error processing audio:', error);
    throw error;
  }
};
