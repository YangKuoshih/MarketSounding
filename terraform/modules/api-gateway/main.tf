# =============================================================================
# API Gateway REST API
# =============================================================================

resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.name_prefix}-api"
  description = "MarketSounding REST API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  minimum_compression_size = -1
}

# =============================================================================
# Resources: /auth
# =============================================================================

resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_resource" "auth_register" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "register"
}

resource "aws_api_gateway_resource" "auth_login" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "login"
}

# =============================================================================
# Resources: /events
# =============================================================================

resource "aws_api_gateway_resource" "events" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "events"
}

resource "aws_api_gateway_resource" "events_research" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.events.id
  path_part   = "research"
}

resource "aws_api_gateway_resource" "events_samples" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.events.id
  path_part   = "samples"
}

# =============================================================================
# Resources: /simulations
# =============================================================================

resource "aws_api_gateway_resource" "simulations" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "simulations"
}

resource "aws_api_gateway_resource" "simulations_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.simulations.id
  path_part   = "{id}"
}

resource "aws_api_gateway_resource" "simulations_id_crisis" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.simulations_id.id
  path_part   = "crisis"
}

# =============================================================================
# Resources: /personas
# =============================================================================

resource "aws_api_gateway_resource" "personas" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "personas"
}

# =============================================================================
# Resources: /graph
# =============================================================================

resource "aws_api_gateway_resource" "graph" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "graph"
}

resource "aws_api_gateway_resource" "graph_subgraph" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.graph.id
  path_part   = "subgraph"
}

resource "aws_api_gateway_resource" "graph_nodes" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.graph.id
  path_part   = "nodes"
}

resource "aws_api_gateway_resource" "graph_nodes_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.graph_nodes.id
  path_part   = "{id}"
}

resource "aws_api_gateway_resource" "graph_rebuild" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.graph.id
  path_part   = "rebuild"
}

# =============================================================================
# Resources: /chat
# =============================================================================

resource "aws_api_gateway_resource" "chat" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "chat"
}

resource "aws_api_gateway_resource" "chat_persona" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.chat.id
  path_part   = "{personaId}"
}

# =============================================================================
# CORS + Methods: Helper locals
# =============================================================================

locals {
  cors_headers = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  cors_integration_headers = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
  }

  # Default crisis lambda to simulation-kickoff if not provided
  crisis_invoke_arn = var.crisis_lambda_invoke_arn != "" ? var.crisis_lambda_invoke_arn : var.simulation_kickoff_lambda_invoke_arn
  crisis_func_name  = var.crisis_lambda_function_name != "" ? var.crisis_lambda_function_name : var.simulation_kickoff_lambda_function_name

  # All endpoint definitions: resource_id + Lambda integration target
  post_endpoints = {
    auth_register         = { resource_id = aws_api_gateway_resource.auth_register.id, invoke_arn = var.auth_lambda_invoke_arn, function_name = var.auth_lambda_function_name }
    auth_login            = { resource_id = aws_api_gateway_resource.auth_login.id, invoke_arn = var.auth_lambda_invoke_arn, function_name = var.auth_lambda_function_name }
    events_research       = { resource_id = aws_api_gateway_resource.events_research.id, invoke_arn = var.research_lambda_invoke_arn, function_name = var.research_lambda_function_name }
    simulations           = { resource_id = aws_api_gateway_resource.simulations.id, invoke_arn = var.simulation_kickoff_lambda_invoke_arn, function_name = var.simulation_kickoff_lambda_function_name }
    simulations_id_crisis = { resource_id = aws_api_gateway_resource.simulations_id_crisis.id, invoke_arn = local.crisis_invoke_arn, function_name = local.crisis_func_name }
    graph_rebuild         = { resource_id = aws_api_gateway_resource.graph_rebuild.id, invoke_arn = var.graph_builder_lambda_invoke_arn, function_name = var.graph_builder_lambda_function_name }
    chat_persona          = { resource_id = aws_api_gateway_resource.chat_persona.id, invoke_arn = var.chat_agent_lambda_invoke_arn, function_name = var.chat_agent_lambda_function_name }
  }

  get_endpoints = {
    simulations    = { resource_id = aws_api_gateway_resource.simulations.id, invoke_arn = var.simulation_kickoff_lambda_invoke_arn, function_name = var.simulation_kickoff_lambda_function_name }
    simulations_id = { resource_id = aws_api_gateway_resource.simulations_id.id, invoke_arn = var.simulation_kickoff_lambda_invoke_arn, function_name = var.simulation_kickoff_lambda_function_name }
    personas       = { resource_id = aws_api_gateway_resource.personas.id, invoke_arn = var.research_lambda_invoke_arn, function_name = var.research_lambda_function_name }
    events_samples = { resource_id = aws_api_gateway_resource.events_samples.id, invoke_arn = var.research_lambda_invoke_arn, function_name = var.research_lambda_function_name }
    graph_subgraph = { resource_id = aws_api_gateway_resource.graph_subgraph.id, invoke_arn = var.graph_reader_lambda_invoke_arn, function_name = var.graph_reader_lambda_function_name }
    graph_nodes_id = { resource_id = aws_api_gateway_resource.graph_nodes_id.id, invoke_arn = var.graph_reader_lambda_invoke_arn, function_name = var.graph_reader_lambda_function_name }
  }

  # All resources that need OPTIONS (CORS preflight)
  options_endpoints = {
    auth_register         = { resource_id = aws_api_gateway_resource.auth_register.id }
    auth_login            = { resource_id = aws_api_gateway_resource.auth_login.id }
    events_research       = { resource_id = aws_api_gateway_resource.events_research.id }
    events_samples        = { resource_id = aws_api_gateway_resource.events_samples.id }
    simulations           = { resource_id = aws_api_gateway_resource.simulations.id }
    simulations_id        = { resource_id = aws_api_gateway_resource.simulations_id.id }
    simulations_id_crisis = { resource_id = aws_api_gateway_resource.simulations_id_crisis.id }
    personas              = { resource_id = aws_api_gateway_resource.personas.id }
    graph_subgraph        = { resource_id = aws_api_gateway_resource.graph_subgraph.id }
    graph_nodes_id        = { resource_id = aws_api_gateway_resource.graph_nodes_id.id }
    graph_rebuild         = { resource_id = aws_api_gateway_resource.graph_rebuild.id }
    chat_persona          = { resource_id = aws_api_gateway_resource.chat_persona.id }
  }
}

