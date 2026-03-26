#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DiagramStack } from '../lib/diagr-stack';

const app = new cdk.App();

new DiagramStack(app, 'DiagramStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'Diagr — UML Designer static web app (S3 + CloudFront)',
});

app.synth();

