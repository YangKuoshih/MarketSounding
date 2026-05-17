# =============================================================================
# Lambda Module — All Lambda Functions
# =============================================================================

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  runtime     = "nodejs20.x"
  handler     = "index.handler"
  memory_size = 512
  timeout     = 30
  source_file = "${path.module}/placeholder.zip"

  functions = {
    auth                = "auth"
    research            = "research"
    simulation_kickoff  = "simulation-kickoff"
    dealer_agent        = "dealer-agent"
    write_round         = "write-round"
    init_simulation     = "init-simulation"
    complete_simulation = "complete-simulation"
    graph_builder       = "graph-builder"
    graph_reader        = "graph-reader"
    chat_agent          = "chat-agent"
  }
}

# =============================================================================
# IAM — Shared Assume Role Policy
# =============================================================================

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# =============================================================================
# IAM — CloudWatch Logs Policy (shared by all Lambdas)
# =============================================================================

data "aws_iam_policy_document" "cloudwatch_logs" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }
}

# =============================================================================
# 1. Auth Lambda
# =============================================================================

resource "aws_iam_role" "auth" {
  name               = "${var.name_prefix}-lambda-auth"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "auth" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "DynamoDBUsers"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [
      var.users_table_arn,
      "${var.users_table_arn}/index/*",
    ]
  }

  dynamic "statement" {
    for_each = var.jwt_secret_arn != "" ? [1] : []
    content {
      sid       = "SecretsManagerJWT"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [var.jwt_secret_arn]
    }
  }
}

resource "aws_iam_role_policy" "auth" {
  name   = "${var.name_prefix}-lambda-auth-policy"
  role   = aws_iam_role.auth.id
  policy = data.aws_iam_policy_document.auth.json
}

resource "aws_lambda_function" "auth" {
  function_name = "${var.name_prefix}-auth"
  role          = aws_iam_role.auth.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = local.timeout
  filename      = local.source_file

  environment {
    variables = {
      USERS_TABLE_NAME = var.users_table_name
      JWT_SECRET_ARN   = var.jwt_secret_arn
    }
  }
}

# =============================================================================
# 2. Research Lambda
# =============================================================================

resource "aws_iam_role" "research" {
  name               = "${var.name_prefix}-lambda-research"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "research" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "DynamoDBEvents"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [
      var.events_table_arn,
      "${var.events_table_arn}/index/*",
    ]
  }

  dynamic "statement" {
    for_each = var.tavily_api_key_arn != "" ? [1] : []
    content {
      sid       = "SecretsManagerTavily"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [var.tavily_api_key_arn]
    }
  }

  statement {
    sid     = "BedrockInvoke"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = ["arn:aws:bedrock:${data.aws_region.current.name}::foundation-model/*"]
  }
}

resource "aws_iam_role_policy" "research" {
  name   = "${var.name_prefix}-lambda-research-policy"
  role   = aws_iam_role.research.id
  policy = data.aws_iam_policy_document.research.json
}

resource "aws_lambda_function" "research" {
  function_name = "${var.name_prefix}-research"
  role          = aws_iam_role.research.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = local.timeout
  filename      = local.source_file

  environment {
    variables = {
      EVENTS_TABLE_NAME  = var.events_table_name
      TAVILY_API_KEY_ARN = var.tavily_api_key_arn
    }
  }
}

# =============================================================================
# 3. Simulation Kickoff Lambda
# =============================================================================

resource "aws_iam_role" "simulation_kickoff" {
  name               = "${var.name_prefix}-lambda-simulation-kickoff"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "simulation_kickoff" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "DynamoDBSimulationsEvents"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.simulations_table_arn,
      "${var.simulations_table_arn}/index/*",
      var.events_table_arn,
      "${var.events_table_arn}/index/*",
    ]
  }

  dynamic "statement" {
    for_each = var.state_machine_arn != "" ? [1] : []
    content {
      sid       = "StepFunctionsStart"
      actions   = ["states:StartExecution"]
      resources = [var.state_machine_arn]
    }
  }
}

resource "aws_iam_role_policy" "simulation_kickoff" {
  name   = "${var.name_prefix}-lambda-simulation-kickoff-policy"
  role   = aws_iam_role.simulation_kickoff.id
  policy = data.aws_iam_policy_document.simulation_kickoff.json
}

resource "aws_lambda_function" "simulation_kickoff" {
  function_name = "${var.name_prefix}-simulation-kickoff"
  role          = aws_iam_role.simulation_kickoff.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = local.timeout
  filename      = local.source_file

  environment {
    variables = {
      SIMULATIONS_TABLE_NAME = var.simulations_table_name
      EVENTS_TABLE_NAME      = var.events_table_name
      STATE_MACHINE_ARN      = var.state_machine_arn
    }
  }
}

