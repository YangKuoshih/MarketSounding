output "aws_region" {
  description = "AWS region where resources are deployed"
  value       = var.aws_region
}

output "environment" {
  description = "Current deployment environment"
  value       = var.environment
}

output "name_prefix" {
  description = "Resource naming prefix (project-environment)"
  value       = local.name_prefix
}

output "api_gateway_id" {
  description = "The ID of the REST API Gateway"
  value       = module.api_gateway.api_id
}

output "api_gateway_invoke_url" {
  description = "The invoke URL for the API Gateway stage"
  value       = module.api_gateway.invoke_url
}

output "api_gateway_stage_name" {
  description = "The deployed API Gateway stage name"
  value       = module.api_gateway.stage_name
}

output "cloudfront_distribution_url" {
  description = "The CloudFront distribution URL for the frontend"
  value       = module.cloudfront.cloudfront_distribution_url
}

output "cloudfront_domain_name" {
  description = "The CloudFront distribution domain name"
  value       = module.cloudfront.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "The CloudFront distribution ID (for cache invalidation)"
  value       = module.cloudfront.cloudfront_distribution_id
}

output "frontend_bucket_name" {
  description = "The S3 bucket name for frontend static assets"
  value       = module.cloudfront.frontend_bucket_name
}
