# =============================================================================
# Bedrock & AgentCore Module
# =============================================================================
#
# This module documents the required Amazon Bedrock model access and AWS Bedrock
# AgentCore configuration for the MarketSounding dealer simulation system.
#
# IMPORTANT: Bedrock model access is enabled via the AWS Console, not Terraform.
# Navigate to: Amazon Bedrock → Model Access → Request Access for the models below.
#
# AgentCore is a preview service with limited Terraform support. The configuration
# below documents the intended agent setup for SDK-based provisioning.
#
# =============================================================================

# -----------------------------------------------------------------------------
# Model Configuration (Constants)
# -----------------------------------------------------------------------------
# Required models — enable access via AWS Console → Bedrock → Model Access:
#
#   1. Claude Opus 4.7 (anthropic.claude-opus-4-7)
#      - Purpose: Primary reasoning for dealer persona reactions
#      - Used by: Dealer Agent Lambda, Research Agent (event synthesis)
#      - Estimated tokens per simulation: ~50K input + ~10K output per round
#
#   2. Claude Haiku 4.5 (us.anthropic.claude-haiku-4-5-20251001-v1:0)
#      - Purpose: Utility tasks (search query generation, summarization, chat)
#      - Used by: Research Agent (query generation), Chat Agent
#      - Estimated tokens per call: ~2K input + ~500 output
#
# -----------------------------------------------------------------------------

locals {
  # Bedrock model identifiers
  opus_model_id  = "anthropic.claude-opus-4-7"
  haiku_model_id = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

  # Dealer persona IDs matching AgentCore agent definitions
  dealer_persona_ids = ["gs", "jpm", "ms", "citi", "bofa"]

  # AgentCore agent configuration (for SDK-based provisioning)
  # Each dealer persona maps to an AgentCore agent with session memory
  dealer_agents = {
    gs = {
      name        = "${var.name_prefix}-dealer-gs"
      description = "Goldman Sachs dealer persona — macro-focused, data-driven"
      persona     = "Goldman Sachs Global Markets"
      bias        = "Slightly hawkish, quantitative, rates-focused"
    }
    jpm = {
      name        = "${var.name_prefix}-dealer-jpm"
      description = "JP Morgan dealer persona — balanced, research-heavy"
      persona     = "JP Morgan Markets"
      bias        = "Centrist, cross-asset, emphasizes forward guidance"
    }
    ms = {
      name        = "${var.name_prefix}-dealer-ms"
      description = "Morgan Stanley dealer persona — contrarian, risk-aware"
      persona     = "Morgan Stanley Institutional"
      bias        = "Slightly dovish, risk-asset focused, contrarian"
    }
    citi = {
      name        = "${var.name_prefix}-dealer-citi"
      description = "Citi dealer persona — global macro, EM-sensitive"
      persona     = "Citi Global Markets"
      bias        = "Global macro lens, EM spillover focus, moderate"
    }
    bofa = {
      name        = "${var.name_prefix}-dealer-bofa"
      description = "Bank of America dealer persona — credit-focused, conservative"
      persona     = "BofA Securities"
      bias        = "Hawkish, credit-spread focused, conservative"
    }
  }
}

# -----------------------------------------------------------------------------
# AgentCore Configuration (Documentation)
# -----------------------------------------------------------------------------
#
# AgentCore agents are provisioned via the AWS SDK (Bedrock AgentCore API) or
# the AWS Console. The following documents the intended configuration:
#
# AGENT DEFINITIONS (5 dealer personas):
# ─────────────────────────────────────────────────────────────────────────────
# Each agent is configured with:
#   - agentName:        {name_prefix}-dealer-{persona_id}
#   - foundationModel:  anthropic.claude-opus-4-7
#   - instruction:      Persona-specific system prompt (loaded from persona profiles)
#   - memoryConfig:     Session memory enabled for multi-round state tracking
#
# MEMORY CONFIGURATION (per-dealer session state):
# ─────────────────────────────────────────────────────────────────────────────
# AgentCore Memory provides per-dealer session state across simulation rounds:
#   - sessionId format: {simulation_id}_{persona_id}
#   - Stores: prior round reactions, position history, influence tracking
#   - TTL: 24 hours (simulations complete within minutes)
#   - Backend: DynamoDB (managed by AgentCore)
#
# MANUAL SETUP STEPS:
# ─────────────────────────────────────────────────────────────────────────────
# 1. Enable model access in AWS Console:
#    - Navigate to Amazon Bedrock → Model Access
#    - Request access for: anthropic.claude-opus-4-7
#    - Request access for: anthropic.claude-3-5-haiku-20241022
#    - Wait for access to be granted (usually immediate for on-demand)
#
# 2. Create AgentCore agents (via SDK or Console):
#    - For each persona in dealer_agents local:
#      a. Create agent with name, description, and foundation model
#      b. Configure session memory with enableMemory: true
#      c. Set idle session TTL to 24 hours
#      d. Store agent ID in SSM Parameter Store for Lambda reference
#
# 3. Configure Lambda environment variables:
#    - BEDROCK_OPUS_MODEL_ID  = anthropic.claude-opus-4-7
#    - BEDROCK_HAIKU_MODEL_ID = us.anthropic.claude-haiku-4-5-20251001-v1:0
#    - AGENTCORE_AGENT_PREFIX = {name_prefix}-dealer-
#
# 4. Verify IAM permissions:
#    - Lambda execution roles need: bedrock:InvokeModel (already configured)
#    - For AgentCore: bedrock:InvokeAgent, bedrock:GetAgentMemory,
#      bedrock:UpdateAgentMemory
#
# =============================================================================

# -----------------------------------------------------------------------------
# SSM Parameters — Store model IDs for Lambda runtime reference
# -----------------------------------------------------------------------------
# These parameters allow Lambda functions to discover model IDs without
# hardcoding them in application code.

resource "aws_ssm_parameter" "opus_model_id" {
  name        = "/${var.name_prefix}/bedrock/opus-model-id"
  description = "Bedrock model ID for Claude Opus 4.7"
  type        = "String"
  value       = local.opus_model_id

  tags = {
    Component = "bedrock"
  }
}

resource "aws_ssm_parameter" "haiku_model_id" {
  name        = "/${var.name_prefix}/bedrock/haiku-model-id"
  description = "Bedrock model ID for Claude 3.5 Haiku"
  type        = "String"
  value       = local.haiku_model_id

  tags = {
    Component = "bedrock"
  }
}

resource "aws_ssm_parameter" "dealer_persona_ids" {
  name        = "/${var.name_prefix}/agentcore/dealer-persona-ids"
  description = "Comma-separated list of dealer persona IDs"
  type        = "StringList"
  value       = join(",", local.dealer_persona_ids)

  tags = {
    Component = "agentcore"
  }
}
