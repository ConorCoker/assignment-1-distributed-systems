import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import Ajv from 'ajv';
import schema from '../shared/types.schema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema.definitions['Item'] || {});
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }));

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = event.body ? JSON.parse(event.body) : undefined;
  if (!body || !validate(body)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid item data' }) };
  }
  await ddbDocClient.send(new PutCommand({
    TableName: process.env.TABLE_NAME,
    Item: body,
  }));
  return { statusCode: 201, body: JSON.stringify({ message: 'Item added' }) };
};