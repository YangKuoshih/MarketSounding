# =============================================================================
# Step Functions Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

# -----------------------------------------------------------------------------
# Lambda Function ARNs
# -----------------------------------------------------------------------------

variable "init_simulation_function_arn" {
  description = "ARN of the init-simulation Lambda function"
  type        = string
}

variable "dealer_agent_function_arn" {
  description = "ARN of the dealer-agent Lambda function"
  type        = string
}

variable "write_round_function_arn" {
  description = "ARN of the write-round Lambda function"
  type        = string
}

variable "complete_simulation_function_arn" {
  description = "ARN of the complete-simulation Lambda function"
  type        = string
}
