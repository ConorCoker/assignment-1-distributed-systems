import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as custom from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { generateBatch } from '../shared/util';
import { items } from '../seed/items';

export class Assignment1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const itemsTable = new dynamodb.Table(this, 'ItemsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'Items',
    });

    const addItemFn = new lambda.NodejsFunction(this, 'AddItemFn', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/addItem.ts`,
      handler: 'handler',
      environment: { TABLE_NAME: itemsTable.tableName, REGION: 'eu-west-1' },
    });
    itemsTable.grantReadWriteData(addItemFn);

    const getItemsFn = new lambda.NodejsFunction(this, 'GetItemsFn', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/getItems.ts`,
      handler: 'handler',
      environment: { TABLE_NAME: itemsTable.tableName, REGION: 'eu-west-1' },
    });
    itemsTable.grantReadData(getItemsFn);

    const updateItemFn = new lambda.NodejsFunction(this, 'UpdateItemFn', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/updateItem.ts`,
      handler: 'handler',
      environment: { TABLE_NAME: itemsTable.tableName, REGION: 'eu-west-1' },
    });
    itemsTable.grantReadWriteData(updateItemFn);

    const translateItemFn = new lambda.NodejsFunction(this, 'TranslateItemFn', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/translateItem.ts`,
      handler: 'handler',
      environment: { TABLE_NAME: itemsTable.tableName, REGION: 'eu-west-1' },
    });
    itemsTable.grantReadData(translateItemFn);
    translateItemFn.role?.addManagedPolicy(cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('TranslateFullAccess'));

    const api = new apig.RestApi(this, 'AppApi', {
      deployOptions: { stageName: 'dev' },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['OPTIONS', 'POST', 'GET', 'PUT'],
        allowHeaders: ['Content-Type', 'x-api-key'], 
      },
    });

    const apiKey = new apig.ApiKey(this, 'ApiKey');
    const usagePlan = new apig.UsagePlan(this, 'UsagePlan', {
      apiStages: [{ api, stage: api.deploymentStage }],
    });
    usagePlan.addApiKey(apiKey);

    new custom.AwsCustomResource(this, 'SeedItems', {
      onCreate: {
        service: 'DynamoDB',
        action: 'batchWriteItem',
        parameters: {
          RequestItems: { [itemsTable.tableName]: generateBatch(items) },
        },
        physicalResourceId: custom.PhysicalResourceId.of('seedItems'),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [itemsTable.tableArn],
      }),
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
    });

    const itemsResource = api.root.addResource('items');
    itemsResource.addMethod('POST', new apig.LambdaIntegration(addItemFn), { apiKeyRequired: true });

    const itemById = itemsResource.addResource('{id}');
    itemById.addMethod('GET', new apig.LambdaIntegration(getItemsFn));

    const specificItem = itemById.addResource('{timestamp}');
    specificItem.addMethod('PUT', new apig.LambdaIntegration(updateItemFn), { apiKeyRequired: true });

    const translation = specificItem.addResource('translation');
    translation.addMethod('GET', new apig.LambdaIntegration(translateItemFn));
    itemsTable.grantWriteData(translateItemFn);
    
    new cdk.CfnOutput(this, 'ApiKeyId', { value: apiKey.keyId });
  }
}