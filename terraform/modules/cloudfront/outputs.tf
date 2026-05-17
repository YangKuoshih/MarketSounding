# =============================================================================
# CloudFront + S3 Frontend Hosting Module — Outputs
# =============================================================================

output "cloudfront_distribution_url" {
  description = "The full URL of the CloudFront distribution (https://...)"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution (for cache invalidation)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_bucket_name" {
  description = "The name of the S3 bucket hosting frontend assets"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  description = "The ARN of the S3 bucket hosting frontend assets"
  value       = aws_s3_bucket.frontend.arn
}
