import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import { getSecret } from './secrets';
import { unauthorized } from './response';

const JWT_SECRET_ARN = process.env.JWT_SECRET_ARN!;

export interface UserSession {
  userId: string;
  username: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Validates the JWT Bearer token from the Authorization header.
 * Returns the decoded user session if valid, or null if invalid/expired.
 * 
 * Does NOT reveal whether the resource exists - always returns generic 401.
 */
export async function validateToken(event: APIGatewayProxyEvent): Promise<UserSession | null> {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1];

  try {
    const jwtSecret = process.env.IS_LOCAL === 'true'
      ? (process.env.JWT_SECRET ?? 'local-dev-secret-not-for-production')
      : await getSecret(JWT_SECRET_ARN);
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;

    if (!decoded.userId || !decoded.username) {
      return null;
    }

    return {
      userId: decoded.userId as string,
      username: decoded.username as string,
      issuedAt: decoded.iat ?? 0,
      expiresAt: decoded.exp ?? 0,
    };
  } catch {
    // Token is invalid or expired - return null without revealing details
    return null;
  }
}

/**
 * Middleware wrapper that enforces authentication on a handler.
 * Returns 401 Unauthorized without revealing resource existence for invalid/expired tokens.
 */
export function withAuth(
  handler: (event: APIGatewayProxyEvent, session: UserSession) => Promise<APIGatewayProxyResult>
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const session = await validateToken(event);

    if (!session) {
      return unauthorized('Unauthorized');
    }

    return handler(event, session);
  };
}
