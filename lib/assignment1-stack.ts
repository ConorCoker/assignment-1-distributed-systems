import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as custom from 'aws-cdk-lib/custom-resources';
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

    const api = new apig.RestApi(this, 'AppApi', {
      deployOptions: { stageName: 'dev' },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['OPTIONS', 'POST', 'GET'],
        allowHeaders: ['Content-Type'],
      },
    });

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
    });

    const itemsResource = api.root.addResource('items');
    itemsResource.addMethod('POST', new apig.LambdaIntegration(addItemFn));

    const getItemsFn = new lambda.NodejsFunction(this, 'GetItemsFn', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/getItems.ts`,
      handler: 'handler',
      environment: { TABLE_NAME: itemsTable.tableName, REGION: 'eu-west-1' },
    });
    itemsTable.grantReadData(getItemsFn);

    const itemById = itemsResource.addResource('{id}');
    itemById.addMethod('GET', new apig.LambdaIntegration(getItemsFn));
  }
}
