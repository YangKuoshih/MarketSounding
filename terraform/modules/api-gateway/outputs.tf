output "api_id" {
  description = "The ID of the REST API"
  value       = aws_api_gateway_rest_api.main.id
}

output "invoke_url" {
  description = "The invoke URL for the deployed stage"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "stage_name" {
  description = "The deployed stage name"
  value       = aws_api_gateway_stage.main.stage_name
}

output "root_resource_id" {
  description = "The root resource ID of the REST API"
  value       = aws_api_gateway_rest_api.main.root_resource_id
}

output "execution_arn" {
  description = "The execution ARN of the REST API"
  value       = aws_api_gateway_rest_api.main.execution_arn
}
