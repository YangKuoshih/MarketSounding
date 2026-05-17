import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { docClient } from '../../lib/dynamodb';
import { getSecret } from '../../lib/secrets';
import { success, created, badRequest, unauthorized, serverError, methodNotAllowed } from '../../lib/response';
import { authRequestSchema } from './validation';

const USERS_TABLE = process.env.USERS_TABLE_NAME!;
const JWT_SECRET_ARN = process.env.JWT_SECRET_ARN!;
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRY = '24h';

/**
 * A pre-computed bcrypt hash used for timing-safe comparison when user is not found.
 * This prevents timing-based user enumeration attacks.
 */
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return success({});
  }

  if (method !== 'POST') {
    return methodNotAllowed();
  }

  try {
    if (path.endsWith('/register')) {
      return await handleRegister(event);
    } else if (path.endsWith('/login')) {
      return await handleLogin(event);
    }

    return badRequest('Unknown auth endpoint');
  } catch (error) {
    console.error('Auth handler error:', error);
    return serverError('Internal server error');
  }
}

async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  if (!body) {
    return badRequest('Invalid request body');
  }

  const parsed = authRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return badRequest(firstError.message);
  }

  const { username, password } = parsed.data;

  // Check if username already exists
  const existingUser = await findUserByUsername(username);
  if (existingUser) {
    return conflict('Username already exists');
  }

  // Hash password with bcrypt
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const userId = randomUUID();
  const now = new Date().toISOString();

  // Store user in DynamoDB
  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      userId,
      username,
      passwordHash,
      createdAt: now,
    },
  }));

  // Issue JWT token
  const jwtSecret = await getSecret(JWT_SECRET_ARN);
  const token = jwt.sign(
    { userId, username },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRY }
  );

  return created({
    success: true,
    token,
    userId,
  });
}

async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  if (!body) {
    return badRequest('Invalid request body');
  }

  const parsed = authRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return badRequest(firstError.message);
  }

  const { username, password } = parsed.data;

  // Look up user - timing-safe: always hash even if user not found
  const user = await findUserByUsername(username);

  // Always perform bcrypt comparison to prevent timing-based enumeration
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const isValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !isValid) {
    return unauthorized('Invalid credentials');
  }

  // Issue JWT token
  const jwtSecret = await getSecret(JWT_SECRET_ARN);
  const token = jwt.sign(
    { userId: user.userId, username: user.username },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRY }
  );

  return success({
    success: true,
    token,
    userId: user.userId,
  });
}

async function findUserByUsername(username: string): Promise<{ userId: string; username: string; passwordHash: string } | null> {
  const result = await docClient.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'username-index',
    KeyConditionExpression: 'username = :username',
    ExpressionAttributeValues: {
      ':username': username,
    },
    Limit: 1,
  }));

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const item = result.Items[0];
  return {
    userId: item.userId as string,
    username: item.username as string,
    passwordHash: item.passwordHash as string,
  };
}

function parseBody(body: string | null): Record<string, unknown> | null {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

// Re-export conflict from response for use here
function conflict(message: string): APIGatewayProxyResult {
  return {
    statusCode: 409,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({ error: message }),
  };
}
