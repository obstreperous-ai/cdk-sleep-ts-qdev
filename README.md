# Sleep Audio Pipeline - AWS CDK TypeScript

An event-driven, serverless sleep audio processing pipeline built with AWS CDK and TypeScript, following strict Test-Driven Development (TDD) practices. This system ingests audio files via S3, routes events through EventBridge, processes audio with Lambda functions, and stores results in S3 and DynamoDB, with SNS notifications for status updates. Designed for scalability, security, and maintainability following AWS Well-Architected Framework principles.

## Table of Contents

- [Strict TDD Rules](#strict-tdd-rules) | [Project Structure](#project-structure) | [Architecture Overview](#architecture-overview) | [Getting Started](#getting-started) | [Environment Setup](#environment-setup) | [Deployment](#deployment) | [Usage](#usage) | [Testing](#testing) | [Documentation](#documentation) | [CI/CD](#cicd-pipeline) | [Troubleshooting](#troubleshooting) | [License](#license)

## Strict TDD Rules

**This project follows mandatory Test-Driven Development**:

1. ✅ **Write failing tests FIRST** - Describe infrastructure before implementing
2. ✅ **Then write minimal code** - Make tests pass with simplest solution
3. ✅ **Refactor with confidence** - Tests protect against regressions
4. ✅ **Update documentation** - Keep `ARCHITECTURE.md` and Mermaid diagrams in sync
5. ❌ **Never deploy without passing tests** - `npm test` must succeed
6. ❌ **Never write infrastructure before tests** - TDD is non-negotiable

## Architecture Overview

### High-Level Flow

```
User Upload → S3 Input Bucket → EventBridge Rule → Step Functions State Machine
                                                            ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ State Machine Workflow:                                                      │
│ 1. WriteInitialMetadata (DynamoDB)                                          │
│ 2. ProcessAudioMetadata (Lambda) - Full Processing:                         │
│    • Download from S3                                                        │
│    • Process audio OR convert text-to-speech (Polly)                        │
│    • Upload to Output S3                                                     │
│    • Update DynamoDB                                                         │
│ 3. UpdateMetadataCompleted (DynamoDB)                                       │
│ 4. PublishSuccessNotification (SNS)                                         │
│                                                                              │
│ Error Path (on failures):                                                    │
│ → UpdateMetadataFailed (DynamoDB)                                           │
│ → PublishFailureNotification (SNS)                                          │
│ → JobFailed (Fail state)                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

- **S3 Buckets**: Input (with EventBridge) and Output (for processed audio)
- **EventBridge**: Event routing with pattern matching
- **Step Functions**: Workflow orchestration with retry logic and error handling
- **Lambda**: Complete audio processing (validation, Polly synthesis, S3 operations, DynamoDB updates)
- **DynamoDB**: Metadata storage and processing state tracking
- **SNS Topics**: Success and failure notifications
- **CloudWatch**: Logging, metrics, and alarms
- **X-Ray**: Distributed tracing (prod/stage environments)

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed system design and Mermaid diagrams.

## Project Structure

```
├── bin/                    # CDK app entry point
├── lib/                    # CDK stack definitions
├── test/                   # Jest tests (TDD-first)
├── .github/
│   ├── workflows/ci.yml    # CI/CD pipeline
│   └── AGENT_GUIDELINES.md # AI agent persona and rules
├── ARCHITECTURE.md         # Detailed system architecture + Mermaid diagrams
├── CONTRIBUTING.md         # Development workflow and guidelines
├── SUMMARY.md              # Project summary and key decisions
└── README.md               # This file
```

## Getting Started

### Prerequisites

- **Node.js** 18.x or later
- **AWS CLI** configured with appropriate credentials
- **AWS CDK** 2.x (`npm install -g aws-cdk`)
- **AWS Account** with permissions to create resources

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd cdk-sleep-ts-qdev

# Install dependencies (clean install from lock file)
npm ci

# Bootstrap CDK (first time only, per account/region)
npx cdk bootstrap
```

## Environment Setup

The project supports three environments: **dev**, **stage**, and **prod**. Each environment has specific configurations defined in `cdk.json` context:

| Configuration | Dev | Stage | Prod |
|--------------|-----|-------|------|
| Log Retention | 7 days | 14 days | 30 days |
| X-Ray Tracing | Disabled | Enabled | Enabled |
| Lambda Memory | 1024 MB | 1024 MB | 1024 MB |
| Lambda Timeout | 300s (5 min) | 300s (5 min) | 300s (5 min) |

Environment-specific bucket names automatically include environment suffix (e.g., `sleep-audio-input-dev`).

## Testing

Following strict TDD, **always run tests before deploying**:

```bash
# Run tests (TDD-first!)
npm test

# Run tests in watch mode (during development)
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Coverage

The project includes comprehensive tests:
- Infrastructure component validation (S3, EventBridge, Step Functions, Lambda, DynamoDB, SNS)
- Complete workflow testing (success and error paths)
- Retry policy validation
- Error handling verification
- Multi-environment configuration testing
- IAM permissions validation
- End-to-end pipeline integration tests

## Deployment

### Local Development

```bash
# Build TypeScript
npm run build

# Synthesize CloudFormation
npx cdk synth

# View infrastructure diff
npx cdk diff
```

### Deploy to Environments

```bash
# Deploy to development environment
npx cdk deploy --context environment=dev

# Deploy to staging environment
npx cdk deploy --context environment=stage

# Deploy to production environment (requires confirmation)
npx cdk deploy --context environment=prod

# Deploy to AWS (only after tests pass)
npx cdk deploy
```

## Documentation
- **[SUMMARY.md](./SUMMARY.md)** - Project summary, key decisions, and future enhancements

## Usage

### Processing Audio Files

1. **Upload an audio file** to the input S3 bucket:
   ```bash
   aws s3 cp my-audio.mp3 s3://sleep-audio-input-dev/
   ```

2. **The pipeline automatically**:
   - Detects the upload via EventBridge
   - Triggers Step Functions state machine
   - Validates file format and size
   - Processes the audio
   - Stores processed audio in output bucket
   - Updates DynamoDB with metadata
   - Sends SNS success notification

3. **Retrieve processed audio**:
   ```bash
   aws s3 ls s3://sleep-audio-output-dev/
   aws s3 cp s3://sleep-audio-output-dev/my-audio_processed_<timestamp>.mp3 ./
   ```

### Text-to-Speech Processing

1. **Upload a text file** to the input S3 bucket:
   ```bash
   aws s3 cp meditation-script.txt s3://sleep-audio-input-dev/
   ```

2. **The pipeline automatically**:
   - Converts text to speech using Amazon Polly (neural voice)
   - Generates MP3 audio output
   - Stores result in output bucket
   - Updates DynamoDB and sends SNS notification

### Monitoring

- **View Step Functions executions**:
  ```bash
  aws stepfunctions list-executions --state-machine-arn <arn>
  ```

- **Query DynamoDB for processing status**:
  ```bash
  aws dynamodb get-item --table-name SleepAudioMetadataTable --key '{"audioId": {"S": "<execution-id>"}, "createdAt": {"S": "<timestamp>"}}'
  ```

- **View CloudWatch Logs**:
  - Lambda logs: `/aws/lambda/SleepAudioProcessorFunction`
  - State Machine logs: `/aws/states/SleepAudioPipelineStateMachine`

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design, data flow, and Mermaid diagrams
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - TDD workflow, testing standards, and PR process
- **[.github/AGENT_GUIDELINES.md](./.github/AGENT_GUIDELINES.md)** - AI agent development persona

## Development Workflow

1. **Create Issue**: Define feature or fix
2. **Write Failing Tests**: Describe desired infrastructure in `test/`
3. **Implement Code**: Write minimal CDK code in `lib/`
4. **Make Tests Pass**: Iterate until green
5. **Update Architecture**: Sync `ARCHITECTURE.md` and diagrams
6. **Open PR**: CI will run tests, synth, and diff
7. **Review & Merge**: Ensure documentation is current

## CI/CD Pipeline

Every pull request automatically runs:
- ✅ Dependency installation (`npm ci`)
- ✅ Test suite (`npm test`)
- ✅ TypeScript build (`npm run build`)
- ✅ CDK synthesis (`npx cdk synth`)

## Troubleshooting

### Common Issues

**Problem**: CDK synthesis fails
- **Solution**: Ensure all dependencies are installed (`npm ci`) and TypeScript is compiled (`npm run build`)

**Problem**: Tests fail on deployment
- **Solution**: Run `npm test` to see specific failures. Ensure all infrastructure changes have corresponding tests.

**Problem**: Lambda function times out
- **Solution**: Check CloudWatch Logs for errors. Lambda timeout is set to 300 seconds (5 minutes) for audio processing.

**Problem**: File processing fails with "Unsupported file format"
- **Solution**: Ensure file has supported extension (.mp3, .wav, .m4a, .flac, .ogg, .txt). File size must be < 100 MB.

**Problem**: SNS notifications not received
- **Solution**: Check SNS topic subscriptions are confirmed. Verify CloudWatch Alarms have correct SNS topic ARN.

**Problem**: DynamoDB query returns no results
- **Solution**: Verify execution completed successfully. Check DynamoDB table for records with correct partition key (audioId) and sort key (createdAt).

### Debug Mode

Enable verbose logging in Lambda by checking CloudWatch Logs:
```bash
aws logs tail /aws/lambda/SleepAudioProcessorFunction --follow
```
- ✅ Infrastructure diff (`npx cdk diff`)

See [.github/workflows/ci.yml](./.github/workflows/ci.yml) for details.

## License

This project is licensed under the terms specified in the [LICENSE](./LICENSE) file.
