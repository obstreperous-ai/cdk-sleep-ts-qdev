# Meta-Prompts & Reusable Patterns for Agentic TDD Infrastructure as Code

## About This Document

This document extracts **reusable meta-prompting patterns and agent guidelines** from the Sleep Audio Pipeline project. These patterns can be applied to **any future agentic TDD IaC project** using AWS CDK, Terraform, Pulumi, or similar Infrastructure as Code frameworks.

The patterns here represent lessons learned from building a production-grade, event-driven serverless pipeline using strict Test-Driven Development with AI agent assistance.

---

## Table of Contents

1. [Agent Persona Template](#agent-persona-template)
2. [TDD Enforcement Rules](#tdd-enforcement-rules)
3. [Architecture Synchronization Protocol](#architecture-synchronization-protocol)
4. [Issue Implementation Workflow](#issue-implementation-workflow)
5. [Testing Standards & Patterns](#testing-standards--patterns)
6. [Documentation Maintenance Rules](#documentation-maintenance-rules)
7. [Deployment Discipline](#deployment-discipline)
8. [AWS CDK Best Practices](#aws-cdk-best-practices)
9. [How to Use These Patterns](#how-to-use-these-patterns)

---

## Agent Persona Template

**Purpose**: Define the AI agent's expertise, role, and behavioral guidelines for consistent, high-quality infrastructure development.

### Template

```markdown
# Agent Guidelines for [Project Name]

## Agent Persona

You are a **[Role Title]** (e.g., Senior AWS CDK TypeScript TDD Specialist). Your expertise spans:
- Infrastructure as Code (IaC) with [Framework: CDK/Terraform/Pulumi]
- [Cloud Provider: AWS/Azure/GCP] architecture and best practices
- Serverless architectures and managed services
- Test-Driven Development (TDD) practices
- [Additional specializations relevant to project]

## Core Responsibilities

1. **Test-First Development**: Always write failing tests before implementing infrastructure
2. **Architecture Alignment**: Ensure all implementations match documented architecture
3. **Security-First**: Apply least-privilege IAM, encryption, and security best practices
4. **Documentation Sync**: Keep architecture documentation perfectly synchronized with code
5. **Best Practices**: Follow [Cloud Provider] Well-Architected Framework principles

## Communication Style

- Be precise and technical
- Reference specific IaC constructs and services
- Explain architectural decisions and trade-offs
- Highlight security implications
- Call out deviations from best practices
```

### Customization Tips

- Replace `[Project Name]`, `[Role Title]`, `[Framework]`, and `[Cloud Provider]` with your project specifics
- Add domain-specific expertise (e.g., data engineering, ML infrastructure, container orchestration)
- Include project-specific constraints (cost, compliance, performance SLAs)

---

## TDD Enforcement Rules

**Purpose**: Establish non-negotiable Test-Driven Development workflow that prevents infrastructure-before-tests anti-pattern.

### Core Principles

```markdown
## Strict Test-Driven Development (TDD)

**Always follow this workflow**:

1. **Red**: Write failing test(s) first that describe the desired infrastructure or behavior
2. **Green**: Write the minimal [IaC framework] code necessary to make the tests pass
3. **Refactor**: Improve code quality while keeping tests green

**Never write infrastructure code before writing tests.**

### TDD Rules (Non-Negotiable)

✅ **DO:**
- Write failing tests FIRST - Describe infrastructure before implementing
- Write minimal code - Make tests pass with simplest solution
- Refactor with confidence - Tests protect against regressions
- Update documentation - Keep architecture docs in sync
- Run tests frequently - `npm test` (or equivalent) after every change

❌ **NEVER:**
- Write infrastructure before tests
- Deploy without passing tests
- Skip test coverage for "simple" components
- Commit code with failing tests (except initial red phase)
- Ignore test failures or warnings

### Test-First Checklist

Before writing any infrastructure code:
- [ ] Test file created or updated
- [ ] Test describes desired behavior/resource
- [ ] Test runs and FAILS (red phase)
- [ ] Test failure message is clear and specific
- [ ] Test committed to version control
```

### Implementation Strategy

**For AI Agents**: Include these rules in the system prompt or context. Use them as a pre-condition check before generating any infrastructure code.

**For Human Teams**: Enforce through:
- PR review checklists
- Git hooks that verify test changes before infrastructure changes
- CI/CD pipeline that fails if test coverage drops

---

## Architecture Synchronization Protocol

**Purpose**: Prevent documentation drift by establishing architecture documentation as the single source of truth.

### Protocol Template

```markdown
## Architecture Documentation Synchronization

**`ARCHITECTURE.md` is the single source of truth for all system design and implementation decisions.**

### Before Starting Any Issue

**Always read ARCHITECTURE.md first**:
- Understand the complete system design and data flow
- Review component specifications and configurations
- Follow documented patterns (security, IAM, naming conventions, error handling)
- Validate your approach against the Mermaid diagram

### After Every Infrastructure Change

**Update ARCHITECTURE.md to keep it perfectly in sync**:

1. **Component Descriptions**: If functionality changed
   - Update service specifications
   - Revise configuration details
   - Document new IAM permissions

2. **Mermaid Diagram**: If data flow or services changed
   - Add new components
   - Update connections and arrows
   - Revise component labels
   - Update legend and status indicators

3. **Data Flow Section**: If event routing changed
   - Update end-to-end flow descriptions
   - Revise success and error paths
   - Document new integration points

4. **Implementation Status**: Mark components as implemented
   - Update status checkboxes
   - Add "Completed (Issue #X)" sections
   - Document configuration decisions

**Documentation drift is a critical failure** - Never deploy without syncing ARCHITECTURE.md

### Synchronization Checklist

After completing infrastructure changes:
- [ ] ARCHITECTURE.md component section updated
- [ ] Mermaid diagram reflects current architecture
- [ ] Data flow matches implementation
- [ ] Implementation status updated
- [ ] Configuration details documented
- [ ] Security/IAM changes documented
- [ ] Last updated timestamp refreshed
```

### Enforcement Mechanisms

- **PR Template**: Include "Architecture documentation updated?" checkbox
- **CI Check**: Script that verifies ARCHITECTURE.md was modified when infrastructure code changes
- **Review Requirement**: Reviewer must verify diagram matches code

---

## Issue Implementation Workflow

**Purpose**: Standard workflow for implementing infrastructure features through issues, ensuring consistency and quality.

### Standard Issue Flow

```markdown
## Development Workflow

### Standard Issue Implementation Flow

1. **Review** (5-10 minutes)
   - Read ARCHITECTURE.md section for the component being implemented
   - Understand existing system context and dependencies
   - Identify integration points with other components

2. **Design** (10-15 minutes)
   - Ensure your approach matches documented architecture patterns
   - Identify required resources and configurations
   - Plan test scenarios (happy path + edge cases)
   - Consider security, IAM, and error handling requirements

3. **Test (Red)** (30-45 minutes)
   - Write failing tests based on architecture specifications
   - Test resource creation and configuration
   - Test integrations and permissions
   - Test error handling and edge cases
   - Run tests and confirm they FAIL for the right reasons

4. **Implement (Green)** (45-60 minutes)
   - Write minimal [IaC] code to match architecture and pass tests
   - Follow least-privilege IAM principles
   - Use high-level constructs (L2/L3) when available
   - Keep code DRY and maintainable
   - Run tests frequently and fix failures

5. **Refactor** (15-30 minutes)
   - Improve code quality while maintaining architecture alignment
   - Extract reusable constructs if patterns emerge
   - Add code comments for complex logic
   - Ensure naming conventions are consistent
   - Verify tests still pass after refactoring

6. **Document** (20-30 minutes)
   - Update ARCHITECTURE.md if implementation reveals new details or changes
   - Add implementation status markers
   - Update configuration tables
   - Document key decisions and trade-offs

7. **Verify** (10-15 minutes)
   - Confirm Mermaid diagram still reflects reality
   - Run full test suite
   - Execute `[synth command]` (e.g., `cdk synth`)
   - Review diff output
   - Check for unintended changes

**Key Principle**: If the implementation diverges from ARCHITECTURE.md, either:
- Fix the code to match the architecture, OR
- Update the architecture document with a clear rationale for the change
```

### Timeboxing Strategy

The timeboxes above are estimates. For AI agents, these translate to:
- **Review**: 1-2 context retrieval operations
- **Design**: Analysis phase before code generation
- **Test**: Generate comprehensive test suite
- **Implement**: Generate minimal passing code
- **Refactor**: Optimization pass
- **Document**: Update architecture docs
- **Verify**: Final validation checks

---

## Testing Standards & Patterns

**Purpose**: Define comprehensive testing patterns for infrastructure code.

### Test Taxonomy for IaC

```markdown
## Testing Standards

### Required Test Types

1. **Resource Existence Tests**
   - Verify resource is created
   - Check correct resource type
   - Validate resource count

2. **Fine-Grained Property Tests**
   - Test specific resource properties
   - Validate configurations (encryption, versioning, etc.)
   - Check security settings
   - Verify environment-specific configurations

3. **IAM Permission Tests**
   - Validate least-privilege principles
   - Check service-to-service permissions
   - Verify role trust relationships
   - Test policy conditions

4. **Integration Tests**
   - Verify resource connections (e.g., S3 → EventBridge → Step Functions)
   - Test event routing and transformations
   - Check error handling paths
   - Validate retry policies

5. **Multi-Environment Tests**
   - Test environment-specific configurations
   - Verify conditional features (e.g., tracing enabled in prod)
   - Check resource naming conventions per environment

6. **Snapshot Tests** (Use judiciously)
   - Catch unintended template changes
   - Review snapshots during PR review
   - Update intentionally, not automatically
```

### Example Test Structure (AWS CDK + Jest)

```typescript
describe('ComponentStack', () => {
  let template: Template;

  beforeEach(() => {
    const app = new cdk.App();
    const stack = new ComponentStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  describe('Resource Creation', () => {
    test('creates S3 bucket', () => {
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });
  });

  describe('Security Configuration', () => {
    test('enables bucket encryption', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [{
            ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' }
          }]
        }
      });
    });
  });

  describe('IAM Permissions', () => {
    test('grants least-privilege access', () => {
      // Test specific IAM policy statements
    });
  });
});
```

---

## Documentation Maintenance Rules

**Purpose**: Establish living documentation that evolves with the codebase.

### Documentation Update Triggers

```markdown
## Documentation Maintenance

### Update Triggers

Update documentation when:
- ✅ New AWS service added to the pipeline
- ✅ Data flow or event routing changes
- ✅ Security or IAM policies modified
- ✅ New environment added (dev/stage/prod)
- ✅ Cost structure changes significantly
- ✅ New extensibility point identified
- ✅ Architecture decision made or changed
- ✅ Integration pattern changes

### Documentation Files

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `README.md` | Project overview, quick start, usage | Every major feature |
| `ARCHITECTURE.md` | System design, component specs, diagrams | Every infrastructure change |
| `CONTRIBUTING.md` | Development workflow, TDD rules | When process changes |
| `SUMMARY.md` | Project summary, decisions, timeline | After each issue/milestone |
| `.github/AGENT_GUIDELINES.md` | AI agent persona and rules | When guidelines evolve |

### Mermaid Diagram Maintenance

**Diagram Update Checklist**:
- [ ] New components added with correct styling
- [ ] New connections/arrows added
- [ ] Component labels updated
- [ ] Legend updated with status indicators
- [ ] Dashed vs solid lines correctly used (implemented vs planned)
- [ ] Color coding consistent (green = implemented, etc.)
- [ ] Annotations updated (retry policies, error paths, etc.)
```

---

## Deployment Discipline

**Purpose**: Prevent premature or unsafe deployments.

### Pre-Deployment Checklist Template

```markdown
## Deployment Discipline

### Never Deploy Until

- [ ] Tests pass locally (`npm test` or equivalent)
- [ ] [Synth command] succeeds (e.g., `cdk synth`, `terraform plan`)
- [ ] Diff output reviewed (e.g., `cdk diff`, `terraform plan`)
- [ ] ARCHITECTURE.md updated and synchronized
- [ ] No hardcoded secrets or credentials in code
- [ ] IAM policies follow least-privilege principle
- [ ] Cost impact estimated and approved
- [ ] Security implications reviewed
- [ ] Rollback plan documented

### Deployment Strategy

1. **Local Validation**
   - Run full test suite
   - Execute synth/plan command
   - Review diff output carefully

2. **Environment Progression**
   - Deploy to dev first
   - Validate in dev environment
   - Promote to stage
   - Validate in stage environment
   - Production deployment (with approval)

3. **Post-Deployment Verification**
   - Monitor CloudWatch/logs for errors
   - Verify resources created successfully
   - Test end-to-end functionality
   - Check cost metrics
```

---

## AWS CDK Best Practices

**Purpose**: Codify AWS CDK-specific best practices (adaptable to other IaC frameworks).

See `.github/AGENT_GUIDELINES.md` in this repository for specific AWS CDK patterns. General principles:

1. **Prefer High-Level Constructs**: Use L2/L3 constructs over L1 (CloudFormation) resources
2. **Least Privilege IAM**: Grant only minimum required permissions
3. **Immutable Infrastructure**: Leverage declarative infrastructure definitions
4. **Environment Agnostic**: Avoid hardcoding account IDs or regions
5. **Logical Resource IDs**: Use stable, meaningful construct IDs
6. **Well-Architected Framework**: Follow the six pillars (Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability)

---

## How to Use These Patterns

### For New IaC Projects

1. **Copy `.github/AGENT_GUIDELINES.md`** to your project and customize:
   - Update agent persona for your domain
   - Adjust TDD rules for your framework
   - Customize architecture sync protocol

2. **Establish ARCHITECTURE.md** as your living architecture document:
   - Start with high-level design
   - Use Mermaid diagrams for visualization
   - Update after every infrastructure change

3. **Create Issue Templates** based on the implementation workflow:
   - Include TDD checklist
   - Reference architecture document
   - Require documentation updates

4. **Set Up CI/CD** with documentation checks:
   - Verify tests pass
   - Check for ARCHITECTURE.md updates when code changes
   - Enforce conventional commits

### For AI Agent Prompts

Include in your system prompt or context:
- Agent persona from this document
- TDD enforcement rules
- Architecture synchronization protocol
- Issue implementation workflow

### For Human Teams

Use these patterns as:
- PR review guidelines
- Onboarding documentation
- Definition of Done criteria
- Architecture Decision Records (ADR) template

---

## Conclusion

These meta-prompts represent battle-tested patterns for building high-quality, test-driven infrastructure. They emphasize:

- **Test-First Development**: Infrastructure quality starts with comprehensive tests
- **Living Documentation**: Architecture docs that evolve with code
- **Security by Default**: Least-privilege IAM and encryption everywhere
- **Deployment Discipline**: Never deploy untested or undocumented infrastructure

Apply these patterns to your next IaC project to achieve production-ready infrastructure with confidence.

---

**Source Project**: Sleep Audio Pipeline (cdk-sleep-ts-qdev)  
**License**: Same as source project  
**Last Updated**: Issue #13 (Documentation Enhancement & Meta-Prompting Extraction)
