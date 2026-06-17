# Event-Driven Sleep Audio Pipeline Architecture

## Overview

This document describes the architecture of a **production-grade, event-driven sleep audio processing pipeline** built with AWS CDK and TypeScript. The system enables users to upload raw audio files (voice recordings, ambient sounds, text for speech synthesis) which are then automatically processed through an intelligent, serverless pipeline to create optimized sleep audio content.

The pipeline leverages AWS managed services to provide a scalable, secure, and cost-effective solution for audio processing, AI-powered audio generation, and metadata management. All infrastructure follows AWS Well-Architected Framework principles and is developed using strict Test-Driven Development (TDD) practices.

## Architecture Philosophy

- **Event-Driven Architecture**: All processing is initiated and coordinated through events, enabling loose coupling and scalability
- **Serverless-First**: Leverages fully managed AWS services (Lambda, Step Functions, S3, DynamoDB) with no infrastructure to manage
- **AI-Powered Processing**: Integrates Amazon Polly for text-to-speech and Amazon Bedrock for AI-generated sleep sounds
- **Workflow Orchestration**: Uses AWS Step Functions for complex, multi-step audio processing workflows with built-in error handling and retry logic
- **Scalable by Design**: Automatically scales from zero to thousands of concurrent requests without manual intervention
- **Security-First**: Implements least-privilege IAM roles, encryption at rest and in transit, and private bucket access
- **Observable & Monitorable**: Comprehensive CloudWatch logging, metrics, alarms, and X-Ray tracing for visibility
- **Multi-Environment Ready**: Supports dev/stage/prod environments through CDK context configuration
- **Test-Driven Development**: All infrastructure components are defined and validated through tests before implementation

## High-Level System Overview

The Sleep Audio Pipeline processes audio files through the following stages:

1. **Ingestion**: Users upload raw audio files or text scripts to an input S3 bucket
2. **Event Detection**: S3 upload events are captured and routed through Amazon EventBridge
3. **Workflow Orchestration**: EventBridge triggers AWS Step Functions state machine to orchestrate processing
4. **Audio Processing**: Step Functions coordinates multiple processing steps:
   - Audio validation (format, duration, quality)
   - Text-to-speech conversion using Amazon Polly (for text inputs)
   - AI-powered audio enhancement or generation using Amazon Bedrock (optional)
   - Metadata extraction (duration, bitrate, channels, content analysis)
5. **Storage**: Processed audio saved to output S3 bucket with versioning; metadata stored in DynamoDB
6. **Notification**: SNS notifications sent on workflow completion or errors
7. **Observability**: All steps logged to CloudWatch with alarms for critical failures

## Architecture Diagram

### Complete Integrated Pipeline (Issue #8 - Current Implementation)
### Complete Integrated Pipeline with Advanced Error Handling & Observability (Issue #10 - Current Implementation)
```mermaid
flowchart LR
    %% User Layer
    %% Observability Components
    XRay[X-Ray Tracing<br/>✓ Lambda & State Machine]
    
    User[User/Application<br/>Uploads Files]
    
    %% Ingestion Layer
    InputBucket[S3 Input Bucket<br/>✓ EventBridge Enabled<br/>✓ Encrypted & Versioned]
    
    %% Event Routing
    EventRule[EventBridge Rule<br/>AudioUploadedRule<br/>✓ S3 Object Created Filter]
    
    %% Orchestration - State Machine
    subgraph StateMachine["Step Functions State Machine<br/>SleepAudioPipelineStateMachine"]
        direction TB
        SM1[WriteInitialMetadata<br/>DynamoDB PutItem<br/>Status: PROCESSING]
        SM1[WriteInitialMetadata<br/>DynamoDB PutItem<br/>Status: PROCESSING<br/>🔄 Retry: 2 attempts]
        SM2[ProcessAudioMetadata<br/>Lambda Invoke<br/>✓ Input Validation<br/>✓ File Extension Check<br/>🔄 Retry: 3 attempts<br/>⚡ Exponential Backoff]
        SM3[SynthesizeSpeech<br/>Polly Task<br/>✓ Neural Voice<br/>🔄 Retry: 2 attempts<br/>⚡ Exponential Backoff]
        SM4[UpdateMetadataCompleted<br/>DynamoDB UpdateItem<br/>Status: COMPLETED<br/>🔄 Retry: 2 attempts]
        
        %% Error Handling Path
        SME1[UpdateMetadataFailed<br/>DynamoDB UpdateItem<br/>Status: FAILED]
        SME1[UpdateMetadataFailed<br/>DynamoDB UpdateItem<br/>Status: FAILED<br/>💾 Store Error Context]
        SME2[PublishFailureNotification<br/>SNS Publish<br/>📧 Detailed Error Info]
        
        SM1 --> SM2
        SM2 --> SM3
        SM1 -.->|🔥 Catch: All Errors| SME1
        SM3 --> SM4
        SM2 -.->|🔥 Catch: Lambda/Service Errors| SME1
        SM4 --> SM5
        SM3 -.->|🔥 Catch: Polly/Task Errors| SME1
        
        SM2 -.->|Error Catch| SME1
        SME2 --> SME3
    end
    
    %% Lambda Function
    Lambda[Lambda Function<br/>SleepAudioProcessorFunction<br/>✓ Validates Required Fields<br/>✓ Checks File Extensions<br/>✓ Validates File Size]
    Lambda[Lambda Function<br/>SleepAudioProcessorFunction<br/>✓ Validates Required Fields<br/>✓ Checks File Extensions<br/>✓ Validates File Size<br/>📊 Structured JSON Logging<br/>🔍 X-Ray Tracing Active]
    
    %% Observability Layer
    CloudWatchAlarms[CloudWatch Alarms<br/>🚨 State Machine Failures<br/>🚨 Lambda Errors<br/>🚨 Lambda High Duration p99]
    %% Storage Layer
    MetadataTable[DynamoDB Table<br/>SleepAudioMetadataTable<br/>✓ Tracks Processing Status<br/>✓ Point-in-Time Recovery]
    OutputBucket[S3 Output Bucket<br/>✓ Encrypted & Versioned]
    
    %% Notification Layer
    CompletedTopic[SNS Topic<br/>SleepAudioPipelineCompleted<br/>✓ Success Notifications]
    FailedTopic[SNS Topic<br/>SleepAudioPipelineFailed<br/>✓ Failure Notifications]
    
    CloudWatchAlarms -.->|Alert| FailedTopic
    %% Main Flow
    User -->|1. Upload Audio/Text| InputBucket
    InputBucket -->|2. S3 Event| EventRule
    EventRule -->|3. Start Execution| StateMachine
    
    XRay -.->|Traces| StateMachine
    XRay -.->|Traces| Lambda
    %% State Machine Interactions
    SM1 -.->|Write| MetadataTable
    SM2 -->|Invoke| Lambda
    Lambda -.->|Read/Write| MetadataTable
    SM3 -.->|Output Audio| OutputBucket
    SM4 -.->|Update| MetadataTable
    SM5 -->|Publish| CompletedTopic
    SME1 -.->|Update| MetadataTable
    SME2 -->|Publish| FailedTopic
    
    CloudWatchAlarms -.->|Monitor| StateMachine
    CloudWatchAlarms -.->|Monitor| Lambda
    %% Styling
    style InputBucket fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000
    style EventRule fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000
    style StateMachine fill:#E8F5E9,stroke:#228B22,stroke-width:3px,color:#000
    style Lambda fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000
    style MetadataTable fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000
    style OutputBucket fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000
    style CompletedTopic fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000
    style FailedTopic fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000
    style SM1 fill:#FFF9C4,stroke:#F57C00,stroke-width:2px,color:#000
    style SM2 fill:#FFF9C4,stroke:#F57C00,stroke-width:2px,color:#000
    style SM3 fill:#FFF9C4,stroke:#F57C00,stroke-width:2px,color:#000
    style SM4 fill:#FFF9C4,stroke:#F57C00,stroke-width:2px,color:#000
    style SM5 fill:#FFF9C4,stroke:#F57C00,stroke-width:2px,color:#000
    style SME1 fill:#FFCDD2,stroke:#C62828,stroke-width:2px,color:#000
    style SME2 fill:#FFCDD2,stroke:#C62828,stroke-width:2px,color:#000
    style SME3 fill:#FFCDD2,stroke:#C62828,stroke-width:2px,color:#000

    style XRay fill:#ADD8E6,stroke:#4682B4,stroke-width:2px,color:#000
    style CloudWatchAlarms fill:#FFE4B5,stroke:#FF8C00,stroke-width:2px,color:#000
**Legend:**
- ✓ Green boxes with solid borders: Fully Implemented and Wired (Issues #3-#8)
- ✓ Green boxes with solid borders: Fully Implemented and Wired (Issues #3-#10)
- Red boxes: State Machine Error Handling Path
- Solid arrows: Active data flow
- Blue boxes: Observability Components (X-Ray Tracing)
- Orange boxes: Monitoring & Alerting
- Dashed arrows: Planned data flow

- 🔄 Retry indicators: Configured retry policies
- 🔥 Catch indicators: Error handling paths
- ⚡ Exponential backoff enabled
### Test-Driven Development Workflow Diagram

This diagram illustrates the strict TDD process followed throughout the project:

```mermaid
flowchart TD
    A[Start: GitHub Issue Created] --> B[Read ARCHITECTURE.md]
    B --> C[Write Failing Tests]
    C --> D{Tests Fail<br/>Correctly?}
    D -->|No| C
    D -->|Yes| E[Write Minimal<br/>Infrastructure Code]
    E --> F{Tests Pass?}
    F -->|No| E
    F -->|Yes| G[Refactor Code]
    G --> H[Run Tests Again]
    H --> I{Still Pass?}
    I -->|No| G
    I -->|Yes| J[Update ARCHITECTURE.md]
    J --> K[Update Mermaid Diagrams]
    K --> L[Update README if needed]
    L --> M[Commit Changes]
    M --> N[Open Pull Request]
    N --> O[CI Runs Tests]
    O --> P{All Checks Pass?}
    P -->|No| E
    P -->|Yes| Q[Merge to Main]
    Q --> R[End: Feature Complete]
    
    style C fill:#ffeb3b,stroke:#f57c00,stroke-width:2px
    style E fill:#90EE90,stroke:#228B22,stroke-width:2px
    style J fill:#ADD8E6,stroke:#4682B4,stroke-width:2px
