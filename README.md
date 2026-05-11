# Sleep Audio Pipeline - AWS CDK TypeScript

An event-driven, serverless sleep audio processing pipeline built with AWS CDK and TypeScript, following strict Test-Driven Development (TDD) practices. This system ingests audio files via S3, routes events through EventBridge, processes audio with Lambda functions, and stores results in S3 and DynamoDB, with SNS notifications for status updates. Designed for scalability, security, and maintainability following AWS Well-Architected Framework principles.

## Strict TDD Rules

**This project follows mandatory Test-Driven Development**:

1. ✅ **Write failing tests FIRST** - Describe infrastructure before implementing
2. ✅ **Then write minimal code** - Make tests pass with simplest solution
3. ✅ **Refactor with confidence** - Tests protect against regressions
4. ✅ **Update documentation** - Keep `ARCHITECTURE.md` and Mermaid diagrams in sync
5. ❌ **Never deploy without passing tests** - `npm test` must succeed
6. ❌ **Never write infrastructure before tests** - TDD is non-negotiable

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
└── README.md               # This file
```

## Getting Started

```bash
# Install dependencies
npm ci

# Run tests (TDD-first!)
npm test

# Build TypeScript
npm run build

# Synthesize CloudFormation
npx cdk synth

# View infrastructure diff
npx cdk diff

# Deploy to AWS (only after tests pass)
npx cdk deploy
```

## Documentation

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
- ✅ Infrastructure diff (`npx cdk diff`)

See [.github/workflows/ci.yml](./.github/workflows/ci.yml) for details.

## License

This project is licensed under the terms specified in the [LICENSE](./LICENSE) file.
