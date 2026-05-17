# =============================================================================
# Secrets Manager Module
#
# Creates secrets for sensitive values used by Lambda functions:
#   - JWT signing secret (auto-generated)
#   - Tavily API key (placeholder; populated via AWS console or CLI)
# =============================================================================

# -----------------------------------------------------------------------------
# JWT Signing Secret (auto-generated)
# -----------------------------------------------------------------------------

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.name_prefix}/jwt-secret"
  description = "HS256 signing secret for JWT tokens"

  recovery_window_in_days = 0 # Immediate deletion for dev/test
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# -----------------------------------------------------------------------------
# Tavily API Key (placeholder — populate manually post-deploy)
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "tavily_api_key" {
  name        = "${var.name_prefix}/tavily-api-key"
  description = "Tavily web search API key (populate via console post-deploy)"

  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "tavily_api_key_placeholder" {
  secret_id     = aws_secretsmanager_secret.tavily_api_key.id
  secret_string = "PLACEHOLDER_REPLACE_VIA_CONSOLE"

  # Allow manual updates via console without Terraform reconciling
  lifecycle {
    ignore_changes = [secret_string]
  }
}