```
### End-to-End Data Flow (Issue #8)

#### Success Path:
1. **User uploads file** to Input S3 Bucket (e.g., `audio.mp3` or `text.txt`)
2. **S3 generates event** → EventBridge captures it
3. **EventBridge Rule triggers** Step Functions state machine execution with S3 details
4. **WriteInitialMetadata** → DynamoDB record created (status: `PROCESSING`)
5. **ProcessAudioMetadata** → Lambda validates:
   - Required fields (executionId, bucket, key)
   - File extension (`.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.txt`)
   - File size (< 100 MB)
6. **SynthesizeSpeech** → Polly converts text to audio (neural voice)
7. **UpdateMetadataCompleted** → DynamoDB updated (status: `COMPLETED`)
8. **PublishSuccessNotification** → SNS notification sent to success topic

#### Error Path:
If Lambda validation fails or Polly errors occur:
1. **Error caught** by Catch block
2. **UpdateMetadataFailed** → DynamoDB updated (status: `FAILED`, error message stored)
3. **PublishFailureNotification** → SNS notification sent to failure topic
4. **JobFailed** → Execution terminates with failure status

### Input Validation (Issue #8)
### Enhanced Error Handling & Retry Strategy (Issue #10)

#### Retry Policies:
1. **Lambda Invocation** (`ProcessAudioMetadata`):
   - Retry on: `States.TaskFailed`, `Lambda.ServiceException`, `Lambda.TooManyRequestsException`, `Lambda.SdkClientException`
   - Max Attempts: 3
   - Interval: 2 seconds
   - Backoff Rate: 2.0 (exponential)
   
2. **Polly Task** (`SynthesizeSpeech`):
   - Retry on: `States.TaskFailed`, `Polly.TextLengthExceededException`, `Polly.InvalidSsmlException`, `Polly.ServiceFailureException`, `States.Timeout`
   - Max Attempts: 2
   - Interval: 1 second
   - Backoff Rate: 2.0 (exponential)
   
3. **DynamoDB Operations** (`WriteInitialMetadata`, `UpdateMetadataCompleted`):
   - Retry on: `States.TaskFailed`, `DynamoDB.ProvisionedThroughputExceededException`, `DynamoDB.RequestLimitExceeded`, `DynamoDB.InternalServerError`, `DynamoDB.ServiceUnavailable`
   - Max Attempts: 2
   - Interval: 1 second
   - Backoff Rate: 1.5

#### Error Handling Flow:
1. **Retry First**: Each task attempts retries with exponential backoff before catching errors
2. **Catch Errors**: After retries exhausted, errors are caught with `States.ALL`
3. **Update DynamoDB**: Failed status written to metadata table with error details
4. **Notify**: SNS notification sent to failure topic with complete error context
5. **Fail**: Execution terminates with detailed failure information

### Observability Enhancements (Issue #10)

#### X-Ray Tracing:
- **Lambda Function**: Active tracing enabled in prod/stage environments
- **State Machine**: Tracing enabled conditionally based on environment
- **Service Map**: Visualizes end-to-end request flow
- **Performance Analysis**: Identifies bottlenecks and latency issues

#### Structured Logging:
- **Format**: JSON logs for CloudWatch Insights compatibility
- **Fields**: timestamp, level, message, requestId, executionId, status
- **Searchable**: Enables complex queries and filtering
- **Correlation**: Links logs across services via executionId

#### CloudWatch Alarms:
1. **State Machine Execution Failures**:
   - Metric: `ExecutionsFailed`
   - Threshold: > 5 failures in 5 minutes
   - Action: Publish to SNS failure topic
   
2. **Lambda Function Errors**:
   - Metric: `Errors`
   - Threshold: > 5 errors in 5 minutes
   - Action: Publish to SNS failure topic
   
3. **Lambda High Duration (p99)**:
   - Metric: `Duration`
   - Statistic: p99
   - Threshold: > 50 seconds (50,000 ms)
   - Action: Publish to SNS failure topic


**Lambda Validation Logic:**
- **Required Fields:** Validates presence of `executionId`, `bucket`, and `key`
- **File Extension:** Checks against whitelist: `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.txt`
- **File Size:** Validates file size is under 100 MB limit
- **Error Handling:** Throws descriptive errors that are caught by state machine

## Full System Architecture (Future Vision)

```mermaid
flowchart TD
    subgraph Users
        A[User/Application]
    end
    
    subgraph Ingestion ["Ingestion Layer"]
        B[Input S3 Bucket<br/>Raw Audio Files]
    end
    
    subgraph EventRouting ["Event Routing Layer"]
        C[Amazon EventBridge<br/>Custom Event Bus]
        C1[Event Rule<br/>Audio Upload Filter]
    end
    
    subgraph Processing ["Processing & Orchestration Layer"]
        D[AWS Step Functions<br/>Workflow State Machine]
        D1[Validation Lambda<br/>Format & Quality Check]
        D2[Amazon Polly<br/>Text-to-Speech]
        D4[Audio Processor Lambda<br/>Metadata & Validation]
        D4[Metadata Lambda<br/>Extract Audio Properties]
    end
    
    subgraph Storage ["Storage Layer"]
        E[Output S3 Bucket<br/>Processed Audio<br/>Versioning Enabled]
        F[DynamoDB Table<br/>Metadata & Status]
    end
    
    subgraph Notification ["Notification Layer"]
        G[SNS Topic<br/>Processing Notifications]
        H1[Email Subscription]
        H2[SQS Queue]
        H3[Lambda Subscription]
    end
    
    subgraph Observability ["Observability Layer"]
        I[CloudWatch Logs]
        J[CloudWatch Alarms]
        K[X-Ray Tracing]
    end
    
    A -->|1. Upload Audio/Text| B
    B -->|2. S3 Event| C
    C -->|3. Match Rule| C1
    C1 -->|4. Trigger| D
    D -->|5a. Validate| D1
    D -->|5b. Synthesize Speech| D2
    D -->|5c. AI Enhancement| D3
    D -->|5d. Extract Metadata| D4
    D1 --> E
    D2 --> E
    D3 --> E
    D4 --> F
    D -->|6. Store Processed| E
    D -->|7. Write Metadata| F
    D -->|8. Publish Status| G
    G -->|Notify| H1
    G -->|Queue| H2
    G -->|Trigger| H3
    D --> I
    D --> K
    J -.Monitor.- D
    J -.Alert on Errors.- G
    
    style B fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#000
    style C fill:#FF4F8B,stroke:#232F3E,stroke-width:2px,color:#000
    style C1 fill:#FF4F8B,stroke:#232F3E,stroke-width:2px,color:#000
    style D fill:#CD2264,stroke:#232F3E,stroke-width:2px,color:#fff
    style D1 fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#000
    style D2 fill:#3F8624,stroke:#232F3E,stroke-width:2px,color:#fff
    style D3 fill:#01A88D,stroke:#232F3E,stroke-width:2px,color:#000
    style D4 fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#000
    style E fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#000
    style F fill:#4053D6,stroke:#232F3E,stroke-width:2px,color:#fff
    style G fill:#FF4F8B,stroke:#232F3E,stroke-width:2px,color:#000
    style I fill:#FF4F8B,stroke:#232F3E,stroke-width:2px,color:#000
    style J fill:#FF4F8B,stroke:#232F3E,stroke-width:2px,color:#000
    style K fill:#FF4F8B,stroke:#232F3E,stroke-width:2px,color:#000
