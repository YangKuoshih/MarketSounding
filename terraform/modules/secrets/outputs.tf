output "jwt_secret_arn" {
  description = "ARN of the JWT signing secret"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "tavily_api_key_arn" {
  description = "ARN of the Tavily API key secret"
  value       = aws_secretsmanager_secret.tavily_api_key.arn
}
