# =============================================================================
# Step Functions Module Outputs
# =============================================================================

output "state_machine_arn" {
  description = "ARN of the simulation Step Functions state machine"
  value       = aws_sfn_state_machine.simulation.arn
}

output "state_machine_name" {
  description = "Name of the simulation Step Functions state machine"
  value       = aws_sfn_state_machine.simulation.name
}