# =============================================================================
# 4. Dealer Agent Lambda
# =============================================================================

resource "aws_iam_role" "dealer_agent" {
  name               = "${var.name_prefix}-lambda-dealer-agent"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "dealer_agent" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "BedrockInvoke"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = ["arn:aws:bedrock:${data.aws_region.current.name}::foundation-model/*"]
  }

  statement {
    sid     = "DynamoDBReactions"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [
      var.reactions_table_arn,
      "${var.reactions_table_arn}/index/*",
    ]
  }

  dynamic "statement" {
    for_each = var.tavily_api_key_arn != "" ? [1] : []
    content {
      sid       = "SecretsManager"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [var.tavily_api_key_arn]
    }
  }
}

resource "aws_iam_role_policy" "dealer_agent" {
  name   = "${var.name_prefix}-lambda-dealer-agent-policy"
  role   = aws_iam_role.dealer_agent.id
  policy = data.aws_iam_policy_document.dealer_agent.json
}

resource "aws_lambda_function" "dealer_agent" {
  function_name = "${var.name_prefix}-dealer-agent"
  role          = aws_iam_role.dealer_agent.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = 60 # dealer-agent gets 60s timeout
  filename      = local.source_file

  environment {
    variables = {
      REACTIONS_TABLE_NAME = var.reactions_table_name
    }
  }
}

# =============================================================================
# 5. Write Round Lambda
# =============================================================================

resource "aws_iam_role" "write_round" {
  name               = "${var.name_prefix}-lambda-write-round"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "write_round" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "DynamoDBRoundsReactions"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:BatchWriteItem",
    ]
    resources = [
      var.rounds_table_arn,
      "${var.rounds_table_arn}/index/*",
      var.reactions_table_arn,
      "${var.reactions_table_arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "write_round" {
  name   = "${var.name_prefix}-lambda-write-round-policy"
  role   = aws_iam_role.write_round.id
  policy = data.aws_iam_policy_document.write_round.json
}

resource "aws_lambda_function" "write_round" {
  function_name = "${var.name_prefix}-write-round"
  role          = aws_iam_role.write_round.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = local.timeout
  filename      = local.source_file

  environment {
    variables = {
      ROUNDS_TABLE_NAME    = var.rounds_table_name
      REACTIONS_TABLE_NAME = var.reactions_table_name
    }
  }
}

# =============================================================================
# 6. Init Simulation Lambda
# =============================================================================

resource "aws_iam_role" "init_simulation" {
  name               = "${var.name_prefix}-lambda-init-simulation"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "init_simulation" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "DynamoDBSimulations"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.simulations_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "init_simulation" {
  name   = "${var.name_prefix}-lambda-init-simulation-policy"
  role   = aws_iam_role.init_simulation.id
  policy = data.aws_iam_policy_document.init_simulation.json
}

resource "aws_lambda_function" "init_simulation" {
  function_name = "${var.name_prefix}-init-simulation"
  role          = aws_iam_role.init_simulation.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = local.timeout
  filename      = local.source_file

  environment {
    variables = {
      SIMULATIONS_TABLE_NAME = var.simulations_table_name
    }
  }
}

# =============================================================================
# 7. Complete Simulation Lambda
# =============================================================================

resource "aws_iam_role" "complete_simulation" {
  name               = "${var.name_prefix}-lambda-complete-simulation"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "complete_simulation" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "DynamoDBSimulations"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.simulations_table_arn,
    ]
  }

  statement {
    sid     = "S3PutTranscript"
    actions = [
      "s3:PutObject",
    ]
    resources = [
      "${var.documents_bucket_arn}/*",
    ]
  }

  statement {
    sid     = "LambdaInvokeGraphBuilder"
    actions = ["lambda:InvokeFunction"]
    resources = [
      "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${var.name_prefix}-graph-builder",
    ]
  }
}

resource "aws_iam_role_policy" "complete_simulation" {
  name   = "${var.name_prefix}-lambda-complete-simulation-policy"
  role   = aws_iam_role.complete_simulation.id
  policy = data.aws_iam_policy_document.complete_simulation.json
}

resource "aws_lambda_function" "complete_simulation" {
  function_name = "${var.name_prefix}-complete-simulation"
  role          = aws_iam_role.complete_simulation.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = local.timeout
  filename      = local.source_file

  environment {
    variables = {
      SIMULATIONS_TABLE_NAME  = var.simulations_table_name
      DOCUMENTS_BUCKET_NAME   = var.documents_bucket_name
      GRAPH_BUILDER_FUNC_NAME = "${var.name_prefix}-graph-builder"
    }
  }
}

