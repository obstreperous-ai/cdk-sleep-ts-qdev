import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../lib/pipeline-stack';

describe('PipelineStack - CDK Pipelines for Multi-Environment Deployment', () => {
  let app: cdk.App;
  let stack: PipelineStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new PipelineStack(app, 'TestPipelineStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    template = Template.fromStack(stack);
  });

  describe('Pipeline Stack Creation', () => {
    test('Pipeline stack creates successfully', () => {
      expect(template.toJSON()).toBeDefined();
    });

    test('Pipeline stack is synthesizable', () => {
      // Verify CDK can synthesize the stack
      expect(() => app.synth()).not.toThrow();
    });
  });

  describe('CodePipeline Resources', () => {
    test('Creates a CodePipeline pipeline', () => {
      template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
    });

    test('Pipeline has source stage', () => {
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: Match.arrayWith([
          Match.objectLike({
            Name: 'Source'
          })
        ])
      });
    });

    test('Pipeline has build/synth stage', () => {
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: Match.arrayWith([
          Match.objectLike({
            Name: Match.stringLikeRegexp('.*Build.*|.*Synth.*')
          })
        ])
      });
    });
  });

  describe('Multi-Stage Deployment', () => {
    test('Pipeline has UpdatePipeline stage for self-mutation', () => {
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: Match.arrayWith([
          Match.objectLike({
            Name: 'UpdatePipeline'
          })
        ])
      });
    });

    test('Pipeline includes deployment stages', () => {
      // Pipeline should have stages for deploying the application
      const pipelineResource = template.toJSON().Resources;
      const pipeline = Object.values(pipelineResource).find(
        (resource: any) => resource.Type === 'AWS::CodePipeline::Pipeline'
      ) as any;
      
      expect(pipeline).toBeDefined();
      expect(pipeline.Properties.Stages.length).toBeGreaterThan(2); // At least Source, Build, UpdatePipeline
    });
  });

  describe('IAM Roles and Permissions', () => {
    test('Pipeline has proper execution role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'codepipeline.amazonaws.com'
              }
            })
          ])
        }
      });
    });
  });
});
