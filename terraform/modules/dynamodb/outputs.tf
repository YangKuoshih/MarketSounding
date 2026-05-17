# =============================================================================
# DynamoDB Module Outputs
# =============================================================================

# Table Names
output "users_table_name" {
  description = "Name of the users DynamoDB table"
  value       = aws_dynamodb_table.users.name
}

output "events_table_name" {
  description = "Name of the events DynamoDB table"
  value       = aws_dynamodb_table.events.name
}

output "simulations_table_name" {
  description = "Name of the simulations DynamoDB table"
  value       = aws_dynamodb_table.simulations.name
}

output "rounds_table_name" {
  description = "Name of the rounds DynamoDB table"
  value       = aws_dynamodb_table.rounds.name
}

output "reactions_table_name" {
  description = "Name of the reactions DynamoDB table"
  value       = aws_dynamodb_table.reactions.name
}

output "graph_nodes_table_name" {
  description = "Name of the graph_nodes DynamoDB table"
  value       = aws_dynamodb_table.graph_nodes.name
}

output "graph_edges_table_name" {
  description = "Name of the graph_edges DynamoDB table"
  value       = aws_dynamodb_table.graph_edges.name
}

# Table ARNs
output "users_table_arn" {
  description = "ARN of the users DynamoDB table"
  value       = aws_dynamodb_table.users.arn
}

output "events_table_arn" {
  description = "ARN of the events DynamoDB table"
  value       = aws_dynamodb_table.events.arn
}

output "simulations_table_arn" {
  description = "ARN of the simulations DynamoDB table"
  value       = aws_dynamodb_table.simulations.arn
}

output "rounds_table_arn" {
  description = "ARN of the rounds DynamoDB table"
  value       = aws_dynamodb_table.rounds.arn
}

output "reactions_table_arn" {
  description = "ARN of the reactions DynamoDB table"
  value       = aws_dynamodb_table.reactions.arn
}

output "graph_nodes_table_arn" {
  description = "ARN of the graph_nodes DynamoDB table"
  value       = aws_dynamodb_table.graph_nodes.arn
}

output "graph_edges_table_arn" {
  description = "ARN of the graph_edges DynamoDB table"
  value       = aws_dynamodb_table.graph_edges.arn
}
