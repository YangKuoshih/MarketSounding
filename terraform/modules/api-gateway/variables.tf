variable "name_prefix" {
  description = "Prefix for resource names (e.g., ms-dev)"
  type        = string
}

variable "stage_name" {
  description = "API Gateway deployment stage name"
  type        = string
  default     = "v1"
}

# Lambda invoke ARNs for AWS_PROXY integrations
variable "auth_lambda_invoke_arn" {
  description = "Invoke ARN of the auth Lambda"
  type        = string
}

variable "auth_lambda_function_name" {
  description = "Function name of the auth Lambda (for aws_lambda_permission)"
  type        = string
}

variable "research_lambda_invoke_arn" {
  description = "Invoke ARN of the research Lambda"
  type        = string
}

variable "research_lambda_function_name" {
  description = "Function name of the research Lambda"
  type        = string
}

variable "simulation_kickoff_lambda_invoke_arn" {
  description = "Invoke ARN of the simulation-kickoff Lambda"
  type        = string
}

variable "simulation_kickoff_lambda_function_name" {
  description = "Function name of the simulation-kickoff Lambda"
  type        = string
}

variable "graph_builder_lambda_invoke_arn" {
  description = "Invoke ARN of the graph-builder Lambda"
  type        = string
}

variable "graph_builder_lambda_function_name" {
  description = "Function name of the graph-builder Lambda"
  type        = string
}

variable "graph_reader_lambda_invoke_arn" {
  description = "Invoke ARN of the graph-reader Lambda"
  type        = string
}

variable "graph_reader_lambda_function_name" {
  description = "Function name of the graph-reader Lambda"
  type        = string
}

variable "chat_agent_lambda_invoke_arn" {
  description = "Invoke ARN of the chat-agent Lambda"
  type        = string
}

variable "chat_agent_lambda_function_name" {
  description = "Function name of the chat-agent Lambda"
  type        = string
}

# Optional: separate crisis lambda. We'll route POST /simulations/{id}/crisis
# to the simulation-kickoff Lambda by default since they share the same module.
variable "crisis_lambda_invoke_arn" {
  description = "Invoke ARN of the crisis Lambda (defaults to simulation-kickoff)"
  type        = string
  default     = ""
}

variable "crisis_lambda_function_name" {
  description = "Function name of the crisis Lambda (defaults to simulation-kickoff)"
  type        = string
  default     = ""
}
