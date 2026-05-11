import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as CdkBase from '../lib/cdk-base-stack';

describe('CdkBaseStack', () => {
  test('Stack creates successfully', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CdkBase.CdkBaseStack(app, 'MyTestStack');
    // THEN
    const template = Template.fromStack(stack);

    // Verify template can be synthesized
    expect(template.toJSON()).toBeDefined();
  });
});
