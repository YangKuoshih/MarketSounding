import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({});

const secretCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getSecret(secretArn: string): Promise<string> {
  // Local dev: if no ARN provided, read from env var directly
  if (!secretArn) {
    const envKey = process.env.TAVILY_API_KEY ?? '';
    if (envKey) return envKey;
    throw new Error('No secret ARN and no TAVILY_API_KEY env var set');
  }

  const cached = secretCache.get(secretArn);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret ${secretArn} has no string value`);
  }

  secretCache.set(secretArn, {
    value: response.SecretString,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return response.SecretString;
}
