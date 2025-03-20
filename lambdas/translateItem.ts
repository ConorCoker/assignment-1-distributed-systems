import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
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

  const translation = await translateClient.send(new TranslateTextCommand({
    Text: result.Item.description,
    SourceLanguageCode: 'en',
    TargetLanguageCode: language,
  }));
  return { statusCode: 200, body: JSON.stringify({ ...result.Item, translatedDescription: translation.TranslatedText }) };
};