```

## Implementation Status

### ✅ Completed (Issue #11)

#### Core Audio Processing Logic and Output Handling
**Status**: ✅ Implemented

The Lambda function now implements full end-to-end audio processing from input to output:

**Lambda Configuration Updates:**
- **Timeout**: Increased from 60s to 300s (5 minutes) for audio processing
- **Memory**: Increased from 512 MB to 1024 MB for audio operations
- **Environment Variables**: 
  - `TABLE_NAME`: DynamoDB table name
  - `INPUT_BUCKET_NAME`: Input S3 bucket name (new)
  - `OUTPUT_BUCKET_NAME`: Output S3 bucket name (new)
- **IAM Permissions**: Enhanced least-privilege access to:
  - S3 GetObject on input bucket
  - S3 PutObject on output bucket
  - Polly SynthesizeSpeech
  - DynamoDB PutItem/UpdateItem/GetItem
  - CloudWatch Logs

**Core Audio Processing Flow:**

The Lambda function now performs the complete audio processing pipeline:

1. **Input Validation** (unchanged):
   - Validates required fields (executionId, bucket, key)
   - Validates file extension against whitelist
   - Validates file size (< 100 MB)

2. **Download from S3**:
   - Downloads input file from S3 input bucket
   - Uses streaming approach to handle large files efficiently
   - Supports both text (.txt) and audio files (.mp3, .wav, .m4a, .flac, .ogg)

3. **Processing Logic**:
   - **For Text Files**: 
     - Reads text content from file
     - Invokes Amazon Polly with neural voice (Joanna by default)
     - Generates MP3 audio from text
     - Output format: `{original}_TIMESTAMP.mp3`
   - **For Audio Files**:
     - Downloads audio file
     - Performs basic processing (currently pass-through, extensible for normalization/enhancement)
     - Output format: `{original}_processed_TIMESTAMP.{ext}`

4. **Upload to Output S3**:
   - Uploads processed audio to output S3 bucket
   - Sets appropriate Content-Type based on file format
   - Applies S3-managed encryption (AES256)
   - Generates timestamped output filename for uniqueness

5. **Update DynamoDB**:
   - Updates metadata record with output information:
     - `status`: 'COMPLETED'
     - `outputBucket`: Output S3 bucket name
     - `outputKey`: Processed file key in S3
     - `fileSize`: Size of processed audio in bytes
     - `updatedAt`: Timestamp of completion

6. **Return Metadata**:
   - Returns structured response with:
     - Success indicator
     - Output S3 location (bucket + key)
     - File size
     - Processing metadata

**State Machine Simplification:**

The Step Functions workflow has been simplified now that Lambda handles the full processing:

```
Start → WriteInitialMetadata (DynamoDB) 
     → ProcessAudioMetadata (Lambda - FULL PROCESSING)
         ↳ Download from S3
         ↳ Process/Generate Audio (includes Polly for text)
         ↳ Upload to S3
         ↳ Update DynamoDB with output
     → UpdateMetadataCompleted (DynamoDB)
     → PublishSuccessNotification (SNS)
     → End
```

**Key Changes:**
- Removed standalone `SynthesizeSpeech` (Polly) task from state machine
- Polly is now called directly from Lambda for text files
- Lambda handles complete processing lifecycle in a single invocation
- Simplified state machine reduces complexity and state transitions
- All S3 operations (input/output) now handled by Lambda

**Error Handling:**
- Lambda errors (S3, Polly, DynamoDB) caught by state machine catch blocks
- Error details logged to CloudWatch with full context
- DynamoDB updated with error status
- SNS failure notification sent
- Maintains existing retry policies on Lambda invocation (3 attempts with exponential backoff)

**Output Artifacts:**

Processed audio files are stored in the output S3 bucket with the following characteristics:
- **Naming Convention**: `{original-name}_[processed_]{timestamp}.{ext}`
- **Location**: Output S3 bucket (encrypted, versioned)
- **Metadata in DynamoDB**:
  - Input location (bucket + key)
  - Output location (bucket + key)
  - File sizes (input and output)
  - Processing status (PROCESSING → COMPLETED/FAILED)
  - Timestamps (created, updated)
  - Error message (if failed)

**Audio Processing Capabilities:**

Currently implemented:
- Text-to-speech using Amazon Polly (neural voices)
- Audio file pass-through with metadata tracking
- Multiple audio format support (.mp3, .wav, .m4a, .flac, .ogg)
- Automatic content-type detection and S3 metadata

Future enhancements (extensible architecture):
- Audio normalization and volume adjustment
- Format conversion (e.g., WAV → MP3)
- Audio mixing with background sounds
- Quality enhancement and noise reduction
- Metadata extraction (duration, bitrate, sample rate using ffprobe)
- Content analysis (silence detection, volume analysis)

**Testing:**
- Comprehensive tests added for Lambda environment configuration
- Tests verify S3 permissions (read input, write output)
- Tests verify Polly permissions
- Tests verify increased timeout and memory
- Integration tests verify complete processing flow
- Tests validate output metadata structure

**Production Readiness:**
- All processing logged with structured JSON format
- Correlation IDs enable tracing across services
- Error context preserved for debugging
- Output files tracked in DynamoDB for audit trail
- Scalable architecture handles concurrent processing

### ✅ Completed (Issue #7)
### ✅ Completed (Issue #10)

#### Advanced Error Handling, Retry Policies & Observability Enhancements
**Status**: ✅ Implemented

**Retry Policies**:
- Lambda invocation: 3 retry attempts with exponential backoff (2.0)
- Polly synthesis: 2 retry attempts with exponential backoff (2.0)
- DynamoDB operations: 2 retry attempts with moderate backoff (1.5)
- All retries include specific error type matching for targeted recovery

**Advanced Error Handling**:
- Specific catch blocks for Lambda service errors
- Polly-specific error handling (text length, SSML, service failures)
- DynamoDB throttling and service error handling
- Error context preserved and logged in DynamoDB
- Detailed error notifications via SNS

**X-Ray Tracing**:
- Lambda function tracing enabled conditionally (prod/stage)
- State Machine tracing enabled via environment configuration
- End-to-end request tracking across all services
- Performance insights and bottleneck identification

**Structured Logging**:
- JSON-formatted logs in Lambda for CloudWatch Insights
- Consistent fields: timestamp, level, message, requestId, executionId, status
- Detailed error context with stack traces
- Correlation IDs for multi-service tracing

**CloudWatch Alarms**:
- State Machine execution failures (> 5 in 5 min)
- Lambda function errors (> 5 in 5 min)
- Lambda high duration p99 (> 50 seconds)
- All alarms publish to SNS failure topic for notifications

**Production Readiness**:
- Transient failures handled automatically via retries
- Permanent failures caught and reported with full context
- Observability enabled for debugging and monitoring
- Alarms provide proactive failure detection


#### Lambda Function (`SleepAudioProcessorFunction`)
**Status**: ✅ Implemented

The Lambda function serves as a placeholder for future audio processing, metadata enrichment, and validation logic:
- **Runtime**: Node.js 20.x (matching TypeScript project)
- **Handler**: audio-processor.handler
- **Memory**: 512 MB
- **Timeout**: 60 seconds
- **Environment Variables**: 
  - `TABLE_NAME`: DynamoDB table name for metadata access
- **IAM Permissions**: Least-privilege access to:
  - DynamoDB (GetItem, UpdateItem on metadata table)
  - CloudWatch Logs (CreateLogGroup, CreateLogStream, PutLogEvents)

**Current Functionality**:
- Receives S3 event details and execution metadata from Step Functions
- Validates required input fields (executionId, bucket, key)
- Logs processing details for debugging
- Returns enriched metadata response with processing status

**Future Enhancements**:
- Audio format validation (codec, bitrate, sample rate)
- Quality checks and content analysis
- Metadata extraction using audio analysis libraries

### ✅ Completed (Issue #4)
### ✅ Completed (Issue #8)

#### Complete Pipeline Integration & Input Validation
**Status**: ✅ Implemented

The complete basic pipeline is now fully wired and operational:

**Pipeline Components Integrated:**
1. **S3 Input Bucket** → **EventBridge Rule** → **Step Functions State Machine**
2. **State Machine Orchestration:**
   - WriteInitialMetadata (DynamoDB PutItem)
   - ProcessAudioMetadata (Lambda with validation)
   - SynthesizeSpeech (Polly integration)
   - UpdateMetadataCompleted (DynamoDB UpdateItem)
   - PublishSuccessNotification (SNS)
3. **Error Handling Chain:**
   - UpdateMetadataFailed (DynamoDB UpdateItem)
   - PublishFailureNotification (SNS)
   - JobFailed (Fail state)

**Input Validation:**
- Lambda function validates all required input fields
- File extension whitelist enforcement (audio and text files)
- File size validation (100 MB limit)
- Descriptive error messages for validation failures

**End-to-End Flow:**
- Success path: S3 → EventBridge → State Machine → DynamoDB → Polly → SNS (success)
- Failure path: Catch errors → DynamoDB (FAILED) → SNS (failure) → Fail state
- All IAM permissions configured with least-privilege principle
- CloudWatch logging enabled for full observability

#### Step Functions State Machine (`SleepAudioPipelineStateMachine`)
**Status**: ✅ Implemented

The Step Functions state machine orchestrates the sleep audio processing workflow:
- **State Machine Type**: STANDARD (for long-running workflows with audit history)
The Lambda function now includes:
- **Log Group**: `/aws/vendedlogs/states/{StackName}-SleepAudioPipeline`
- **Log Retention**: 30 days
- **IAM Permissions**: Least-privilege access to:
  - Amazon Polly (synthesizeSpeech)
  - S3 input bucket (read)
  - S3 output bucket (write)
  - CloudWatch Logs (write)

**Current Workflow**:
```
Start → WriteInitialMetadata (DynamoDB) 
     → ProcessAudioMetadata (Lambda) 
     → SynthesizeSpeech (Polly) 