# =============================================================================
# 8. Graph Builder Lambda
# =============================================================================

resource "aws_iam_role" "graph_builder" {
  name               = "${var.name_prefix}-lambda-graph-builder"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "graph_builder" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "DynamoDBGraphAndReactions"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:BatchWriteItem",
    ]
    resources = [
      var.graph_nodes_table_arn,
      "${var.graph_nodes_table_arn}/index/*",
      var.graph_edges_table_arn,
      "${var.graph_edges_table_arn}/index/*",
      var.reactions_table_arn,
      "${var.reactions_table_arn}/index/*",
    ]
  }

  statement {
    sid     = "S3PutGraphCache"
    actions = [
      "s3:PutObject",
    ]
    resources = [
      "${var.documents_bucket_arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "graph_builder" {
  name   = "${var.name_prefix}-lambda-graph-builder-policy"
  role   = aws_iam_role.graph_builder.id
  policy = data.aws_iam_policy_document.graph_builder.json
}

resource "aws_lambda_function" "graph_builder" {
  function_name = "${var.name_prefix}-graph-builder"
  role          = aws_iam_role.graph_builder.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = local.timeout
  filename      = local.source_file

  environment {
    variables = {
      GRAPH_NODES_TABLE_NAME = var.graph_nodes_table_name
      GRAPH_EDGES_TABLE_NAME = var.graph_edges_table_name
      REACTIONS_TABLE_NAME   = var.reactions_table_name
      DOCUMENTS_BUCKET_NAME  = var.documents_bucket_name
    }
  }
}

# =============================================================================
# 9. Graph Reader Lambda (GET /graph/subgraph and GET /graph/nodes/{id})
# =============================================================================

resource "aws_iam_role" "graph_reader" {
  name               = "${var.name_prefix}-lambda-graph-reader"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "graph_reader" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "DynamoDBGraphRead"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [
      var.graph_nodes_table_arn,
      "${var.graph_nodes_table_arn}/index/*",
      var.graph_edges_table_arn,
      "${var.graph_edges_table_arn}/index/*",
    ]
  }

  statement {
    sid     = "S3GetGraphCache"
    actions = [
      "s3:GetObject",
    ]
    resources = [
      "${var.documents_bucket_arn}/*",
    ]
  }

  dynamic "statement" {
    for_each = var.jwt_secret_arn != "" ? [1] : []
    content {
      sid       = "SecretsManagerJWT"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [var.jwt_secret_arn]
    }
  }
}

resource "aws_iam_role_policy" "graph_reader" {
  name   = "${var.name_prefix}-lambda-graph-reader-policy"
  role   = aws_iam_role.graph_reader.id
  policy = data.aws_iam_policy_document.graph_reader.json
}

resource "aws_lambda_function" "graph_reader" {
  function_name = "${var.name_prefix}-graph-reader"
  role          = aws_iam_role.graph_reader.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = local.timeout
  filename      = local.source_file

  environment {
    variables = {
      GRAPH_NODES_TABLE_NAME = var.graph_nodes_table_name
      GRAPH_EDGES_TABLE_NAME = var.graph_edges_table_name
      DOCUMENTS_BUCKET_NAME  = var.documents_bucket_name
      JWT_SECRET_ARN         = var.jwt_secret_arn
    }
  }
}

# =============================================================================
# 10. Chat Agent Lambda (POST /chat/{personaId})
# =============================================================================

resource "aws_iam_role" "chat_agent" {
  name               = "${var.name_prefix}-lambda-chat-agent"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "chat_agent" {
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    sid     = "BedrockInvoke"
    actions = [
      "bedrock:InvokeModel",
    ]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = var.jwt_secret_arn != "" ? [1] : []
    content {
      sid       = "SecretsManagerJWT"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [var.jwt_secret_arn]
    }
  }
}

resource "aws_iam_role_policy" "chat_agent" {
  name   = "${var.name_prefix}-lambda-chat-agent-policy"
  role   = aws_iam_role.chat_agent.id
  policy = data.aws_iam_policy_document.chat_agent.json
}

resource "aws_lambda_function" "chat_agent" {
  function_name = "${var.name_prefix}-chat-agent"
  role          = aws_iam_role.chat_agent.arn
  handler       = local.handler
  runtime       = local.runtime
  memory_size   = local.memory_size
  timeout       = 30
  filename      = local.source_file

  environment {
    variables = {
      JWT_SECRET_ARN         = var.jwt_secret_arn
      BEDROCK_OPUS_MODEL_ID  = "anthropic.claude-opus-4-7"
      BEDROCK_HAIKU_MODEL_ID = "anthropic.claude-haiku-4-5"
    }
  }
}
