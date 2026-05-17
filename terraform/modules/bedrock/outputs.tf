# =============================================================================
# Bedrock & AgentCore Module — Outputs
# =============================================================================
# These outputs provide model IDs as constants for Lambda environment variables.
# Model access must be enabled via the AWS Console (Bedrock → Model Access page).

output "opus_model_id" {
  description = "Bedrock model ID for Claude Opus 4.7 (primary reasoning)"
  value       = local.opus_model_id
}

output "haiku_model_id" {
  description = "Bedrock model ID for Claude 3.5 Haiku (utility tasks)"
  value       = local.haiku_model_id
}

output "dealer_persona_ids" {
  description = "List of dealer persona IDs configured for AgentCore agents"
  value       = local.dealer_persona_ids
}

output "agentcore_memory_table_prefix" {
  description = "Prefix used for AgentCore memory session keys in DynamoDB"
  value       = "${var.name_prefix}-agentcore-memory"
}
