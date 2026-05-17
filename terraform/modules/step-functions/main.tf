# =============================================================================
# Step Functions Module — Multi-Round Simulation State Machine
# =============================================================================

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# -----------------------------------------------------------------------------
# IAM Role for Step Functions
# -----------------------------------------------------------------------------

resource "aws_iam_role" "step_functions" {
  name = "${var.name_prefix}-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "step_functions_lambda_invoke" {
  name = "${var.name_prefix}-sfn-lambda-invoke"
  role = aws_iam_role.step_functions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          var.init_simulation_function_arn,
          var.dealer_agent_function_arn,
          var.write_round_function_arn,
          var.complete_simulation_function_arn
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# State Machine Definition
# -----------------------------------------------------------------------------

resource "aws_sfn_state_machine" "simulation" {
  name     = "${var.name_prefix}-simulation"
  role_arn = aws_iam_role.step_functions.arn

  definition = jsonencode({
    Comment = "MarketSounding multi-round dealer simulation state machine"
    StartAt = "InitializeSimulation"
    States = {

      # -----------------------------------------------------------------------
      # InitializeSimulation — invoke init-simulation Lambda
      # -----------------------------------------------------------------------
      InitializeSimulation = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = var.init_simulation_function_arn
          "Payload.$"  = "$"
        }
        ResultPath = "$.initResult"
        ResultSelector = {
          "body.$" = "$.Payload"
        }
        Retry = [
          {
            ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
            IntervalSeconds = 2
            MaxAttempts     = 3
            BackoffRate     = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "CompleteSimulation"
          }
        ]
        Next = "ExecuteRound1"
      }

      # -----------------------------------------------------------------------
      # ExecuteRound1 — Map state, invoke dealer-agent for each persona (parallel)
      # -----------------------------------------------------------------------
      ExecuteRound1 = {
        Type       = "Map"
        ItemsPath  = "$.initResult.body.personaIds"
        MaxConcurrency = 5
        Parameters = {
          "personaId.$"       = "$$.Map.Item.Value"
          "simulationId.$"    = "$.initResult.body.simulationId"
          "eventContext.$"    = "$.initResult.body.eventContext"
          "roundNumber"       = 1
          "roundType"         = "initial"
        }
        Iterator = {
          StartAt = "InvokeDealerRound1"
          States = {
            InvokeDealerRound1 = {
              Type     = "Task"
              Resource = "arn:aws:states:::lambda:invoke"
              Parameters = {
                FunctionName = var.dealer_agent_function_arn
                "Payload.$"  = "$"
              }
              ResultSelector = {
                "body.$" = "$.Payload"
              }
              Retry = [
                {
                  ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
                  IntervalSeconds = 2
                  MaxAttempts     = 2
                  BackoffRate     = 2.0
                }
              ]
              Catch = [
                {
                  ErrorEquals = ["States.ALL"]
                  ResultPath  = "$.error"
                  Next        = "DealerRound1Failed"
                }
              ]
              End = true
            }
            DealerRound1Failed = {
              Type = "Pass"
              Result = {
                status = "failed"
              }
              End = true
            }
          }
        }
        ResultPath = "$.round1Results"
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "CompleteSimulation"
          }
        ]
        Next = "WriteRound1"
      }

      # -----------------------------------------------------------------------
      # WriteRound1 — invoke write-round Lambda
      # -----------------------------------------------------------------------
      WriteRound1 = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = var.write_round_function_arn
          Payload = {
            "simulationId.$" = "$.initResult.body.simulationId"
            "roundNumber"    = 1
            "roundType"      = "initial"
            "reactions.$"    = "$.round1Results"
          }
        }
        ResultPath = "$.writeResult"
        ResultSelector = {
          "body.$" = "$.Payload"
        }
        Retry = [
          {
            ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
            IntervalSeconds = 2
            MaxAttempts     = 3
            BackoffRate     = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "CompleteSimulation"
          }
        ]
        Next = "CheckMoreRounds"
      }

      # -----------------------------------------------------------------------
      # CheckMoreRounds — Choice: if currentRound > maxRounds → Complete
      # -----------------------------------------------------------------------
      CheckMoreRounds = {
        Type = "Choice"
        Choices = [
          {
            Variable          = "$.initResult.body.currentRound"
            NumericGreaterThanPath = "$.initResult.body.config.maxRounds"
            Next              = "CompleteSimulation"
          }
        ]
        Default = "WaitForCrisisOrContinue"
      }

      # -----------------------------------------------------------------------
      # WaitForCrisisOrContinue — Choice: if enableCrisisInjection → WaitForCrisis
      # -----------------------------------------------------------------------
      WaitForCrisisOrContinue = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.initResult.body.config.enableCrisisInjection"
            BooleanEquals = true
            Next          = "WaitForCrisis"
          }
        ]
        Default = "ExecutePeerRound"
      }

      # -----------------------------------------------------------------------
      # WaitForCrisis — Task with waitForTaskToken, timeout 120s
      # On timeout → ExecutePeerRound. On success → ExecuteCrisisRound
      # -----------------------------------------------------------------------
      WaitForCrisis = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke.waitForTaskToken"
        Parameters = {
          FunctionName = var.write_round_function_arn
          Payload = {
            "simulationId.$" = "$.initResult.body.simulationId"
            "action"         = "registerTaskToken"
            "taskToken.$"    = "$$.Task.Token"
            "currentRound.$" = "$.initResult.body.currentRound"
          }
        }
        TimeoutSeconds = 120
        ResultPath     = "$.crisisEvent"
        Catch = [
          {
            ErrorEquals = ["States.Timeout"]
            ResultPath  = "$.timeoutInfo"
            Next        = "ExecutePeerRound"
          },
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "ExecutePeerRound"
          }
        ]
        Next = "ExecuteCrisisRound"
      }

      # -----------------------------------------------------------------------
      # ExecuteCrisisRound — Map state, invoke dealer-agent with crisis context
      # -----------------------------------------------------------------------
      ExecuteCrisisRound = {
        Type       = "Map"
        ItemsPath  = "$.initResult.body.personaIds"
        MaxConcurrency = 5
        Parameters = {
          "personaId.$"       = "$$.Map.Item.Value"
          "simulationId.$"    = "$.initResult.body.simulationId"
          "eventContext.$"    = "$.initResult.body.eventContext"
          "roundNumber.$"     = "$.initResult.body.currentRound"
          "roundType"         = "crisis_reevaluation"
          "crisisEvent.$"    = "$.crisisEvent"
          "peerReactions.$"  = "$.writeResult.body.reactions"
        }
        Iterator = {
          StartAt = "InvokeDealerCrisis"
          States = {
            InvokeDealerCrisis = {
              Type     = "Task"
              Resource = "arn:aws:states:::lambda:invoke"
              Parameters = {
                FunctionName = var.dealer_agent_function_arn
                "Payload.$"  = "$"
              }
              ResultSelector = {
                "body.$" = "$.Payload"
              }
              Retry = [
                {
                  ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
                  IntervalSeconds = 2
                  MaxAttempts     = 2
                  BackoffRate     = 2.0
                }
              ]
              Catch = [
                {
                  ErrorEquals = ["States.ALL"]
                  ResultPath  = "$.error"
                  Next        = "DealerCrisisFailed"
                }
              ]
              End = true
            }
            DealerCrisisFailed = {
              Type = "Pass"
              Result = {
                status = "failed"
              }
              End = true
            }
          }
        }
        ResultPath = "$.crisisRoundResults"
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "CompleteSimulation"
          }
        ]
        Next = "WriteCrisisRound"
      }

      # -----------------------------------------------------------------------
      # WriteCrisisRound — invoke write-round Lambda, then → IncrementRound
      # -----------------------------------------------------------------------
      WriteCrisisRound = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = var.write_round_function_arn
          Payload = {
            "simulationId.$" = "$.initResult.body.simulationId"
            "roundNumber.$"  = "$.initResult.body.currentRound"
            "roundType"      = "crisis_reevaluation"
            "reactions.$"    = "$.crisisRoundResults"
          }
        }
        ResultPath = "$.writeResult"
        ResultSelector = {
          "body.$" = "$.Payload"
        }
        Retry = [
          {
            ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
            IntervalSeconds = 2
            MaxAttempts     = 3
            BackoffRate     = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "CompleteSimulation"
          }
        ]
        Next = "IncrementRound"
      }

      # -----------------------------------------------------------------------
      # ExecutePeerRound — Map state, invoke dealer-agent with peer context
      # -----------------------------------------------------------------------
      ExecutePeerRound = {
        Type       = "Map"
        ItemsPath  = "$.initResult.body.personaIds"
        MaxConcurrency = 5
        Parameters = {
          "personaId.$"       = "$$.Map.Item.Value"
          "simulationId.$"    = "$.initResult.body.simulationId"
          "eventContext.$"    = "$.initResult.body.eventContext"
          "roundNumber.$"     = "$.initResult.body.currentRound"
          "roundType"         = "peer_response"
          "peerReactions.$"  = "$.writeResult.body.reactions"
        }
        Iterator = {
          StartAt = "InvokeDealerPeer"
          States = {
            InvokeDealerPeer = {
              Type     = "Task"
              Resource = "arn:aws:states:::lambda:invoke"
              Parameters = {
                FunctionName = var.dealer_agent_function_arn
                "Payload.$"  = "$"
              }
              ResultSelector = {
                "body.$" = "$.Payload"
              }
              Retry = [
                {
                  ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
                  IntervalSeconds = 2
                  MaxAttempts     = 2
                  BackoffRate     = 2.0
                }
              ]
              Catch = [
                {
                  ErrorEquals = ["States.ALL"]
                  ResultPath  = "$.error"
                  Next        = "DealerPeerFailed"
                }
              ]
              End = true
            }
            DealerPeerFailed = {
              Type = "Pass"
              Result = {
                status = "failed"
              }
              End = true
            }
          }
        }
        ResultPath = "$.peerRoundResults"
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "CompleteSimulation"
          }
        ]
        Next = "WritePeerRound"
      }

      # -----------------------------------------------------------------------
      # WritePeerRound — invoke write-round Lambda
      # -----------------------------------------------------------------------
      WritePeerRound = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = var.write_round_function_arn
          Payload = {
            "simulationId.$" = "$.initResult.body.simulationId"
            "roundNumber.$"  = "$.initResult.body.currentRound"
            "roundType"      = "peer_response"
            "reactions.$"    = "$.peerRoundResults"
          }
        }
        ResultPath = "$.writeResult"
        ResultSelector = {
          "body.$" = "$.Payload"
        }
        Retry = [
          {
            ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
            IntervalSeconds = 2
            MaxAttempts     = 3
            BackoffRate     = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "CompleteSimulation"
          }
        ]
        Next = "CheckConvergence"
      }

      # -----------------------------------------------------------------------
      # CheckConvergence — Choice: if convergenceScore < threshold → Complete
      # -----------------------------------------------------------------------
      CheckConvergence = {
        Type = "Choice"
        Choices = [
          {
            Variable             = "$.writeResult.body.convergenceScore"
            NumericLessThanPath  = "$.initResult.body.config.convergenceThreshold"
            Next                 = "CompleteSimulation"
          }
        ]
        Default = "IncrementRound"
      }

      # -----------------------------------------------------------------------
      # IncrementRound — Pass state, increment currentRound
      # -----------------------------------------------------------------------
      IncrementRound = {
        Type = "Pass"
        Parameters = {
          "initResult" = {
            "body" = {
              "simulationId.$"          = "$.initResult.body.simulationId"
              "personaIds.$"            = "$.initResult.body.personaIds"
              "eventContext.$"          = "$.initResult.body.eventContext"
              "config.$"                = "$.initResult.body.config"
              "currentRound.$"          = "States.MathAdd($.initResult.body.currentRound, 1)"
            }
          }
          "writeResult.$" = "$.writeResult"
        }
        Next = "CheckMoreRounds"
      }

      # -----------------------------------------------------------------------
      # CompleteSimulation — invoke complete-simulation Lambda
      # -----------------------------------------------------------------------
      CompleteSimulation = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = var.complete_simulation_function_arn
          Payload = {
            "simulationId.$" = "$.initResult.body.simulationId"
            "error.$"        = "$.error"
          }
        }
        ResultSelector = {
          "body.$" = "$.Payload"
        }
        Retry = [
          {
            ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
            IntervalSeconds = 2
            MaxAttempts     = 3
            BackoffRate     = 2.0
          }
        ]
        End = true
      }
    }
  })
}
