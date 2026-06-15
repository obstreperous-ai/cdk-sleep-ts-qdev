/**
 * Unit tests for Audio Processor Lambda Function
 * 
 * These tests validate the Lambda handler logic, input validation,
 * error handling, and AWS SDK interactions using mocks.
 */

import { handler, AudioProcessorInput, AudioProcessorOutput } from '../../lib/lambda/audio-processor';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Readable } from 'stream';

// Create mock clients
const dynamoDBMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);
const pollyMock = mockClient(PollyClient);

// Mock environment variables
process.env.TABLE_NAME = 'test-table';
process.env.INPUT_BUCKET_NAME = 'test-input-bucket';
process.env.OUTPUT_BUCKET_NAME = 'test-output-bucket';

describe('Audio Processor Lambda Handler', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoDBMock.reset();
    s3Mock.reset();
    pollyMock.reset();
    
    // Clear console.log spy
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Input Validation', () => {
    test('Should throw error when executionId is missing', async () => {
      const event: any = {
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      await expect(handler(event)).rejects.toThrow('Input Validation Failed: Missing required fields: executionId');
    });

    test('Should throw error when bucket is missing', async () => {
      const event: any = {
        executionId: 'test-exec-id',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      await expect(handler(event)).rejects.toThrow('Input Validation Failed: Missing required fields: bucket');
    });

    test('Should throw error when key is missing', async () => {
      const event: any = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      await expect(handler(event)).rejects.toThrow('Input Validation Failed: Missing required fields: key');
    });

    test('Should throw error when multiple fields are missing', async () => {
      const event: any = {
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      await expect(handler(event)).rejects.toThrow('Missing required fields: executionId, bucket, key');
    });

    test('Should throw error for unsupported file extension', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.pdf',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      await expect(handler(event)).rejects.toThrow('Unsupported file format');
    });

    test('Should accept .mp3 files', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      // Setup mocks to allow test to complete
      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);
      expect(result.success).toBe(true);
    });

    test('Should accept .wav files', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.wav',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);
      expect(result.success).toBe(true);
    });

    test('Should accept .txt files for text-to-speech', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.txt',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('Hello, world!')])
      });
      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: Readable.from([Buffer.from('synthesized audio')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);
      expect(result.success).toBe(true);
    });

    test('Should throw error when file size exceeds 100MB limit', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'large-file.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: String(150 * 1024 * 1024), // 150 MB
        etag: 'test-etag'
      };

      await expect(handler(event)).rejects.toThrow('File Size Limit Exceeded');
    });

    test('Should accept files under 100MB limit', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'valid-file.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: String(50 * 1024 * 1024), // 50 MB
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);
      expect(result.success).toBe(true);
    });

    test('Should handle case-insensitive file extensions', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'TEST.MP3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);
      expect(result.success).toBe(true);
    });
  });

  describe('Audio Processing Path', () => {
    test('Should successfully process audio file', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'audio/test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      const audioData = Buffer.from('test audio data');
      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([audioData])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Audio metadata processed successfully');
      expect(result.outputBucket).toBe('test-output-bucket');
      expect(result.outputKey).toMatch(/audio\/test_processed_\d+\.mp3/);
      expect(result.fileSize).toBe(audioData.length);
      expect(result.metadata.audioId).toBe('test-exec-id');
      expect(result.metadata.status).toBe('COMPLETED');
    });

    test('Should download from correct input bucket', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      const getObjectCalls = s3Mock.commandCalls(GetObjectCommand);
      expect(getObjectCalls.length).toBe(1);
      expect(getObjectCalls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test.mp3'
      });
    });

    test('Should upload to output bucket with encryption', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      const putObjectCalls = s3Mock.commandCalls(PutObjectCommand);
      expect(putObjectCalls.length).toBe(1);
      expect(putObjectCalls[0].args[0].input).toMatchObject({
        Bucket: 'test-output-bucket',
        ContentType: 'audio/mpeg',
        ServerSideEncryption: 'AES256'
      });
      expect(putObjectCalls[0].args[0].input.Key).toMatch(/test_processed_\d+\.mp3/);
    });

    test('Should update DynamoDB with output metadata', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      const updateCalls = dynamoDBMock.commandCalls(UpdateItemCommand);
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0].args[0].input).toMatchObject({
        TableName: 'test-table',
        Key: {
          audioId: { S: 'test-exec-id' },
          createdAt: { S: '2024-01-01T00:00:00Z' }
        }
      });
      expect(updateCalls[0].args[0].input.ExpressionAttributeValues).toMatchObject({
        ':st': { S: 'COMPLETED' },
        ':ob': { S: 'test-output-bucket' }
      });
    });

    test('Should handle .wav files with correct mime type', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.wav',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      const putObjectCalls = s3Mock.commandCalls(PutObjectCommand);
      expect(putObjectCalls[0].args[0].input.ContentType).toBe('audio/wav');
    });
  });

  describe('Text-to-Speech Processing Path', () => {
    test('Should successfully process text file with Polly', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'scripts/bedtime-story.txt',
        timestamp: '2024-01-01T00:00:00Z',
        size: '500',
        etag: 'test-etag'
      };

      const synthesizedAudio = Buffer.from('synthesized audio data');
      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('Once upon a time...')])
      });
      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: Readable.from([synthesizedAudio])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.outputKey).toMatch(/scripts\/bedtime-story_\d+\.mp3/);
      expect(result.fileSize).toBe(synthesizedAudio.length);
    });

    test('Should call Polly with correct parameters', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.txt',
        timestamp: '2024-01-01T00:00:00Z',
        size: '500',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('Hello, world!')])
      });
      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: Readable.from([Buffer.from('synthesized audio')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      const pollyCalls = pollyMock.commandCalls(SynthesizeSpeechCommand);
      expect(pollyCalls.length).toBe(1);
      expect(pollyCalls[0].args[0].input).toMatchObject({
        Text: 'Hello, world!',
        OutputFormat: 'mp3',
        VoiceId: 'Joanna',
        Engine: 'neural'
      });
    });

    test('Should use custom voiceId when provided', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.txt',
        timestamp: '2024-01-01T00:00:00Z',
        size: '500',
        etag: 'test-etag',
        voiceId: 'Matthew'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('Hello, world!')])
      });
      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: Readable.from([Buffer.from('synthesized audio')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      const pollyCalls = pollyMock.commandCalls(SynthesizeSpeechCommand);
      expect(pollyCalls[0].args[0].input.VoiceId).toBe('Matthew');
    });

    test('Should convert .txt extension to .mp3 for output', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'story.txt',
        timestamp: '2024-01-01T00:00:00Z',
        size: '500',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('Test text')])
      });
      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: Readable.from([Buffer.from('synthesized audio')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      const putObjectCalls = s3Mock.commandCalls(PutObjectCommand);
      expect(putObjectCalls[0].args[0].input.Key).toMatch(/story_\d+\.mp3/);
      expect(putObjectCalls[0].args[0].input.ContentType).toBe('audio/mpeg');
    });
  });

  describe('Error Handling', () => {
    test('Should throw error when S3 GetObject fails', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).rejects(new Error('S3 Access Denied'));

      await expect(handler(event)).rejects.toThrow('S3 Access Denied');
    });

    test('Should throw error when Polly SynthesizeSpeech fails', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.txt',
        timestamp: '2024-01-01T00:00:00Z',
        size: '500',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('Hello, world!')])
      });
      pollyMock.on(SynthesizeSpeechCommand).rejects(new Error('Polly Service Error'));

      await expect(handler(event)).rejects.toThrow('Polly Service Error');
    });

    test('Should throw error when S3 PutObject fails', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 Upload Failed'));

      await expect(handler(event)).rejects.toThrow('S3 Upload Failed');
    });

    test('Should throw error when DynamoDB UpdateItem fails', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).rejects(new Error('DynamoDB Update Failed'));

      await expect(handler(event)).rejects.toThrow('DynamoDB Update Failed');
    });

    test('Should throw error when OUTPUT_BUCKET is not configured', async () => {
      const originalValue = process.env.OUTPUT_BUCKET_NAME;
      delete process.env.OUTPUT_BUCKET_NAME;

      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });

      await expect(handler(event)).rejects.toThrow('OUTPUT_BUCKET_NAME not configured');

      // Restore environment variable
      process.env.OUTPUT_BUCKET_NAME = originalValue;
    });
  });

  describe('Structured Logging', () => {
    test('Should log processing start with structured format', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      // Check that structured logs were written
      expect(consoleLogSpy).toHaveBeenCalled();
      
      // Find the start log entry
      const startLogCall = consoleLogSpy.mock.calls.find(call => {
        try {
          const log = JSON.parse(call[0]);
          return log.message === 'Audio Processor Lambda invoked';
        } catch {
          return false;
        }
      });

      expect(startLogCall).toBeDefined();
      const startLog = JSON.parse(startLogCall![0]);
      expect(startLog.level).toBe('INFO');
      expect(startLog.executionId).toBe('test-exec-id');
      expect(startLog.status).toBe('STARTED');
    });

    test('Should log validation errors with structured format', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      
      const event: any = {
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z'
      };

      try {
        await handler(event);
      } catch {
        // Expected to throw
      }

      // Find the error log entry
      const errorLogCall = consoleLogSpy.mock.calls.find(call => {
        try {
          const log = JSON.parse(call[0]);
          return log.level === 'ERROR' && log.status === 'VALIDATION_FAILED';
        } catch {
          return false;
        }
      });

      expect(errorLogCall).toBeDefined();
      const errorLog = JSON.parse(errorLogCall![0]);
      expect(errorLog.message).toBe('Input validation failed');
      expect(errorLog.missingFields).toContain('executionId');
    });

    test('Should log completion with structured format', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      // Find the completion log entry
      const completionLogCall = consoleLogSpy.mock.calls.find(call => {
        try {
          const log = JSON.parse(call[0]);
          return log.message === 'Audio processing completed successfully';
        } catch {
          return false;
        }
      });

      expect(completionLogCall).toBeDefined();
      const completionLog = JSON.parse(completionLogCall![0]);
      expect(completionLog.level).toBe('INFO');
      expect(completionLog.status).toBe('COMPLETED');
      expect(completionLog.output).toBeDefined();
    });
  });

  describe('Output Structure', () => {
    test('Should return complete AudioProcessorOutput structure', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      // Validate output structure
      expect(result).toMatchObject({
        success: true,
        message: expect.any(String),
        outputBucket: expect.any(String),
        outputKey: expect.any(String),
        fileSize: expect.any(Number),
        metadata: {
          audioId: expect.any(String),
          processingTimestamp: expect.any(String),
          bucket: expect.any(String),
          key: expect.any(String),
          status: 'COMPLETED'
        }
      });
    });

    test('Should include all required metadata fields', async () => {
      const event: AudioProcessorInput = {
        executionId: 'test-exec-id',
        bucket: 'test-bucket',
        key: 'test.mp3',
        timestamp: '2024-01-01T00:00:00Z',
        size: '1000',
        etag: 'test-etag'
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: Readable.from([Buffer.from('test audio data')])
      });
      s3Mock.on(PutObjectCommand).resolves({});
      dynamoDBMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.metadata.audioId).toBe('test-exec-id');
      expect(result.metadata.bucket).toBe('test-bucket');
      expect(result.metadata.key).toBe('test.mp3');
      expect(result.metadata.status).toBe('COMPLETED');
      expect(result.metadata.processingTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
