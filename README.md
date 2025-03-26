## Serverless REST Assignment - Distributed Systems

__Name:__ Conor Coker

__Demo:__ []

### Context

**Context:** Items Management  
This web API manages a collection of items, such as products, stored in a DynamoDB table. It supports creating, retrieving, updating, and translating item descriptions.

**Table item attributes:**
+ `id` - string (Partition key)  
  Unique identifier for an item.  
+ `timestamp` - string (Sort Key)  
  Timestamp of when the item was added or updated.  
+ `name` - string  
  Name of the item (e.g., "HDMI Cable").  
+ `quantity` - number  
  Quantity of the item (e.g., 10).  
+ `active` - boolean  
  Indicates if the item is in stock or not.  
+ `description` - string  
  Description of the item (e.g., "Cystal clear HD Video").  
+ `translations` - Map<string, string>  
  Stores translated descriptions.

### App API Endpoints

- **POST /items**  
  Adds a new item to the DynamoDB table. Requires API key for authentication.  
- **GET /items/{id}**  
  Retrieves all items with the given `id`.  
- **GET /items/{id}?active={value}**  
  Retrieves all items with the given `id` where the `active` attribute equals the provided value (e.g., "true" or "false").  
- **PUT /items/{id}/{timestamp}**  
  Updates an existing item identified by `id` and `timestamp`. Requires API key for authentication.  
- **GET /items/{id}/{timestamp}/translation?language={code}**  
  Returns the item with its `description` translated into the specified language (e.g., "fr" for French). Uses cached translations if available.

### Features

#### Translation Persistence
The translation persistence requirement is met by storing translations in the DynamoDB table under a `translations` field. When a translation is requested, the Lambda function checks if the translation exists in the `translations` map. If not, it fetches it from Amazon Translate, stores it in the item, and returns it. Future requests use the cached value, reducing the amount of API calls.

**Structure of a table item with translations:**
+ `id` - string (Partition key)  
+ `timestamp` - string (Sort Key)  
+ `name` - string  
+ `quantity` - number  
+ `active` - boolean  
+ `description` - string  
+ `translations` - Map<string, string>  

#### API Keys
API key authentication protects the POST (`/items`) and PUT (`/items/{id}/{timestamp}`) endpoints to restrict modifications to authorized users. I implemented this using AWS API Gateway’s built-in API key feature. The POST and PUT methods are configured to require the key via the `apiKeyRequired: true` property.

**Code excerpt from `lib/assignment1-stack.ts`:**
```ts
const apiKey = new apig.ApiKey(this, 'ApiKey');
const usagePlan = new apig.UsagePlan(this, 'UsagePlan', {
  apiStages: [{ api, stage: api.deploymentStage }],
});
usagePlan.addApiKey(apiKey);

const itemsResource = api.root.addResource('items');
itemsResource.addMethod('POST', new apig.LambdaIntegration(addItemFn), { apiKeyRequired: true });

const specificItem = itemById.addResource('{timestamp}');
specificItem.addMethod('PUT', new apig.LambdaIntegration(updateItemFn), { apiKeyRequired: true });