- Validates file extensions against supported formats
- Validates file size (< 100 MB)
     → UpdateMetadataCompleted (DynamoDB)
     → PublishSuccessNotification (SNS)
- Throws descriptive errors for invalid inputs
     → End
```

The state machine currently implements a minimal skeleton with a single Polly task. Future iterations will expand this to include:
- Choice states for routing different file types
- Parallel processing branches
- Error handling and retry logic
- DynamoDB metadata storage
- SNS notifications

#### Amazon Polly Integration
**Status**: ✅ Implemented (Minimal)

Polly is integrated as a Task state using the `CallAwsService` integration:
- **Service**: polly
- **Action**: synthesizeSpeech
- **Parameters**: Configured via state machine input
  - Text: Dynamic from input (`$.text`)
  - OutputFormat: mp3
  - VoiceId: Dynamic from input (`$.voiceId`)
  - Engine: neural (for high-quality voices)
- **Result Path**: `$.pollyResult` (stores Polly response in state)
  - Lambda (invokeFunction)
  - DynamoDB (putItem, updateItem)
  - SNS (publish to both topics)

### ✅ Completed (Issue #3 & #4)
### ✅ Completed (Issue #3)

**Complete Workflow (Issue #8)**:
**Status**: ✅ Implemented

The input bucket is now fully configured and operational:
- **Encryption**: Server-side encryption using S3-managed keys (AES-256)
- **Versioning**: Enabled to track all file uploads
- **EventBridge Integration**: All S3 `Object Created` events are sent to EventBridge
- **Public Access**: Completely blocked via `BlockPublicAccess.BLOCK_ALL`

Error Path:
  → UpdateMetadataFailed (DynamoDB)
  → PublishFailureNotification (SNS)
  → JobFailed (Fail)
- **SSL Enforcement**: Bucket policy requires SSL/TLS for all connections
- **Removal Policy**: Set to `RETAIN` to prevent accidental data loss
**Error Handling:**
- Lambda validation errors caught and routed to failure path
- Polly errors caught and routed to failure path
- All errors logged with descriptive messages
- DynamoDB updated with error details
- SNS notifications sent for all failures

Future iterations will expand this to include:
#### Output S3 Bucket (`SleepAudioOutputBucket`)
**Status**: ✅ Implemented
- Retry logic with exponential backoff
- **Versioning**: Enabled to protect against accidental overwrites
- **Public Access**: Completely blocked via `BlockPublicAccess.BLOCK_ALL`
**Status**: ✅ Implemented
- **Removal Policy**: Set to `RETAIN` to prevent accidental data loss

#### EventBridge Rule (`AudioUploadedRule`)
**Status**: ✅ Implemented

The EventBridge rule is configured to capture S3 events:
- **Event Pattern**: Matches all S3 `Object Created` events
- **State**: Enabled and ready to route events
- **Target**: Step Functions state machine (`SleepAudioPipelineStateMachine`)
- **Input Transformation**: Extracts S3 event details and passes to state machine:
- **Error Handling**: Catch block routes errors to failure path
  - `bucket`: S3 bucket name from event
  - `key`: S3 object key from event
  - `size`: Object size from event
  - `etag`: Object ETag from event
  - `text`: Placeholder text for Polly synthesis
  - `voiceId`: Voice configuration (currently "Joanna")

**IAM Role**: EventBridge automatically creates an IAM role with permission to start state machine executions.

---

## System Components (Detailed Specifications)

#### Input S3 Bucket

**Purpose**: Accept and securely store raw audio files or text scripts uploaded by users or external systems.

**Configuration**:
- **Encryption**: Server-side encryption at rest using AWS KMS (customer-managed key)
- **Access Control**: 
  - BlockPublicAccess enabled (all four settings)
  - Bucket policies restrict access to specific IAM roles only
  - No public read/write permissions
- **Versioning**: Disabled for input bucket (only current version needed)
- **Lifecycle Policies**: 
  - Transition to Intelligent-Tiering after 30 days
  - Delete incomplete multipart uploads after 7 days
  - Optional: Delete raw files after successful processing (configurable)
- **Event Notifications**: Configured to send all `s3:ObjectCreated:*` events to EventBridge
- **CORS**: Configured if direct browser uploads are required
- **Object Metadata**: Supports custom metadata for user_id, content_type, processing_hints

**Supported File Types**:
- Audio: `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`
- Text: `.txt` (for text-to-speech processing)

**Naming Convention**: `raw/{user_id}/{timestamp}_{filename}.{ext}`

---
  - `executionId`: Unique execution ID from event
  - `timestamp`: Event timestamp

### 2. Event Routing Layer

#### Amazon EventBridge (Custom Event Bus)

**Purpose**: Decouple S3 upload events from processing logic, enabling flexible event routing, filtering, and future extensibility.

**Configuration**:
- **Custom Event Bus**: `sleep-audio-events` (environment-specific name)
- **Event Archive**: Enabled with 7-day retention for replay and debugging
- **Dead Letter Queue**: SQS DLQ for failed event deliveries
- **Event Pattern Matching**: Filters events based on file type, size, and metadata

**Event Schema** (S3 Upload):
```json
{
  "version": "0",
  "id": "event-id",
  "detail-type": "Object Created",
  "source": "aws.s3",
  "account": "123456789012",
  "time": "2024-01-01T00:00:00Z",
  "region": "us-east-1",
  "resources": ["arn:aws:s3:::input-bucket"],
  "detail": {
    "version": "0",
    "bucket": {
      "name": "input-bucket"
    },
    "object": {
      "key": "raw/user123/audio.mp3",
      "size": 1024000,
      "etag": "abcdef123456"
    },
    "request-id": "request-id",
    "requester": "user-arn"
  }
}
```

#### Event Rules

**Rule 1: Audio File Processing**
- **Name**: `audio-file-uploaded-rule`
- **Event Pattern**: Matches `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg` files
- **Target**: Step Functions state machine (audio processing workflow)
- **Input Transformation**: Extracts bucket, key, size, contentType

**Rule 2: Text-to-Speech Processing**
- **Name**: `text-file-uploaded-rule`
- **Event Pattern**: Matches `.txt` files in specific prefix
- **Target**: Step Functions state machine (TTS workflow)
- **Input Transformation**: Enriches with Polly voice configuration

**Why EventBridge over Direct S3→Lambda?**
- **Flexibility**: Easy to add new targets (e.g., analytics, logging) without modifying S3 bucket
- **Filtering**: Complex event pattern matching (file type, size, metadata)
- **Replay**: Event archive enables reprocessing of historical events
- **Routing**: Can route different file types to different workflows
- **Decoupling**: Changes to processing logic don't require S3 bucket reconfiguration

---

### 3. Processing & Orchestration Layer

#### AWS Step Functions (State Machine)

**Purpose**: Orchestrate complex, multi-step audio processing workflows with built-in error handling, retry logic, and state management.

**Why Step Functions over Direct Lambda?**
- **Workflow Visibility**: Visual representation of processing pipeline in AWS Console
- **Error Handling**: Built-in retry, catch, and fallback mechanisms
- **State Management**: Maintains processing state without external database
- **Parallel Execution**: Can run validation, Polly, and Bedrock tasks in parallel
- **Long-Running Workflows**: Supports workflows up to 1 year (vs. Lambda's 15-minute limit)
- **No Code for Orchestration**: Declarative workflow definition vs. custom orchestration code

**State Machine Workflow**:

1. **Input Validation State** (Task - Lambda)
   - Validates file format, size, and metadata
   - Checks for malformed audio or unsupported codecs
   - Returns validation result and extracted properties
   - Error Handling: Retry 3 times with exponential backoff

2. **Processing Type Choice State** (Choice)
   - Routes to Polly if input is text
   - Routes to audio processing if input is audio file

3. **Text-to-Speech State** (Task - Polly Integration)
   - Uses Amazon Polly neural voices for natural-sounding speech
   - Configurable voice, language, speech rate
   - Outputs audio to temporary S3 location
   - Supports SSML for advanced speech control

4. **AI Enhancement State** (Task - Bedrock Integration, Optional)
   - Uses Amazon Bedrock for AI-powered audio generation/enhancement
   - Can generate ambient sleep sounds (rain, ocean, white noise)
   - Can enhance audio quality or add calming background layers
   - Configurable via processing hints in input metadata

5. **Parallel Processing State** (Parallel)
   - Branch A: Metadata Extraction (Lambda)
     - Extract duration, bitrate, sample rate, channels
     - Perform content analysis (silence detection, volume analysis)
     - Generate audio fingerprint/hash
   - Branch B: Quality Checks (Lambda)
     - Verify output audio integrity
     - Check for clipping or distortion
     - Validate against quality thresholds

6. **Store Results State** (Task - Lambda)
   - Save processed audio to output S3 bucket
   - Write metadata to DynamoDB table
   - Generate signed URLs for output audio (optional)

7. **Send Notification State** (Task - SNS Integration)
   - Publish success notification with metadata
   - Include links to processed audio
   - Notify downstream systems

8. **Error Handler State** (Catch Block)
   - Captures all processing errors
   - Logs error details to CloudWatch
   - Updates DynamoDB status to "failed"
   - Sends failure notification via SNS

**State Machine IAM Role**: Least-privilege permissions to invoke Lambda, Polly, Bedrock, read S3, write S3, write DynamoDB, publish SNS

**Execution Tracking**: All executions logged to CloudWatch Logs with correlation IDs for tracing

#### Processing Lambda Functions

**Validation Lambda**
**Audio Processor Lambda** (`SleepAudioProcessorFunction`)
- Runtime: Node.js 20.x or Python 3.12
- Memory: 512 MB (configurable)
- Timeout: 60 seconds
- Purpose: Process audio metadata, perform validation, and enrich data
- Current: Logs input, validates fields, returns metadata
- Future: Audio format validation, quality checks using ffprobe/ffmpeg (via Lambda Layer)
- Environment Variables: DynamoDB table name
- IAM Permissions: DynamoDB read/write, CloudWatch Logs

**Metadata Extraction Lambda**
**Future Enhancement**: Metadata Extraction Lambda
- Runtime: Node.js 20.x or Python 3.12
- Memory: 1024 MB
- Timeout: 120 seconds
- Purpose: Extract detailed audio metadata using ffprobe/ffmpeg
- Output: JSON with duration, bitrate, codec, sample rate, channels, etc.

**Store Results Lambda**
- Runtime: Node.js 20.x or Python 3.12
- Memory: 256 MB
- Timeout: 30 seconds
- Purpose: Coordinate storage of processed audio and metadata
- Writes: Output S3 bucket, DynamoDB table

#### Amazon Polly Integration

**Purpose**: Convert text scripts to natural-sounding speech for sleep audio content (e.g., guided meditations, bedtime stories).

**Configuration**:
- **Voice**: Neural voices (Joanna, Matthew, etc.) for highest quality
- **Language**: Configurable (en-US, en-GB, etc.)
- **Output Format**: MP3 (48 kbps, 24 kHz) for optimal quality/size balance
- **SSML Support**: Enabled for prosody, emphasis, pauses
- **Async Processing**: Uses Polly's async synthesis for files > 1500 characters

**Use Cases**:
- Guided meditation scripts
- Bedtime stories
- Sleep affirmations
- Relaxation prompts

#### Amazon Bedrock Integration (Optional)

**Purpose**: AI-powered audio generation and enhancement for sleep sounds.

**Configuration**:
- **Model**: Foundation model for audio generation (when available)
- **Use Cases**:
  - Generate ambient sleep sounds (rain, ocean, forest, white noise)
  - Enhance audio quality (noise reduction, normalization)
  - Mix background sounds with speech
  - Create personalized soundscapes
- **Invocation**: Async via Step Functions service integration
- **Guardrails**: Bedrock guardrails for content safety

**Note**: Bedrock audio capabilities are emerging; this integration is designed for future expansion as models become available.

---

### 4. Storage Layer

#### Output S3 Bucket (Processed Audio)

**Purpose**: Store processed, production-ready sleep audio files with durability and versioning.

**Configuration**:
- **Encryption**: Server-side encryption using AWS KMS (same key as input bucket)
- **Versioning**: Enabled to protect against accidental overwrites
- **Access Control**: 
  - BlockPublicAccess enabled
  - CloudFront distribution for content delivery (optional)
  - Signed URLs for temporary access
- **Lifecycle Policies**:
  - Transition to Infrequent Access after 90 days
  - Transition to Glacier after 365 days
  - Delete previous versions after 30 days
- **Object Tagging**: Tags for user_id, content_type, processing_date
- **Object Metadata**: Custom metadata for content-type, cache-control, content-disposition

**Naming Convention**: `processed/{environment}/{user_id}/{yyyy}/{mm}/{dd}/{audio_id}.mp3`

**CDN Integration** (Future): CloudFront distribution for global, low-latency audio delivery

#### DynamoDB Table (Metadata & Processing State)

**Purpose**: Store audio file metadata, processing status, and enable fast queries for user audio libraries.

**Table Schema**:

**Primary Key**:
- **Partition Key**: `audioId` (String) - UUID v4 for each audio file
- **Sort Key**: `version` (Number) - Version number for processed outputs

**Attributes**:
```json
{
  "audioId": "uuid-v4",
  "version": 1,
  "userId": "user123",
  "fileName": "original-filename.mp3",
  "inputS3Key": "raw/user123/audio.mp3",
  "outputS3Key": "processed/user123/audio.mp3",
  "processingStatus": "completed|processing|failed",
  "processingStartTime": "2024-01-01T00:00:00Z",
  "processingEndTime": "2024-01-01T00:05:00Z",
  "processingDurationMs": 300000,
  "audioMetadata": {
    "duration": 600,
    "bitrate": 128000,
    "sampleRate": 44100,
    "channels": 2,
    "codec": "mp3",
    "fileSize": 9600000
  },
  "pollyConfig": {
    "voiceId": "Joanna",
    "engine": "neural",
    "languageCode": "en-US"
  },
  "bedrockUsed": false,
  "errorMessage": null,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:05:00Z",
  "ttl": 1704067200
}
```

**Global Secondary Indexes (GSI)**:

1. **GSI-UserIdIndex**
   - Partition Key: `userId`
   - Sort Key: `createdAt`
   - Purpose: Query all audio files for a specific user, sorted by creation time

2. **GSI-StatusIndex**
   - Partition Key: `processingStatus`
   - Sort Key: `processingStartTime`
   - Purpose: Query all failed/processing/completed audio files for monitoring

**Configuration**:
- **Billing Mode**: On-demand (auto-scales based on traffic)
- **Encryption**: AWS-managed encryption at rest
- **Point-in-Time Recovery (PITR)**: Enabled for 35-day recovery window
- **TTL**: Enabled on `ttl` attribute for automatic cleanup of old records
- **Stream**: DynamoDB Streams enabled for audit logging or downstream processing
- **Backup**: Daily automated backups with 35-day retention

---

### 5. Notification Layer

#### SNS Topic (Processing Notifications)

**Purpose**: Notify external systems or users of processing completion, errors, or status changes.

**Configuration**:
- **Topic Name**: `sleep-audio-processing-notifications` (environment-specific)
- **Encryption**: AWS KMS encryption for messages at rest
- **Access Policy**: Restricts publishing to Step Functions execution role only
- **Message Attributes**: 
  - `audioId`: UUID of processed audio
  - `userId`: User identifier
  - `status`: completed|failed
  - `processingDurationMs`: Processing time

- Subscriptions:
  1. **Email**: For critical processing errors (filtered)
  2. **SQS Queue**: For downstream system integration and replay
  3. **Lambda Function**: For additional automation (e.g., sending push notifications)
- Message filtering for targeted notifications

**Message Schema** (Success):
```json
{
  "eventType": "AudioProcessingCompleted",
  "audioId": "uuid-v4",
  "userId": "user123",
  "fileName": "audio.mp3",
  "outputS3Uri": "s3://output-bucket/processed/user123/audio.mp3",
  "duration": 600,
  "processingDurationMs": 300000,
  "timestamp": "2024-01-01T00:05:00Z"
}
```

**Message Schema** (Failure):
```json
{
  "eventType": "AudioProcessingFailed",
  "audioId": "uuid-v4",
  "userId": "user123",
  "fileName": "audio.mp3",
  "errorCode": "VALIDATION_FAILED",
  "errorMessage": "Unsupported audio codec",
  "timestamp": "2024-01-01T00:05:00Z"
}
```

**Dead Letter Queue**: SQS DLQ for failed notification deliveries with 14-day retention

---

## Data Flow

### End-to-End Processing Flow

#### Scenario 1: Audio File Processing

1. **Upload** (t=0s)
   - User uploads `audio.mp3` to input S3 bucket: `s3://input-bucket/raw/user123/audio.mp3`
   - S3 assigns ETag and stores object with KMS encryption

