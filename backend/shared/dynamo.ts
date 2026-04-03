import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getEnv } from "./env";

let documentClient: DynamoDBDocumentClient | null = null;

export function getDynamoDocumentClient(): DynamoDBDocumentClient {
  if (documentClient) {
    return documentClient;
  }

  const region = getEnv("AWS_REGION") ?? process.env.AWS_REGION ?? "eu-west-2";
  const client = new DynamoDBClient({ region });

  documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  return documentClient;
}
