import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

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
        allowMethods: ['OPTIONS', 'POST'],
        allowHeaders: ['Content-Type'],
      },
    });
    const items = api.root.addResource('items');
    items.addMethod('POST', new apig.LambdaIntegration(addItemFn));
  }
}