2. **Event Generation** (t=0.1s)
   - S3 sends `Object Created` event to EventBridge
   - Event contains bucket name, object key, size, etag

3. **Event Routing** (t=0.2s)
   - EventBridge rule matches audio file extension (`.mp3`)
   - Rule triggers Step Functions state machine execution
   - Execution receives enriched input with S3 details

4. **Workflow Orchestration Begins** (t=0.3s)
   - Step Functions creates execution with unique execution ID
   - Input passed to first state: Validation Lambda

5. **Validation** (t=0.5s - t=5s)
   - Validation Lambda invoked with S3 object details
   - Lambda downloads audio file from S3 (or streams header)
   - Performs format validation using ffprobe
   - Checks: file size < 100 MB, duration < 3600s, valid codec
   - Returns: `{valid: true, properties: {duration: 600, bitrate: 128000}}`

6. **Processing Type Choice** (t=5.1s)
   - Step Functions evaluates choice state
   - Input is audio file → Route to audio processing branch

7. **Parallel Processing** (t=5.2s - t=30s)
   - Branch A: Metadata Extraction Lambda
     - Extracts: duration, bitrate, sample rate, channels, codec
     - Generates audio fingerprint
     - Returns metadata JSON
   - Branch B: Quality Check Lambda
     - Analyzes volume levels, detects clipping
     - Validates against quality thresholds
     - Returns: `{quality: "good", issues: []}`

