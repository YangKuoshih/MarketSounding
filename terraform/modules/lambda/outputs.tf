# =============================================================================
# Lambda Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Auth Lambda
# -----------------------------------------------------------------------------

output "auth_function_name" {
  description = "Name of the auth Lambda function"
  value       = aws_lambda_function.auth.function_name
}

output "auth_function_arn" {
  description = "ARN of the auth Lambda function"
  value       = aws_lambda_function.auth.arn
}

output "auth_invoke_arn" {
  description = "Invoke ARN of the auth Lambda function"
  value       = aws_lambda_function.auth.invoke_arn
}

# -----------------------------------------------------------------------------
# Research Lambda
# -----------------------------------------------------------------------------

output "research_function_name" {
  description = "Name of the research Lambda function"
  value       = aws_lambda_function.research.function_name
}

output "research_function_arn" {
  description = "ARN of the research Lambda function"
  value       = aws_lambda_function.research.arn
}

output "research_invoke_arn" {
  description = "Invoke ARN of the research Lambda function"
  value       = aws_lambda_function.research.invoke_arn
}

# -----------------------------------------------------------------------------
# Simulation Kickoff Lambda
# -----------------------------------------------------------------------------

output "simulation_kickoff_function_name" {
  description = "Name of the simulation-kickoff Lambda function"
  value       = aws_lambda_function.simulation_kickoff.function_name
}

output "simulation_kickoff_function_arn" {
  description = "ARN of the simulation-kickoff Lambda function"
  value       = aws_lambda_function.simulation_kickoff.arn
}

output "simulation_kickoff_invoke_arn" {
  description = "Invoke ARN of the simulation-kickoff Lambda function"
  value       = aws_lambda_function.simulation_kickoff.invoke_arn
}

# -----------------------------------------------------------------------------
# Dealer Agent Lambda
# -----------------------------------------------------------------------------

output "dealer_agent_function_name" {
  description = "Name of the dealer-agent Lambda function"
  value       = aws_lambda_function.dealer_agent.function_name
}

output "dealer_agent_function_arn" {
  description = "ARN of the dealer-agent Lambda function"
  value       = aws_lambda_function.dealer_agent.arn
}

output "dealer_agent_invoke_arn" {
  description = "Invoke ARN of the dealer-agent Lambda function"
  value       = aws_lambda_function.dealer_agent.invoke_arn
}

# -----------------------------------------------------------------------------
# Write Round Lambda
# -----------------------------------------------------------------------------

output "write_round_function_name" {
  description = "Name of the write-round Lambda function"
  value       = aws_lambda_function.write_round.function_name
}

output "write_round_function_arn" {
  description = "ARN of the write-round Lambda function"
  value       = aws_lambda_function.write_round.arn
}

output "write_round_invoke_arn" {
  description = "Invoke ARN of the write-round Lambda function"
  value       = aws_lambda_function.write_round.invoke_arn
}

# -----------------------------------------------------------------------------
# Init Simulation Lambda
# -----------------------------------------------------------------------------

output "init_simulation_function_name" {
  description = "Name of the init-simulation Lambda function"
  value       = aws_lambda_function.init_simulation.function_name
}

output "init_simulation_function_arn" {
  description = "ARN of the init-simulation Lambda function"
  value       = aws_lambda_function.init_simulation.arn
}

output "init_simulation_invoke_arn" {
  description = "Invoke ARN of the init-simulation Lambda function"
  value       = aws_lambda_function.init_simulation.invoke_arn
}

# -----------------------------------------------------------------------------
# Complete Simulation Lambda
# -----------------------------------------------------------------------------

output "complete_simulation_function_name" {
  description = "Name of the complete-simulation Lambda function"
  value       = aws_lambda_function.complete_simulation.function_name
}

output "complete_simulation_function_arn" {
  description = "ARN of the complete-simulation Lambda function"
  value       = aws_lambda_function.complete_simulation.arn
}

output "complete_simulation_invoke_arn" {
  description = "Invoke ARN of the complete-simulation Lambda function"
  value       = aws_lambda_function.complete_simulation.invoke_arn
}

# -----------------------------------------------------------------------------
# Graph Builder Lambda
# -----------------------------------------------------------------------------

output "graph_builder_function_name" {
  description = "Name of the graph-builder Lambda function"
  value       = aws_lambda_function.graph_builder.function_name
}

output "graph_builder_function_arn" {
  description = "ARN of the graph-builder Lambda function"
  value       = aws_lambda_function.graph_builder.arn
}

output "graph_builder_invoke_arn" {
  description = "Invoke ARN of the graph-builder Lambda function"
  value       = aws_lambda_function.graph_builder.invoke_arn
}

# -----------------------------------------------------------------------------
# Graph Reader Lambda
# -----------------------------------------------------------------------------

output "graph_reader_function_name" {
  description = "Name of the graph-reader Lambda function"
  value       = aws_lambda_function.graph_reader.function_name
}

output "graph_reader_function_arn" {
  description = "ARN of the graph-reader Lambda function"
  value       = aws_lambda_function.graph_reader.arn
}

output "graph_reader_invoke_arn" {
  description = "Invoke ARN of the graph-reader Lambda function"
  value       = aws_lambda_function.graph_reader.invoke_arn
}

# -----------------------------------------------------------------------------
# Chat Agent Lambda
# -----------------------------------------------------------------------------

output "chat_agent_function_name" {
  description = "Name of the chat-agent Lambda function"
  value       = aws_lambda_function.chat_agent.function_name
}

output "chat_agent_function_arn" {
  description = "ARN of the chat-agent Lambda function"
  value       = aws_lambda_function.chat_agent.arn
}

output "chat_agent_invoke_arn" {
  description = "Invoke ARN of the chat-agent Lambda function"
  value       = aws_lambda_function.chat_agent.invoke_arn
}
