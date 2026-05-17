variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be 'dev' or 'prod'."
  }
}

variable "project_prefix" {
  description = "Prefix for all resource names"
  type        = string
  default     = "ms"
}

variable "project_name" {
  description = "Full project name for tagging"
  type        = string
  default     = "marketsounding"
}
