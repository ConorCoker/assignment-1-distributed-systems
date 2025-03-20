import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }));
const translateClient = new TranslateClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const id = event.pathParameters?.id;
  const timestamp = event.pathParameters?.timestamp;
  const language = event.queryStringParameters?.language;
  if (!id || !timestamp || !language) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters' }) };
  }

  const result = await ddbDocClient.send(new GetCommand({
    TableName: process.env.TABLE_NAME,
    Key: { id, timestamp },
  }));
  if (!result.Item) return { statusCode: 404, body: JSON.stringify({ error: 'Item not found' }) };

  const item = result.Item;
  const translations = item.translations || {};
  if (translations[language]) {
    return { statusCode: 200, body: JSON.stringify({ ...item, translatedDescription: translations[language] }) };
  }

  const translation = await translateClient.send(new TranslateTextCommand({
    Text: item.description,
    SourceLanguageCode: 'en',
    TargetLanguageCode: language,
  }));
  translations[language] = translation.TranslatedText;

  await ddbDocClient.send(new UpdateCommand({
    TableName: process.env.TABLE_NAME,
    Key: { id, timestamp },
    UpdateExpression: 'SET translations = :t',
    ExpressionAttributeValues: { ':t': translations },
  }));

  return { statusCode: 200, body: JSON.stringify({ ...item, translatedDescription: translation.TranslatedText }) };
};