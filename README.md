FuelEU Maritime Compliance Platform
A full-stack application implementing EU Regulation 2023/1805 for maritime greenhouse gas emissions compliance tracking, banking, and pooling.

🎯 Project Overview
This platform enables shipping companies to:

Track route compliance against GHG intensity targets
Monitor Compliance Balance (CB) for vessels
Bank surplus emissions credits (Article 20)
Pool credits between vessels (Article 21)
Visualize compliance data and trends
Technology Stack:

Frontend: React, TypeScript, TailwindCSS, Recharts
Backend: Node.js, Express, TypeScript, PostgreSQL
Architecture: Hexagonal (Ports & Adapters)
Testing: Jest, React Testing Library, Supertest
📐 Architecture
Hexagonal Architecture Layers
┌─────────────────────────────────────────────┐
│           Adapters (Inbound)                │
│     UI Components / HTTP Controllers         │
├─────────────────────────────────────────────┤
│              Application Layer               │
│   Use Cases │ Business Logic │ Services     │
├─────────────────────────────────────────────┤
│                Core Domain                   │
│  Entities │ Value Objects │ Domain Rules    │
├─────────────────────────────────────────────┤
│           Adapters (Outbound)               │
│  Repositories │ Database │ External APIs    │
└─────────────────────────────────────────────┘
Key Principles:

Core domain has zero external dependencies
All dependencies point inward
Ports define contracts, adapters implement them
Business logic isolated and testable
🚀 Quick Start
Prerequisites
Node.js 18+
PostgreSQL 14+
npm or yarn
Installation
Clone Repository
bash
git clone https://github.com/yourusername/fueleu-maritime.git
cd fueleu-maritime
Backend Setup
bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# Start server
npm run dev
Backend runs on: http://localhost:3000

Frontend Setup
bash
cd frontend
npm install

# Configure API endpoint
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000

# Start development server
npm run dev
Frontend runs on: http://localhost:5173

📊 Features
1. Routes Management
View all maritime routes with filtering (vessel type, fuel type, year)
Set baseline route for comparisons
Calculate total emissions per route
Display GHG intensity metrics
2. Compliance Comparison
Compare routes against baseline
Visualize GHG intensity differences
Calculate compliance percentages
Target: 89.3368 gCO₂e/MJ (2% below baseline 91.16)
3. Banking (Article 20)
Bank surplus CB for future periods
Apply banked credits to deficits
Track banking history per vessel
Validation: Cannot bank negative CB
4. Pooling (Article 21)
Create pools of 2+ vessels
Greedy allocation algorithm for credit transfer
Validation rules:
Total pool CB ≥ 0
Deficit ships cannot exit worse
Surplus ships cannot exit negative
🧮 Compliance Calculations
Compliance Balance Formula
CB = (Target Intensity - Actual Intensity) × Energy in Scope / 1,000,000
Where:

Target Intensity (2025): 89.3368 gCO₂e/MJ (2% reduction from 91.16)
Energy in Scope: Fuel Consumption (tonnes) × 41,000 MJ/tonne
CB Units: tonnes CO₂ equivalent (tCO₂eq)
Target Intensity by Year
Year	Reduction	Target (gCO₂e/MJ)
2025	2%	89.3368
2030	6%	85.6904
2035	14.5%	77.9418
2040	31%	62.9004
2045	62%	34.6408
2050	80%	18.2320
Percentage Difference Formula
% Diff = ((Comparison GHG / Baseline GHG) - 1) × 100
🗄️ Database Schema
Routes Table
sql
CREATE TABLE routes (
  id VARCHAR PRIMARY KEY,
  route_id VARCHAR UNIQUE,
  vessel_type VARCHAR,
  fuel_type VARCHAR,
  year INTEGER,
  ghg_intensity DECIMAL(10,4),
  fuel_consumption DECIMAL(10,2),
  distance DECIMAL(10,2),
  is_baseline BOOLEAN,
  created_at TIMESTAMP
);
Ship Compliance Table
sql
CREATE TABLE ship_compliance (
  id VARCHAR PRIMARY KEY,
  ship_id VARCHAR,
  year INTEGER,
  cb_gco2eq DECIMAL(12,2),
  route_id VARCHAR,
  created_at TIMESTAMP,
  UNIQUE(ship_id, year)
);
Bank Entries Table
sql
CREATE TABLE bank_entries (
  id VARCHAR PRIMARY KEY,
  ship_id VARCHAR,
  year INTEGER,
  amount_gco2eq DECIMAL(12,2),
  applied_amount DECIMAL(12,2),
  created_at TIMESTAMP
);
Pools & Pool Members
sql
CREATE TABLE pools (
  id VARCHAR PRIMARY KEY,
  year INTEGER,
  created_at TIMESTAMP
);

