# Contributing to Sleep Audio Pipeline

Thank you for your interest in contributing to this project! This document outlines the guidelines and workflow for making contributions.

## Development Philosophy

This project follows **strict Test-Driven Development (TDD)**. All infrastructure code and logic must be developed test-first.

## TDD Workflow (Mandatory)

### 1. Write Failing Tests First

Before writing any CDK infrastructure code:

1. Create or update test files in the `test/` directory
2. Write tests that describe the desired behavior/infrastructure
3. Run `npm test` - tests should FAIL (red)
4. Commit the failing tests

### 2. Implement Minimal Code

1. Write the minimal CDK code to make tests pass
2. Focus on one test at a time
3. Run `npm test` frequently
4. Once tests pass (green), proceed

### 3. Refactor

1. Improve code quality without changing behavior
2. Ensure tests still pass after refactoring
3. Keep code DRY and maintainable

### 4. Sync Documentation

After implementation:

1. Update `ARCHITECTURE.md` if infrastructure changed
2. Update Mermaid diagram if data flow changed
3. Ensure documentation matches reality

## Testing Standards

### Required Test Types

1. **Fine-Grained Assertions**: Test specific resource properties
   ```typescript
   template.hasResourceProperties('AWS::S3::Bucket', {
     BucketEncryption: {
       ServerSideEncryptionConfiguration: [{
         ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' }
       }]
     }
   });
   ```

2. **Resource Count Tests**: Verify exact number of resources
   ```typescript
   template.resourceCountIs('AWS::Lambda::Function', 1);
   ```

3. **Snapshot Tests**: Catch unintended changes
   ```typescript
   expect(template.toJSON()).toMatchSnapshot();
   ```

### Test Organization

- One test file per stack/construct
- Group related tests with `describe()` blocks
- Use clear, descriptive test names
- Test both happy paths and edge cases

## Conventional Commits

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `chore`: Build/config changes
- `ci`: CI/CD changes

### Examples
```
feat(ingestion): add S3 bucket with encryption

test(ingestion): add failing test for S3 bucket encryption

docs(architecture): update Mermaid diagram with new Lambda

fix(processing): correct IAM policy for DynamoDB access
```

## Pull Request Process

1. **Create Issue First**: Every PR should reference an issue
2. **Branch Naming**: `feat/issue-123-short-description` or `fix/issue-456-bug-name`
3. **Tests Must Pass**: CI must be green before merge
4. **Architecture Sync**: Ensure `ARCHITECTURE.md` is updated
5. **Code Review**: At least one approval required

## Local Development Workflow

```bash
# Install dependencies
npm ci

# Run tests in watch mode
npm test -- --watch

# Build TypeScript
npm run build

# Synthesize CloudFormation
npx cdk synth

# View differences with deployed stack
npx cdk diff

# Deploy (only after tests pass)
npx cdk deploy
```

## AWS CDK Best Practices

1. **Prefer L2/L3 Constructs**: Use high-level CDK constructs when available
2. **Least Privilege**: Grant minimal IAM permissions
3. **Immutable Infrastructure**: Use CDK's declarative approach
4. **Environment Agnostic**: Avoid hardcoding account/region
5. **Logical IDs**: Use stable, meaningful construct IDs
6. **Well-Architected**: Follow AWS Well-Architected Framework

## Code Style

- Use TypeScript strict mode
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Questions or Issues?

- Review `.github/AGENT_GUIDELINES.md` for AI agent persona
- Check `ARCHITECTURE.md` for system design
- Open an issue for discussion

## Pre-Deployment Checklist

Before deploying to AWS:

- [ ] All tests pass locally (`npm test`)
- [ ] CDK synth succeeds (`npx cdk synth`)
- [ ] CDK diff reviewed (`npx cdk diff`)
- [ ] Architecture documentation updated
- [ ] No hardcoded secrets or credentials
- [ ] IAM policies follow least privilege
- [ ] Cost impact considered

---

**Remember**: Tests first, code second, documentation always in sync!
