import { APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function success(body: Record<string, unknown>): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function created(body: Record<string, unknown>): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function unauthorized(message: string = 'Unauthorized'): APIGatewayProxyResult {
  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function conflict(message: string): APIGatewayProxyResult {
  return {
    statusCode: 409,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function serverError(message: string = 'Internal server error'): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function methodNotAllowed(): APIGatewayProxyResult {
  return {
    statusCode: 405,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}

export function accepted(body: Record<string, unknown>): APIGatewayProxyResult {
  return {
    statusCode: 202,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function notFound(message: string = 'Not found'): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}
