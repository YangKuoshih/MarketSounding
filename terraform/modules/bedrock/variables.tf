# =============================================================================
# Bedrock & AgentCore Module — Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource naming (e.g., ms-dev)"
  type        = string
}

variable "aws_region" {
  description = "AWS region where Bedrock models are accessed"
  type        = string
  default     = "us-east-1"
}
