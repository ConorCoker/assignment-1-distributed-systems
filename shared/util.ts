import { marshall } from '@aws-sdk/util-dynamodb';
import { Item } from './types';

export const generateItem = (item: Item) => ({
  PutRequest: { Item: marshall(item) },
});

export const generateBatch = (data: Item[]) => data.map(generateItem);