8. **Store Results** (t=30.1s - t=35s)
   - Store Results Lambda invoked
   - Copies processed audio to output S3 bucket with versioning
   - Writes metadata to DynamoDB table
   - Updates status to "completed"
   - Generates signed URL for output audio (if configured)

9. **Send Notification** (t=35.1s - t=36s)
   - Step Functions publishes message to SNS topic
   - Message includes audioId, status, output S3 URI, metadata
   - SNS delivers to all subscribers (email, SQS, Lambda)

10. **Workflow Complete** (t=36s)
    - Step Functions execution status: SUCCEEDED
    - All logs written to CloudWatch Logs
    - X-Ray trace shows end-to-end latency and service calls

#### Scenario 2: Text-to-Speech Processing

1. **Upload** (t=0s)
   - User uploads `meditation-script.txt` to input S3 bucket
   - File contains text script for guided meditation

2. **Event Generation & Routing** (t=0.1s - t=0.3s)
   - S3 → EventBridge → EventBridge rule for `.txt` files
   - Step Functions state machine triggered with TTS configuration

3. **Validation** (t=0.5s - t=2s)
   - Validation Lambda checks text file:
     - File size < 10 MB
     - Valid UTF-8 encoding
     - Character count < 100,000 (Polly limit)
   - Returns: `{valid: true, characterCount: 5000}`

4. **Processing Type Choice** (t=2.1s)
   - Input is text file → Route to Polly TTS branch

5. **Text-to-Speech Synthesis** (t=2.2s - t=20s)
   - Step Functions invokes Amazon Polly (async)
   - Configuration: Neural voice (Joanna), en-US, MP3 output
   - Polly synthesizes speech and saves to output S3 bucket
   - Returns: `{outputS3Uri: "s3://output-bucket/...", duration: 600}`

6. **Metadata Extraction** (t=20.1s - t=25s)
   - Metadata Lambda extracts audio properties from Polly output
   - Records Polly configuration in metadata

7. **Store Results & Notification** (t=25.1s - t=30s)
   - Store Results Lambda writes metadata to DynamoDB
   - SNS notification sent with Polly output details

#### Scenario 3: Processing Failure

1. **Upload & Validation** (t=0s - t=5s)
   - User uploads corrupted audio file
   - Validation Lambda detects invalid format
   - Returns: `{valid: false, error: "Invalid audio codec"}`

2. **Error Handling** (t=5.1s)
   - Step Functions transitions to Catch block
   - Error Handler State invoked

3. **Error Logging & Notification** (t=5.2s - t=7s)
   - Error Handler Lambda:
     - Writes error details to CloudWatch Logs
     - Updates DynamoDB status to "failed"
     - Captures error metadata
   - SNS failure notification sent
   - Email alert triggered for critical error

4. **CloudWatch Alarm** (t=7.1s)
   - Alarm triggered if failure rate exceeds threshold
   - SNS alert sent to operations team

---

## Key AWS Services & Selection Rationale

### Amazon S3
**Why**: Industry-leading object storage with 99.999999999% durability, native event notifications, versioning, and lifecycle management. Ideal for audio file storage.

**Alternatives Considered**:
- EFS: Overkill for simple object storage; higher cost
- EBS: Not suitable for serverless architecture

### Amazon EventBridge
**Why**: Decouples event sources from targets, enables flexible routing, supports event replay, and provides built-in schema registry. Superior to direct S3→Lambda integration for complex workflows.

**Alternatives Considered**:
- Direct S3→Lambda: Less flexible, no event replay, tight coupling
- SNS: No event filtering, no replay capability

### AWS Step Functions
**Why**: Visual workflow orchestration with built-in error handling, retry logic, and state management. Eliminates need for custom orchestration code. Supports long-running workflows and parallel execution.

**Alternatives Considered**:
- Lambda-only: Complex orchestration code, no visual workflow, limited error handling
- SQS + Lambda: Manual state management, no visual representation

### Amazon Polly
**Why**: High-quality neural text-to-speech voices, supports SSML, multiple languages, and async synthesis for long texts. Fully managed service with pay-per-use pricing.

**Alternatives Considered**:
- Third-party TTS APIs: Additional vendor dependency, latency, cost
- Self-hosted TTS: Infrastructure management overhead

### Amazon Bedrock
**Why**: Serverless access to foundation models for AI-powered audio generation and enhancement. Future-proof for emerging audio AI capabilities.

**Alternatives Considered**:
- SageMaker: Requires infrastructure management, higher complexity
- Third-party AI APIs: Vendor lock-in, data egress costs

### Amazon DynamoDB
**Why**: Single-digit millisecond latency, auto-scaling, flexible schema, GSI for query patterns, and DynamoDB Streams for change capture. Perfect for metadata storage.

**Alternatives Considered**:
- RDS: Over-engineered for simple key-value access, higher cost
- Aurora Serverless: More complex setup, SQL overhead

### Amazon SNS
**Why**: Pub/sub messaging for fan-out notifications, message filtering, encryption, and multiple delivery protocols. Decouples notification delivery.

**Alternatives Considered**:
- SQS: No fan-out, requires polling
- EventBridge: Overkill for simple notifications

### AWS Lambda
**Why**: Serverless compute for custom processing logic, auto-scales, pay-per-invocation, integrates seamlessly with all AWS services.

