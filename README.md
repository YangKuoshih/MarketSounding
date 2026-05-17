# MarketSounding

Multi-agent market reaction simulator. Five primary dealer personas (GS, JPM, MS, Citi, BofA) react to market events through MiroFish-style multi-round roundtables, with crisis injection and convergence detection.

## Stack

- **Frontend:** Next.js 15 (static export), Tailwind CSS 4, shadcn/ui, D3.js, Motion
- **Backend:** AWS Lambda (Node.js 20), Step Functions, API Gateway REST, DynamoDB, S3, CloudFront
- **AI:** AWS Bedrock (Claude Opus 4.7 + Haiku), AgentCore Memory
- **External:** Tavily Search API
- **IaC:** Terraform

## Project Structure

```
.
├── backend/          Lambda functions, shared lib, persona profiles, sample events
├── frontend/         Next.js 15 app (static export)
├── terraform/        Infrastructure modules + environment configs
├── docs/             Sample NY Fed survey results (reference data)
└── .kiro/            Specs (requirements, design, tasks) + steering files
```

## Prerequisites

- AWS account with credentials configured (`aws configure` or AWS SSO)
- Terraform >= 1.5
- Node.js >= 20
- Tavily API key (sign up at https://tavily.com — free tier: 1000 searches/month)

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000.

### Backend (TypeScript compile check)

```bash
cd backend
npm install
npx tsc --noEmit
```

## Deployment

The full deployment is done in three stages: infrastructure → Lambda code → frontend.

### 1. Deploy Infrastructure (Terraform)

```bash
cd terraform
terraform init
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

This creates: 7 DynamoDB tables, S3 buckets (documents + frontend), CloudFront, API Gateway, 9 Lambda functions (with placeholder code), Step Functions state machine, Secrets Manager secrets, IAM roles.

After apply, capture these outputs:

```bash
terraform output api_gateway_url       # NEXT_PUBLIC_API_URL for frontend
terraform output cloudfront_url        # Public URL of the frontend
terraform output frontend_bucket_name  # S3 bucket for frontend assets
```

### 2. Populate Tavily API Key

The Tavily secret is created with a placeholder value. Set the real value:

```bash
aws secretsmanager update-secret \
  --secret-id marketsounding-dev/tavily-api-key \
  --secret-string "YOUR_TAVILY_API_KEY"
```

### 3. Build and Deploy Lambda Code

For each Lambda function, bundle the TypeScript code and update the Lambda. Example for `auth`:

```bash
cd backend
npm run build  # produces dist/
cd dist/lambdas/auth
zip -r ../../../auth.zip .
aws lambda update-function-code \
  --function-name marketsounding-dev-auth \
  --zip-file fileb://../../../auth.zip
```

Or use the helper script (see `backend/scripts/deploy-lambdas.sh` if available).

Functions to deploy: `auth`, `research`, `simulation-kickoff`, `dealer-agent`, `write-round`, `init-simulation`, `complete-simulation`, `graph-builder`, `graph-reader`.

### 4. Build and Deploy Frontend

```bash
cd frontend

# Set the API URL from Terraform output
export NEXT_PUBLIC_API_URL="https://YOUR_API_GATEWAY_URL/v1"

# Build static export
npm run build

# Sync to S3 + invalidate CloudFront
aws s3 sync out/ s3://YOUR_FRONTEND_BUCKET --delete
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### 5. Smoke Test

Visit the CloudFront URL and verify:
- Landing page loads
- Sign up + log in works
- Dashboard, agent chat, knowledge graph, history all render
- Sample events appear on the New Sounding page

## API Endpoints

All routes are served by API Gateway and require `Authorization: Bearer <jwt>` except where noted.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Log in, returns JWT |
| GET | `/events/samples` | No | List 3 pre-configured sample events |
| POST | `/events/research` | Yes | Topic → web search → synthesized event brief |
| POST | `/simulations` | Yes | Start a new simulation |
| GET | `/simulations` | Yes | List user's simulations |
| GET | `/simulations/{id}` | Yes | Get simulation with all rounds + reactions |
| POST | `/simulations/{id}/crisis` | Yes | Inject crisis event mid-simulation |
| GET | `/personas` | No | List 5 dealer personas |
| GET | `/graph/subgraph` | Yes | Full knowledge graph (cached from S3) |
| GET | `/graph/nodes/{id}` | Yes | Node detail + connected edges |
| POST | `/graph/rebuild` | Yes | Trigger full graph rebuild |

## Environment Variables

### Frontend

- `NEXT_PUBLIC_API_URL` — API Gateway base URL (e.g. `https://abc.execute-api.us-east-1.amazonaws.com/v1`)

### Backend (set via Terraform on each Lambda)

- `*_TABLE_NAME` — DynamoDB table names per Lambda
- `DOCUMENTS_BUCKET_NAME` — S3 bucket for transcripts and graph cache
- `STATE_MACHINE_ARN` — Step Functions ARN (for kickoff Lambda)
- `JWT_SECRET_ARN` — Secrets Manager ARN for JWT signing key
- `TAVILY_API_KEY_ARN` — Secrets Manager ARN for Tavily API key
- `BEDROCK_OPUS_MODEL_ID` / `BEDROCK_HAIKU_MODEL_ID` — Claude model IDs

## Disclaimer

All dealer reactions are AI-simulated. They are not statements, opinions, or commentary from actual primary dealers. Persona profiles are constructed from publicly documented house views. This system is for analytical exercise only — not for trading decisions or market-moving distribution.
