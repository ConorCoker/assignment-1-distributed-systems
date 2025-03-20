import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import Ajv from 'ajv';
import schema from '../shared/types.schema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema.definitions['Item'] || {});
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }));

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const id = event.pathParameters?.id;
  const timestamp = event.pathParameters?.timestamp;
  const body = event.body ? JSON.parse(event.body) : undefined;
  if (!id || !timestamp || !body || !validate(body)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid input' }) };
  }

  await ddbDocClient.send(new UpdateCommand({
    TableName: process.env.TABLE_NAME,
    Key: { id, timestamp },
    UpdateExpression: 'SET #name = :n, quantity = :q, active = :a, description = :d',
    ExpressionAttributeNames: { '#name': 'name' },
    ExpressionAttributeValues: {
      ':n': body.name,
      ':q': body.quantity,
      ':a': body.active,
      ':d': body.description,
    },
  }));
  return { statusCode: 200, body: JSON.stringify({ message: 'Item updated' }) };
};