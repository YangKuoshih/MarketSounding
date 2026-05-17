# =============================================================================
# DynamoDB Tables for MarketSounding
# =============================================================================

# -----------------------------------------------------------------------------
# Users Table
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "users" {
  name         = "${var.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

# -----------------------------------------------------------------------------
# Events Table
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "events" {
  name         = "${var.name_prefix}-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "eventId"

  attribute {
    name = "eventId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-createdAt-index"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

# -----------------------------------------------------------------------------
# Simulations Table
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "simulations" {
  name         = "${var.name_prefix}-simulations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "simulationId"

  attribute {
    name = "simulationId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-createdAt-index"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "KEYS_ONLY"
  }

  server_side_encryption {
    enabled = true
  }
}

# -----------------------------------------------------------------------------
# Rounds Table
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "rounds" {
  name         = "${var.name_prefix}-rounds"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "simulationId"
  range_key    = "roundNumber"

  attribute {
    name = "simulationId"
    type = "S"
  }

  attribute {
    name = "roundNumber"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}

# -----------------------------------------------------------------------------
# Reactions Table
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "reactions" {
  name         = "${var.name_prefix}-reactions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "personaId"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "personaId"
    type = "S"
  }

  attribute {
    name = "simulationId"
    type = "S"
  }

  attribute {
    name = "roundNumber"
    type = "N"
  }

  global_secondary_index {
    name            = "simulationId-index"
    hash_key        = "simulationId"
    range_key       = "roundNumber"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

# -----------------------------------------------------------------------------
# Graph Nodes Table
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "graph_nodes" {
  name         = "${var.name_prefix}-graph-nodes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "nodeId"

  attribute {
    name = "nodeId"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}

# -----------------------------------------------------------------------------
# Graph Edges Table
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "graph_edges" {
  name         = "${var.name_prefix}-graph-edges"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sourceNodeId"
  range_key    = "sk"

  attribute {
    name = "sourceNodeId"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "simulationId"
    type = "S"
  }

  attribute {
    name = "edgeType"
    type = "S"
  }

  global_secondary_index {
    name            = "simulationId-index"
    hash_key        = "simulationId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "edgeType-index"
    hash_key        = "edgeType"
    projection_type = "KEYS_ONLY"
  }

  server_side_encryption {
    enabled = true
  }
}