CREATE TABLE pool_members (
  id VARCHAR PRIMARY KEY,
  pool_id VARCHAR REFERENCES pools(id),
  ship_id VARCHAR,
  cb_before DECIMAL(12,2),
  cb_after DECIMAL(12,2)
);
🔌 API Endpoints
Routes
GET    /routes
       ?vesselType={type}&fuelType={type}&year={year}
       Returns: Route[]

POST   /routes/:id/baseline
       Sets route as baseline

GET    /routes/comparison
       Returns: ComparisonResult
Compliance
GET    /compliance/cb
       ?shipId={id}&year={year}
       Returns: { cbBefore, banked, cbAfter }

GET    /compliance/adjusted-cb
       ?shipId={id}&year={year}
       Returns: AdjustedCB[]
Banking
POST   /banking/bank
       Body: { shipId, year, amount }
       Banks positive CB

POST   /banking/apply
       Body: { shipId, year, amount }
       Applies banked credits
Pooling
POST   /pools
       Body: { year, members: [{ shipId, cbBefore }] }
       Returns: { poolId, allocations }
🧪 Testing
Backend Tests
bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific suite
npm test -- ComputeCBUseCase
Frontend Tests
bash
cd frontend

# Run all tests
npm test

# Run with UI
npm run test:ui

# Run e2e tests
npm run test:e2e
Test Coverage Goals
Domain Logic: 100%
Use Cases: 90%+
Controllers: 80%+
Components: 75%+
📸 Screenshots
Routes Dashboard
Show Image

Compliance Comparison
Show Image

Banking Interface
Show Image

Pooling Management
Show Image

🔧 Development
Project Structure
fueleu-maritime/
├── frontend/
│   ├── src/
│   │   ├── core/           # Domain + Application
│   │   ├── adapters/       # UI + Infrastructure
│   │   └── shared/         # Common utilities
│   └── tests/
├── backend/
│   ├── src/
│   │   ├── core/           # Domain + Application
│   │   ├── adapters/       # HTTP + Database
│   │   └── infrastructure/ # Server + Config
│   └── tests/
└── docs/
Code Standards
TypeScript: Strict mode enabled
Linting: ESLint with recommended rules
Formatting: Prettier with 2-space indents
Commits: Conventional Commits format
Adding New Features
Start with domain entity/value object
Create use case in application layer
Implement repository interface
Add controller and route
Create UI component
Write tests for all layers
🤖 AI Agent Usage
This project was developed with assistance from:

GitHub Copilot - Code completion
Claude Code - Architecture & refactoring
Cursor Agent - Component generation
See AGENT_WORKFLOW.md for detailed prompts and learnings.

📚 Reference Documentation
EU Regulation 2023/1805
Hexagonal Architecture
Domain-Driven Design
📝 Sample API Requests
Get All Routes
bash
curl http://localhost:3000/routes
Set Baseline
bash
curl -X POST http://localhost:3000/routes/R002/baseline
Compute CB
bash
curl http://localhost:3000/compliance/cb?shipId=S001&year=2025
Create Pool
bash
curl -X POST http://localhost:3000/pools \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "members": [
      { "shipId": "S001", "cbBefore": 1250.5 },
      { "shipId": "S002", "cbBefore": -800.0 }
    ]
  }'
🐛 Troubleshooting
Database Connection Issues
bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify credentials in .env
cat backend/.env | grep DATABASE

# Test connection
psql -U postgres -d fueleu_db
Port Already in Use
bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
TypeScript Errors
bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma client
cd backend
npx prisma generate
🤝 Contributing
Fork repository
Create feature branch (git checkout -b feature/amazing-feature)
Commit changes (git commit -m 'Add amazing feature')
Push to branch (git push origin feature/amazing-feature)
Open Pull Request
📄 License
This project is licensed under the MIT License - see LICENSE file for details.

👥 Authors
Your Name

GitHub: @yourusername
Email: your.email@example.com
🙏 Acknowledgments
EU Commission for FuelEU Maritime regulation
Anthropic for Claude AI assistance
Open-source community for excellent tools and libraries
📈 Roadmap
 Multi-year CB tracking
 PDF report generation
 Email notifications for compliance deadlines
 Mobile responsive improvements
 Real-time data synchronization
 Advanced analytics dashboard
 Integration with shipping APIs
Built with  using AI-assisted development

