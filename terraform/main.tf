provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "random" {}

locals {
  name_prefix = "${var.project_prefix}-${var.environment}"
}

# =============================================================================
# DynamoDB Module
# =============================================================================
module "dynamodb" {
  source      = "./modules/dynamodb"
  name_prefix = local.name_prefix
}

# =============================================================================
# S3 Module (Document Storage)
# =============================================================================
module "s3" {
  source      = "./modules/s3"
  name_prefix = local.name_prefix
}

# =============================================================================
# API Gateway Module (must come after lambda module — depends on Lambda ARNs)
# =============================================================================
module "api_gateway" {
  source      = "./modules/api-gateway"
  name_prefix = local.name_prefix
  stage_name  = "v1"

  auth_lambda_invoke_arn               = module.lambda.auth_invoke_arn
  auth_lambda_function_name            = module.lambda.auth_function_name
  research_lambda_invoke_arn           = module.lambda.research_invoke_arn
  research_lambda_function_name        = module.lambda.research_function_name
  simulation_kickoff_lambda_invoke_arn = module.lambda.simulation_kickoff_invoke_arn
  simulation_kickoff_lambda_function_name = module.lambda.simulation_kickoff_function_name
  graph_builder_lambda_invoke_arn      = module.lambda.graph_builder_invoke_arn
  graph_builder_lambda_function_name   = module.lambda.graph_builder_function_name
  graph_reader_lambda_invoke_arn       = module.lambda.graph_reader_invoke_arn
  graph_reader_lambda_function_name    = module.lambda.graph_reader_function_name
  chat_agent_lambda_invoke_arn         = module.lambda.chat_agent_invoke_arn
  chat_agent_lambda_function_name      = module.lambda.chat_agent_function_name
}

# =============================================================================
# Secrets Manager Module (must come before lambda since lambda references ARNs)
# =============================================================================
module "secrets" {
  source      = "./modules/secrets"
  name_prefix = local.name_prefix
}

# =============================================================================
# Lambda Module
# =============================================================================
module "lambda" {
  source      = "./modules/lambda"
  name_prefix = local.name_prefix

  # DynamoDB table names
  users_table_name       = module.dynamodb.users_table_name
  events_table_name      = module.dynamodb.events_table_name
  simulations_table_name = module.dynamodb.simulations_table_name
  rounds_table_name      = module.dynamodb.rounds_table_name
  reactions_table_name   = module.dynamodb.reactions_table_name
  graph_nodes_table_name = module.dynamodb.graph_nodes_table_name
  graph_edges_table_name = module.dynamodb.graph_edges_table_name

  # DynamoDB table ARNs
  users_table_arn       = module.dynamodb.users_table_arn
  events_table_arn      = module.dynamodb.events_table_arn
  simulations_table_arn = module.dynamodb.simulations_table_arn
  rounds_table_arn      = module.dynamodb.rounds_table_arn
  reactions_table_arn   = module.dynamodb.reactions_table_arn
  graph_nodes_table_arn = module.dynamodb.graph_nodes_table_arn
  graph_edges_table_arn = module.dynamodb.graph_edges_table_arn

  # S3
  documents_bucket_name = module.s3.documents_bucket_name
  documents_bucket_arn  = module.s3.documents_bucket_arn

  # Step Functions — use ARN pattern to avoid circular dependency
  state_machine_arn = "arn:aws:states:${var.aws_region}:${data.aws_caller_identity.current.account_id}:stateMachine:${local.name_prefix}-simulation"

  # Secrets Manager
  jwt_secret_arn     = module.secrets.jwt_secret_arn
  tavily_api_key_arn = module.secrets.tavily_api_key_arn
}

# =============================================================================
# Step Functions Module
# =============================================================================
module "step_functions" {
  source      = "./modules/step-functions"
  name_prefix = local.name_prefix

  # Lambda function ARNs
  init_simulation_function_arn    = module.lambda.init_simulation_function_arn
  dealer_agent_function_arn       = module.lambda.dealer_agent_function_arn
  write_round_function_arn        = module.lambda.write_round_function_arn
  complete_simulation_function_arn = module.lambda.complete_simulation_function_arn
}

# =============================================================================
# Bedrock & AgentCore Module
# =============================================================================
module "bedrock" {
  source      = "./modules/bedrock"
  name_prefix = local.name_prefix
  aws_region  = var.aws_region
}

# =============================================================================
# CloudFront + S3 Frontend Hosting Module
# =============================================================================
module "cloudfront" {
  source      = "./modules/cloudfront"
  name_prefix = local.name_prefix
}

data "aws_caller_identity" "current" {}
