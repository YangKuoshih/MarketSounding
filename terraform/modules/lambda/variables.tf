# =============================================================================
# Lambda Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

# -----------------------------------------------------------------------------
# DynamoDB Table Names
# -----------------------------------------------------------------------------

variable "users_table_name" {
  description = "Name of the users DynamoDB table"
  type        = string
}

variable "events_table_name" {
  description = "Name of the events DynamoDB table"
  type        = string
}

variable "simulations_table_name" {
  description = "Name of the simulations DynamoDB table"
  type        = string
}

variable "rounds_table_name" {
  description = "Name of the rounds DynamoDB table"
  type        = string
}

variable "reactions_table_name" {
  description = "Name of the reactions DynamoDB table"
  type        = string
}

variable "graph_nodes_table_name" {
  description = "Name of the graph_nodes DynamoDB table"
  type        = string
}

variable "graph_edges_table_name" {
  description = "Name of the graph_edges DynamoDB table"
  type        = string
}

# -----------------------------------------------------------------------------
# DynamoDB Table ARNs
# -----------------------------------------------------------------------------

variable "users_table_arn" {
  description = "ARN of the users DynamoDB table"
  type        = string
}

variable "events_table_arn" {
  description = "ARN of the events DynamoDB table"
  type        = string
}

variable "simulations_table_arn" {
  description = "ARN of the simulations DynamoDB table"
  type        = string
}

variable "rounds_table_arn" {
  description = "ARN of the rounds DynamoDB table"
  type        = string
}

variable "reactions_table_arn" {
  description = "ARN of the reactions DynamoDB table"
  type        = string
}

variable "graph_nodes_table_arn" {
  description = "ARN of the graph_nodes DynamoDB table"
  type        = string
}

variable "graph_edges_table_arn" {
  description = "ARN of the graph_edges DynamoDB table"
  type        = string
}

# -----------------------------------------------------------------------------
# S3
# -----------------------------------------------------------------------------

variable "documents_bucket_name" {
  description = "Name of the documents S3 bucket"
  type        = string
}

variable "documents_bucket_arn" {
  description = "ARN of the documents S3 bucket"
  type        = string
}

# -----------------------------------------------------------------------------
# Step Functions
# -----------------------------------------------------------------------------

variable "state_machine_arn" {
  description = "ARN of the simulation Step Functions state machine"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------

variable "jwt_secret_arn" {
  description = "ARN of the JWT secret in Secrets Manager"
  type        = string
  default     = ""
}

variable "tavily_api_key_arn" {
  description = "ARN of the Tavily API key in Secrets Manager"
  type        = string
  default     = ""
}
