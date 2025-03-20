import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import Ajv from 'ajv';
import schema from '../shared/types.schema.json';

const ajv = new Ajv();
const validateQuery = ajv.compile(schema.definitions['ItemQueryParams'] || {});
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }));

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const id = event.pathParameters?.id;
  const queryParams = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
  if (!validateQuery(queryParams)) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid query params' }) };

  const expressionValues: Record<string, any> = { ':id': id };
  let filterExpression = '';
  if (queryParams.active) {
    filterExpression = 'active = :active';
    expressionValues[':active'] = queryParams.active === 'true';
  }

  const result = await ddbDocClient.send(new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: 'id = :id',
    FilterExpression: filterExpression || undefined,
    ExpressionAttributeValues: Object.keys(expressionValues).length ? expressionValues : { ':id': id },
  }));
  return { statusCode: 200, body: JSON.stringify(result.Items) };
};