**Alternatives Considered**:
- ECS/Fargate: Over-engineered for simple functions, cold start overhead
- EC2: Infrastructure management, no auto-scaling

---

## Security Considerations

### Data Protection

**Encryption at Rest**:
- All S3 buckets: AWS KMS encryption with customer-managed keys
- DynamoDB table: AWS-managed encryption
- SNS topics: KMS encryption for messages
- CloudWatch Logs: KMS encryption enabled

**Encryption in Transit**:
- All AWS service communication uses TLS 1.2+
- S3 bucket policies enforce `aws:SecureTransport`
- API Gateway (if added) enforces HTTPS only

**Key Management**:
- KMS customer-managed keys (CMK) for S3 and SNS
- Automatic key rotation enabled
- Key policies restrict usage to specific service roles

### Access Control

**S3 Bucket Security**:
- BlockPublicAccess enabled (all four settings)
- Bucket policies deny public access
- IAM policies grant least-privilege access
- S3 Access Points for fine-grained access control
- MFA Delete enabled on versioned buckets

**IAM Roles & Policies**:
- **Step Functions Execution Role**: 
  - Read from input S3 bucket
  - Write to output S3 bucket
  - Invoke Lambda functions
  - Call Polly and Bedrock APIs
  - Write to DynamoDB table
  - Publish to SNS topic
  - Write logs to CloudWatch
- **Lambda Execution Roles**: Function-specific least-privilege policies
- **EventBridge Rule Role**: Permission to invoke Step Functions only

**Network Security**:
- VPC Endpoints for S3, DynamoDB, and other services (optional, for Lambda in VPC)
- Security groups restrict Lambda network access (if in VPC)
- NACLs for additional network layer protection

**Audit & Compliance**:
- CloudTrail logging for all API calls
- S3 access logging enabled
- VPC Flow Logs (if using VPC)
- AWS Config rules for compliance monitoring

### Threat Mitigation

**Malicious File Upload (CWE-434)**:
- File type validation in Lambda (magic number check, not extension)
- File size limits enforced (S3 bucket policy + Lambda validation)
- Virus scanning (optional, via third-party Lambda integration)

**Injection Attacks (CWE-77, CWE-78)**:
- No shell command execution in Lambda (use libraries)
- Input sanitization for all user-provided metadata
- Polly SSML input sanitization (XML entity protection)

**Resource Exhaustion (CWE-400)**:
- Lambda concurrent execution limits
- Step Functions execution history limits
- S3 rate limiting and retry with exponential backoff
- DynamoDB on-demand scaling with alarms

**Data Leakage (CWE-200)**:
- No sensitive data in CloudWatch Logs
- S3 presigned URLs with expiration
- SNS message filtering to prevent unauthorized access

---

## Observability & Monitoring

### CloudWatch Logs

**Log Groups**:
- `/aws/lambda/validation-function` - Validation Lambda logs
- `/aws/lambda/metadata-extraction-function` - Metadata Lambda logs
- `/aws/lambda/store-results-function` - Store Results Lambda logs
- `/aws/states/sleep-audio-processing` - Step Functions execution logs
- `/aws/events/sleep-audio-events` - EventBridge event logs

**Log Retention**: 30 days (configurable via CDK context)

**Log Insights Queries**:
- Failed processing executions
- Average processing duration by file size
- Error rates by Lambda function
- Top users by processing volume

### CloudWatch Metrics

**Step Functions**:
- `ExecutionsFailed`: Number of failed workflow executions
- `ExecutionsSucceeded`: Number of successful executions
- `ExecutionTime`: Duration of workflow execution
- `ExecutionThrottled`: Number of throttled executions

**Lambda Functions**:
- `Invocations`: Number of function invocations
- `Errors`: Number of function errors
- `Duration`: Function execution time
- `ConcurrentExecutions`: Concurrent executions
- `Throttles`: Number of throttled invocations

**S3 Buckets**:
- `NumberOfObjects`: Object count
- `BucketSizeBytes`: Total bucket size
- `AllRequests`: Request count

**DynamoDB**:
- `ConsumedReadCapacityUnits`: Read capacity usage
- `ConsumedWriteCapacityUnits`: Write capacity usage
- `UserErrors`: Client-side errors
- `SystemErrors`: DynamoDB service errors

**EventBridge**:
- `Invocations`: Rule invocation count
- `FailedInvocations`: Failed target invocations
- `TriggeredRules`: Number of triggered rules

**SNS**:
- `NumberOfMessagesPublished`: Messages sent
- `NumberOfNotificationsFailed`: Failed deliveries

### CloudWatch Alarms

**Critical Alarms** (SNS notification to operations team):
1. **High Failure Rate**: Step Functions failures > 10% over 5 minutes
2. **Lambda Errors**: Any Lambda function errors > 5 over 5 minutes
3. **Processing Latency**: Step Functions execution time > 5 minutes (p99)
4. **DynamoDB Throttling**: Throttled requests > 0 over 1 minute
5. **SNS Delivery Failures**: Failed notifications > 0 over 5 minutes

**Warning Alarms** (CloudWatch dashboard):
1. **High S3 Storage**: Input bucket size > 100 GB
2. **Long Processing Queue**: EventBridge events delayed > 1 minute
3. **Lambda Cold Starts**: Cold start duration > 3 seconds (p95)

### AWS X-Ray Tracing

**Enabled For**:
- All Lambda functions
- Step Functions executions
- API Gateway (if added)

**Trace Insights**:
- End-to-end latency from S3 upload to notification
- Service call breakdown (S3, Polly, Bedrock, DynamoDB)
- Error root cause analysis
- Performance bottleneck identification

**Service Map**: Visual representation of service dependencies and call patterns

### Dashboard

**CloudWatch Dashboard** (`sleep-audio-pipeline-dashboard`):
- Processing volume (requests/minute)
- Success vs. failure rate
- Average processing duration
- Cost estimation (based on invocations)
- Top errors and their frequency
- Active Step Functions executions

---

## Multi-Environment Support

### CDK Context Configuration

The pipeline supports deployment to multiple environments (dev, stage, prod) via CDK context values:

**cdk.json** (example):
```json
{
  "context": {
    "environments": {
      "dev": {
        "account": "111111111111",
        "region": "us-east-1",
        "inputBucketName": "sleep-audio-input-dev",
        "outputBucketName": "sleep-audio-output-dev",
        "logRetentionDays": 7,
        "enableXRay": false,
        "enableBedrock": false,
        "alarmEmailEndpoint": "dev-team@example.com"
      },
      "stage": {
        "account": "222222222222",
        "region": "us-east-1",
        "inputBucketName": "sleep-audio-input-stage",
        "outputBucketName": "sleep-audio-output-stage",
        "logRetentionDays": 14,
        "enableXRay": true,
        "enableBedrock": true,
        "alarmEmailEndpoint": "stage-team@example.com"
      },
      "prod": {
        "account": "333333333333",
        "region": "us-east-1",
        "inputBucketName": "sleep-audio-input-prod",
        "outputBucketName": "sleep-audio-output-prod",
        "logRetentionDays": 30,
        "enableXRay": true,
        "enableBedrock": true,
        "alarmEmailEndpoint": "ops-team@example.com"
      }
    }
  }
}
```

**Deployment Commands**:
```bash
# Deploy to dev
npx cdk deploy --context environment=dev

# Deploy to stage
npx cdk deploy --context environment=stage

# Deploy to prod
npx cdk deploy --context environment=prod
```

### Environment-Specific Configuration

| Configuration | Dev | Stage | Prod |
|--------------|-----|-------|------|
| Log Retention | 7 days | 14 days | 30 days |
| X-Ray Tracing | Disabled | Enabled | Enabled |
| Bedrock Integration | Disabled | Enabled | Enabled |
| S3 Lifecycle Policies | Aggressive | Moderate | Conservative |
| Lambda Memory | 512 MB | 1024 MB | 1024 MB |
| Alarm Thresholds | Relaxed | Moderate | Strict |
| Backup Retention | 7 days | 14 days | 35 days |

### Resource Naming Convention

All resources include environment suffix: `{resource-type}-{environment}`

Examples:
- `sleep-audio-input-dev` (S3 bucket)
- `sleep-audio-processing-state-machine-prod` (Step Functions)
- `sleep-audio-events-stage` (EventBridge bus)

---

## Deployment Strategy & CI/CD Pipeline

### Multi-Environment Deployment (Issue #9)

The application supports automated deployment across multiple environments using CDK context configuration and AWS CDK Pipelines.

#### Environment Configuration