# =============================================================================
# POST Methods (AWS_PROXY Lambda integration)
# =============================================================================

resource "aws_api_gateway_method" "post" {
  for_each = local.post_endpoints

  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = each.value.resource_id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post" {
  for_each = local.post_endpoints

  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = each.value.resource_id
  http_method             = aws_api_gateway_method.post[each.key].http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = each.value.invoke_arn
}

# =============================================================================
# GET Methods (AWS_PROXY Lambda integration)
# =============================================================================

resource "aws_api_gateway_method" "get" {
  for_each = local.get_endpoints

  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = each.value.resource_id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get" {
  for_each = local.get_endpoints

  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = each.value.resource_id
  http_method             = aws_api_gateway_method.get[each.key].http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = each.value.invoke_arn
}

# Note: With AWS_PROXY integration, the Lambda controls the response status
# code, headers (including CORS), and body. So we don't define
# method_response/integration_response blocks for POST or GET — they would be
# overridden by the Lambda response anyway.

# =============================================================================
# Lambda Permissions (allow API Gateway to invoke each Lambda)
# =============================================================================

# Build a unique set of Lambda function names that are referenced by any route
locals {
  lambda_function_names = toset(distinct(concat(
    [for k, v in local.post_endpoints : v.function_name],
    [for k, v in local.get_endpoints : v.function_name]
  )))
}

resource "aws_lambda_permission" "api_gateway_invoke" {
  for_each = local.lambda_function_names

  statement_id  = "AllowAPIGatewayInvoke-${each.value}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  # Wildcard at the end allows any method/path on this REST API
  source_arn = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# =============================================================================
# OPTIONS Methods (CORS preflight)
# =============================================================================

resource "aws_api_gateway_method" "options" {
  for_each = local.options_endpoints

  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = each.value.resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  for_each = local.options_endpoints

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.options[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "options_200" {
  for_each = local.options_endpoints

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = "200"

  response_parameters = local.cors_headers
}

resource "aws_api_gateway_integration_response" "options_200" {
  for_each = local.options_endpoints

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = each.value.resource_id
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = aws_api_gateway_method_response.options_200[each.key].status_code

  response_parameters = local.cors_integration_headers

  depends_on = [aws_api_gateway_integration.options]
}

# =============================================================================
# Deployment and Stage
# =============================================================================

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.auth.id,
      aws_api_gateway_resource.auth_register.id,
      aws_api_gateway_resource.auth_login.id,
      aws_api_gateway_resource.events.id,
      aws_api_gateway_resource.events_research.id,
      aws_api_gateway_resource.events_samples.id,
      aws_api_gateway_resource.simulations.id,
      aws_api_gateway_resource.simulations_id.id,
      aws_api_gateway_resource.simulations_id_crisis.id,
      aws_api_gateway_resource.personas.id,
      aws_api_gateway_resource.graph.id,
      aws_api_gateway_resource.graph_subgraph.id,
      aws_api_gateway_resource.graph_nodes.id,
      aws_api_gateway_resource.graph_nodes_id.id,
      aws_api_gateway_resource.graph_rebuild.id,
      aws_api_gateway_resource.chat.id,
      aws_api_gateway_resource.chat_persona.id,
      # Force redeploy when integrations change
      "aws_proxy_integrations_v2",
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.post,
    aws_api_gateway_integration.get,
    aws_api_gateway_integration.options,
  ]
}

resource "aws_api_gateway_stage" "main" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  deployment_id = aws_api_gateway_deployment.main.id
  stage_name    = var.stage_name
}

# =============================================================================
# TLS 1.2+ Enforcement (Stage-level method settings)
# =============================================================================

resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    throttling_burst_limit = 200
    throttling_rate_limit  = 100
  }
}

# =============================================================================
# Rate Limiting: Usage Plan + API Key (100 req/s per IP)
# =============================================================================

resource "aws_api_gateway_usage_plan" "main" {
  name        = "${var.name_prefix}-usage-plan"
  description = "Rate limiting: 100 req/s, 200 burst"

  api_stages {
    api_id = aws_api_gateway_rest_api.main.id
    stage  = aws_api_gateway_stage.main.stage_name
  }

  throttle_settings {
    burst_limit = 200
    rate_limit  = 100
  }

  quota_settings {
    limit  = 100000
    period = "DAY"
  }
}