**Available Environments:**
- **dev**: Development environment for active development and testing
- **stage**: Staging environment for pre-production testing
- **prod**: Production environment for live workloads

**Environment-Specific Settings:**

| Setting | Dev | Stage | Prod |
|---------|-----|-------|------|
| Log Retention | 7 days | 14 days | 30 days |
| X-Ray Tracing | Disabled | Enabled | Enabled |
| Lambda Memory | 512 MB | 1024 MB | 1024 MB |
| Bucket Naming | `*-dev` | `*-stage` | `*-prod` |
| SNS Topic Naming | `*-dev` | `*-stage` | `*-prod` |
| State Machine Naming | `*-dev` | `*-stage` | `*-prod` |

#### Manual Deployment Commands

Deploy to specific environment using CDK context:

```bash
# Deploy to development environment
npx cdk deploy --context environment=dev

# Deploy to staging environment
npx cdk deploy --context environment=stage

# Deploy to production environment (requires manual confirmation)
npx cdk deploy --context environment=prod
```

#### CDK Pipelines (Automated Deployment)

**Status**: ✅ Skeleton Implemented (Issue #9)

A self-mutating CI/CD pipeline has been scaffolded using AWS CDK Pipelines:

**Pipeline Stages:**
1. **Source**: Pull code from repository (GitHub/CodeCommit)
2. **Build & Synth**: Install dependencies, run tests, synthesize CDK app
3. **UpdatePipeline**: Self-update the pipeline definition
4. **Deploy**: Deploy application stacks to target environments

**Future Enhancements** (Subsequent Issues):
- Connect to actual source repository
- Add pre-deployment validation stages
- Configure multi-environment deployment waves:
  - Wave 1: Deploy to dev (automatic)
  - Wave 2: Deploy to stage (automatic after dev success)
  - Wave 3: Deploy to prod (manual approval required)
- Add integration tests between stages
- Configure notifications for deployment status

### Deployment Best Practices

1. **Always deploy to dev first**: Test changes in development before promoting
2. **Use feature branches**: Create separate branches for major features
3. **Run tests locally**: Execute `npm test` before pushing code
4. **Review diffs**: Use `cdk diff` to review changes before deployment
5. **Monitor deployments**: Watch CloudWatch Logs during and after deployment
6. **Rollback plan**: Keep previous stack versions for quick rollback if needed

---

## Cost Considerations

### Estimated Monthly Costs (Production)

**Assumptions**:
- 100,000 audio files processed per month
- Average file size: 5 MB input, 3 MB output
- Average processing duration: 30 seconds
- 50% use Polly, 10% use Bedrock

**Cost Breakdown**:

| Service | Usage | Estimated Cost |
|---------|-------|----------------|
| S3 Storage | 800 GB stored (input + output) | $18.40 |
| S3 Requests | 100K PUT, 200K GET | $0.50 |
| EventBridge | 100K events | $1.00 |
| Step Functions | 100K state transitions (avg 10 per execution) | $25.00 |
| Lambda | 100K invocations, 30s avg duration, 1024 MB | $50.00 |
| Polly | 50K characters (50% of files) | $20.00 |
| Bedrock | 10K inference requests | $100.00 (model-dependent) |
| DynamoDB | 100K writes, 500K reads (on-demand) | $15.00 |
| SNS | 100K notifications | $0.50 |
| CloudWatch Logs | 50 GB ingested, 30-day retention | $25.00 |
| **Total** | | **~$255.40/month** |

### Cost Optimization Strategies

1. **S3 Lifecycle Policies**:
   - Transition input files to Glacier after processing
   - Delete old output files after 1 year
   - Enable Intelligent-Tiering for unpredictable access patterns

2. **Lambda Optimization**:
   - Right-size memory allocation based on profiling
   - Use ARM64 (Graviton2) for 20% cost savings
   - Minimize cold starts with provisioned concurrency (if needed)

3. **DynamoDB**:
   - Use on-demand billing for unpredictable workloads
   - Switch to provisioned capacity for consistent traffic (25% savings)
   - Enable DynamoDB caching with DAX for read-heavy workloads

4. **CloudWatch Logs**:
   - Reduce log retention from 30 days to 7 days (dev/stage)
   - Use log sampling for verbose logs
   - Export to S3 for long-term retention (cheaper)

5. **Step Functions**:
   - Use Express Workflows for short-duration, high-volume workflows (cheaper)
   - Standard Workflows for long-duration, stateful workflows

6. **Bedrock**:
   - Cache AI-generated content to avoid duplicate requests
   - Use Provisioned Throughput for predictable workloads (cost savings)

---

## Future Extensibility

### Planned Enhancements

1. **API Layer** (Issue #5+)
   - **Amazon API Gateway**: REST API for file upload, status queries, and audio retrieval
   - **AWS AppSync**: GraphQL API for real-time queries and subscriptions
   - **Cognito User Pools**: User authentication and authorization

2. **Content Delivery** (Issue #6+)
   - **CloudFront Distribution**: Global CDN for low-latency audio delivery
   - **S3 Transfer Acceleration**: Faster uploads from distant locations
   - **Signed Cookies**: Secure content access without URL tampering

3. **Advanced Processing** (Issue #7+)
   - **MediaConvert**: Professional-grade transcoding for multiple formats
   - **Transcribe**: Speech-to-text for audio content indexing
   - **Comprehend**: Sentiment analysis and content classification
   - **Rekognition**: Audio thumbnail generation from waveform

4. **Analytics & Insights** (Issue #8+)
   - **Athena**: SQL queries on S3 access logs and processing metadata
   - **QuickSight**: Business intelligence dashboards
   - **Kinesis Data Firehose**: Real-time streaming analytics

5. **User Experience** (Issue #9+)
   - **Personalization**: ML-based recommendations using Personalize
   - **A/B Testing**: Multiple voice/sound variations with optimal selection
   - **Feedback Loop**: User ratings stored in DynamoDB for quality improvement

6. **Operational Excellence** (Issue #10+)
   - **EventBridge Pipes**: Direct integration with third-party SaaS
   - **Systems Manager**: Parameter Store for dynamic configuration
   - **Secrets Manager**: API key rotation for third-party integrations
   - **Cost Anomaly Detection**: Automated cost spike alerts

### Architectural Extensibility Points

- **EventBridge Custom Bus**: Easy to add new event sources and targets without modifying existing infrastructure
- **Step Functions Workflow**: Simple to add new processing steps (e.g., watermarking, compression)
- **Lambda Functions**: Modular design allows adding new processing capabilities independently
- **DynamoDB Streams**: Enable downstream processing without modifying primary workflow
- **SNS Fan-Out**: Add new subscribers without workflow changes

### Integration Patterns

- **API Gateway → Lambda → Step Functions**: User-initiated processing
- **EventBridge Scheduler → Step Functions**: Scheduled batch processing
- **S3 → EventBridge → SQS → Lambda → Step Functions**: Decoupled processing with queue buffering
- **DynamoDB Streams → Lambda → ElasticSearch**: Real-time search indexing


---

## Document Maintenance

**This architecture document is the single source of truth for the Sleep Audio Pipeline system design.**

### Maintenance Rules

1. **Synchronization**: This document MUST be updated whenever infrastructure changes are made in CDK code
2. **Diagram Consistency**: Mermaid diagram must accurately reflect all components and data flow
3. **Version Control**: All changes tracked in Git with descriptive commit messages
4. **Review Process**: Architecture changes require approval before implementation
5. **Living Document**: This document evolves as the system grows

### Update Triggers

Update this document when:
- New AWS service is added to the pipeline
- Data flow or event routing changes
- Security or IAM policies are modified
- New environment is added
- Cost structure changes significantly
- New extensibility point is identified

### Related Documentation

- **[.github/AGENT_GUIDELINES.md](.github/AGENT_GUIDELINES.md)**: TDD principles and development workflow
- **[CONTRIBUTING.md](CONTRIBUTING.md)**: Contribution guidelines and PR process
- **[README.md](README.md)**: Project overview and getting started guide
- **[EXPERIMENT.md](EXPERIMENT.md)**: Comprehensive experiment design and methodology
- **[META-PROMPTS.md](META-PROMPTS.md)**: Reusable patterns for agentic TDD IaC projects
- **[SUMMARY.md](SUMMARY.md)**: Project summary and key decisions

---
**Last Updated**: Issue #14 Complete (Experiment Design Documentation)  
**Next Review**: Issue #15 (Code Quality, Coverage & Reflection)

**Next Review**: After Issue #12 (End-to-End Validation, Documentation Polish & Project Completion)
