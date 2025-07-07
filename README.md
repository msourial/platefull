# 🍽️ Boustan AI Food Ordering Platform 🤖

🚀 An innovative multi-platform AI-powered food ordering application for Boustan Lebanese restaurant chain featuring conversational AI agents, blockchain integration, and comprehensive payment systems! 💫

## 🏗️ Architecture Overview

### 💻 Core Technologies
- **🖥️ Frontend**: React 18 with TypeScript, Tailwind CSS, shadcn/ui components
- **⚙️ Backend**: Express.js with TypeScript, RESTful API architecture
- **🗄️ Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **🤖 AI Integration**: 
  - OpenAI GPT-4o for Telegram bot conversations 🧠
  - Anthropic Claude Sonnet 4 for Instagram bot interactions 🎯
- **⛓️ Blockchain**: Flow testnet integration for Web3 features
- **📱 Messaging Platforms**: 
  - Telegram Bot API for conversational ordering 💬
  - Instagram Graph API for messaging integration 📸

### 🌐 Platform Support
1. **📨 Telegram Bot**: Primary conversational ordering interface
2. **📷 Instagram Bot**: Social media messaging integration
3. **📊 Web Dashboard**: React frontend for order management and analytics
4. **⛓️ Flow Blockchain**: Decentralized payments and loyalty systems

## 🚀 Key Features

### 🤖 Multi-Platform Conversational AI
- **🧠 Natural Language Processing**: Advanced intent recognition and entity extraction
- **💡 Personalized Recommendations**: AI-driven food suggestions based on user preferences
- **🥗 Dietary Preferences**: Automatic detection and accommodation of dietary restrictions
- **💬 Conversation Context**: Stateful multi-turn conversations with memory
- **🍽️ Order Customization**: Interactive menu item customization with AI assistance

### 🏥 Health Tracker Integration & AI-Powered Nutrition
- **📱 Apple HealthKit Integration**: Seamless connection to iPhone and Apple Watch health data
- **🗣️ Natural Language Health Requests**: Users can simply say "I want a customized lunch based on my HealthKit data"
- **🤖 Flow AI Agent Health Analysis**: Specialized Anthropic Claude 4.0 agent for health-based food recommendations
- **📊 Real-time Health Metrics**: Integration with sleep quality, HRV, stress levels, activity, and recovery scores
- **🎯 Personalized Food Selection**: AI analyzes current health status to suggest optimal food choices
- **🔒 ZK & Filecoin Storage**: Leverages Filecoin for decentralized storage and Zero-Knowledge (ZK) proofs to secure sensitive health data pulled from trackers.
- **💡 Intelligent Recommendations**: Detailed explanations for why specific foods are recommended based on health metrics
- **⏰ Contextual Timing**: Recommendations adapt based on time of day and current health state

### ⛓️ Blockchain Integration (Flow)
- **🪙 BPTS Fungible Token Loyalty System**: BoustanPoints (BPTS) as Flow blockchain tokens
- **💰 Dynamic Reward Structure**: 10 BPTS per $1 spent with 1.5x bonus for orders over $50
- **🏆 Milestone Rewards**: Progressive bonuses (200-2500 BPTS) for order achievements
- **🤖 AI Agent Payments**: Automated payment processing to restaurant wallet
- **🔗 Real-time Testnet Integration**: Authentic Flow blockchain connectivity

### 💳 Payment Systems
1. **💸 Traditional Payments**: Coinbase Commerce integration
2. **🌊 Flow Tokens**: Native FLOW cryptocurrency payments
3. **💵 PYUSD Stablecoin**: PayPal USD on Ethereum Sepolia testnet with 1% cashback
4. **🤖 AI Agent Authorization**: Automated spending with user-controlled limits

### 📋 Advanced Order Management
- **🎯 Multi-stage Ordering**: Guided ordering flow with customizations
- **🚚 Delivery Options**: Pickup and delivery with address management
- **📜 Order History**: Complete transaction and preference tracking
- **🔔 Real-time Updates**: Order status notifications across platforms

## 📋 Technical Requirements

### 🛠️ System Dependencies
- 🟢 Node.js 20+ with TypeScript support
- 🐘 PostgreSQL database
- 🌊 Flow testnet access
- 🤖 Telegram Bot API token
- 📸 Instagram Graph API credentials

### 🔐 Environment Variables
```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# AI Service Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# Messaging Platform Tokens
TELEGRAM_BOT_TOKEN=...
INSTAGRAM_ACCESS_TOKEN=...

# Blockchain Configuration (Flow)
FLOW_ACCESS_NODE=https://rest-testnet.onflow.org
FLOW_NETWORK=testnet
FLOW_RESTAURANT_ADDRESS=0x0000000000000000000000020C09Dd1F4140940f

# Payment Integration
COINBASE_COMMERCE_API_KEY=...

# PostgreSQL Connection Details
PGHOST=...
PGPORT=5432
PGDATABASE=...
PGUSER=...
PGPASSWORD=...
```

## 🗄️ Database Schema

### 📊 Core Tables
- **👥 users**: Base user management
- **📱 telegram_users**: Telegram-specific user data with conversation state
- **📸 instagram_users**: Instagram-specific user profiles
- **📂 categories**: Menu category organization
- **🍽️ menu_items**: Complete menu with pricing and descriptions
- **🔧 customization_options**: Item customization choices
- **📋 orders**: Order management with payment tracking
- **🛒 order_items**: Individual order line items with customizations
- **💬 conversations**: Platform-agnostic conversation tracking
- **📝 conversation_messages**: Message history with AI context

### 🔗 Relationship Structure
```sql
categories (1) -> (many) menu_items
menu_items (1) -> (many) customization_options
telegram_users (1) -> (many) orders
orders (1) -> (many) order_items
telegram_users (1) -> (many) conversations
conversations (1) -> (many) conversation_messages
```

## 🤖 AI Integration Details

### 🤖 OpenAI GPT-4o (Telegram)
- **🧠 Model**: `gpt-4o` (latest OpenAI model)
- **⚡ Capabilities**: 
  - 🍽️ Natural language understanding for food orders
  - 🥗 Dietary preference detection and accommodation
  - 💡 Menu item recommendations with reasoning
  - 🔧 Order customization assistance
  - 💬 Multi-turn conversation management

### 🎯 Anthropic Claude Sonnet 4 (Instagram)
- **🚀 Model**: `claude-sonnet-4-20250514` (latest Anthropic model)
- **✨ Features**:
  - 📸 Instagram message processing
  - 🧠 Context-aware responses
  - 🧭 Menu navigation assistance
  - 📋 Order placement guidance

### AI Service Architecture
```typescript
interface FoodRecommendationResponse {
  recommendations: {
    name: string;
    category: string;
    reasons: string[];
  }[];
  followUpQuestions: string[];
  responseMessage: string;
}
```

## 🏥 Health-Based Food Selection with Natural Language

### 🗣️ Natural Language Health Requests
Users can request personalized meals using natural language that combines health context with food preferences. The system uses advanced NLP to detect health-related meal requests and routes them to the specialized health AI agent.

#### 📝 Example Natural Language Requests:
```
"I want a customized lunch based on my HealthKit data"
"Can you suggest dinner based on my current health metrics?"
"I'd like a personalized meal recommendation using my health tracker data"
"What should I eat for breakfast based on my Apple Watch data?"
"Give me food suggestions based on my current wellness metrics"
"I want a meal tailored to my health condition today"
```

### 🧠 AI Health Analysis Process
1. **📊 Health Data Retrieval**: System fetches real-time metrics from connected devices
2. **🤖 AI Analysis**: Anthropic Claude 4.0 analyzes health patterns and current state
3. **🍽️ Food Matching**: AI matches health needs with available menu items
4. **💡 Personalized Recommendations**: Provides detailed explanations for each suggestion
5. **⏰ Contextual Timing**: Considers time of day and meal timing for optimal nutrition

### 📱 Supported Health Metrics
- **❤️ Heart Rate Variability (HRV)**: Stress and recovery assessment
- **😴 Sleep Quality**: Rest duration and sleep debt analysis
- **🏃 Activity Levels**: Exercise intensity and caloric burn
- **💧 Hydration Status**: Fluid intake tracking
- **⚡ Energy Levels**: Fatigue and alertness patterns
- **🧘 Stress Indicators**: Mental wellness and tension levels

### 🎯 Personalized Recommendation Engine
```typescript
interface HealthBasedRecommendation {
  recommendedItems: {
    name: string;
    category: string;
    healthBenefits: string[];
    whyRecommended: string;
  }[];
  avoidItems: string[];
  mealTiming: string;
  explanation: string;
  confidence: number;
}
```

### 💬 Conversation Flow Example
```
User: "I want a customized lunch based on my HealthKit data"

Bot: "I'll analyze your current health metrics to suggest the perfect lunch! 📊

Your Health Status:
❤️ HRV: 45ms (good recovery)
😴 Sleep: 7.2hrs (well-rested)
🏃 Activity: High intensity workout this morning
💧 Hydration: 85% of daily goal

Recommended for you:
🥗 Mediterranean Bowl - High protein for muscle recovery
🐟 Grilled Salmon Plate - Omega-3s for inflammation reduction
🥑 Quinoa Power Bowl - Complex carbs for sustained energy

Why these choices?
After your intense workout, your body needs protein for muscle repair and healthy fats for inflammation control. Your good sleep and HRV indicate you can handle complex carbs for sustained afternoon energy."
```

### 🔒 Privacy & Security
- **🛡️ Zero-Knowledge Storage**: Health data encrypted with Filecoin ZK proofs
- **🔐 Local Processing**: Sensitive metrics processed securely on-device
- **🚫 No Data Selling**: Health information never shared with third parties
- **✅ User Control**: Complete control over data sharing and deletion

### 🚀 Getting Started with Health-Based Food Selection

#### 1️⃣ Connect Your Health Tracker
```
Start Telegram bot → Choose "🍃 Food Based on Your Health" → Connect Apple HealthKit
```

#### 2️⃣ Use Natural Language Requests
Simply type your request in natural language:
- "I want a customized lunch based on my HealthKit data"
- "Suggest dinner based on my current health metrics"
- "What should I eat based on my Apple Watch data?"

#### 3️⃣ Receive Personalized Recommendations
The AI analyzes your health metrics and provides:
- Specific menu item recommendations
- Detailed explanations for each suggestion
- Health benefits of recommended foods
- Items to avoid based on current state

#### 4️⃣ Order with One-Tap
Select recommended items and proceed with:
- Traditional payment methods
- Flow cryptocurrency
- PYUSD stablecoin
- AI agent automated payments

## ⛓️ Blockchain Integration (Flow)

### 🪙 BPTS Fungible Token System
- **🏷️ Token Name**: BoustanPoints (BPTS)
- **🌐 Network**: Flow Testnet
- **📍 Contract Address**: `0x0000000000000000000000020C09Dd1F4140940f`
- **🔢 Decimals**: 8
- **💰 Base Rate**: 10 BPTS per $1 USD spent

### 🎁 Reward Structure
```typescript
interface LoyaltyTokenReward {
  basePointsPerDollar: 10;
  bonusMultiplier: 1.5; // For orders over $50
  referralBonus: 500;
  birthdayBonus: 1000;
  milestoneRewards: {
    "10": 200,    // 10 orders
    "25": 500,    // 25 orders
    "50": 1000,   // 50 orders
    "100": 2500   // 100 orders
  };
}
```

### 🔗 Flow Integration Features
- **⚡ Real-time Testnet Connection**: Connects to Flow testnet for authentic block data
- **✅ Transaction Validation**: Flow REST API compliant transaction formatting
- **🛡️ Development Mode**: Safe testing environment with comprehensive logging
- **💼 Wallet Management**: Flow wallet connection and verification system

## 💳 Payment Integration

### 💰 Multi-Currency Support
1. **💸 Traditional Payments** (Coinbase Commerce)
   - 💳 Credit/debit cards
   - 🏦 Bank transfers
   - ₿ Cryptocurrency (BTC, ETH, etc.)

2. **🌊 Flow Native Tokens**
   - 💎 FLOW cryptocurrency payments
   - 🔄 Real-time USD ↔ FLOW conversion
   - 🧪 Testnet transaction processing

3. **💵 PYUSD Stablecoin** (Ethereum Sepolia)
   - 🔗 PayPal USD stablecoin integration
   - 💰 1% loyalty cashback in PYUSD
   - ⚡ Gas-optimized transfers

4. **🤖 AI Agent Payments**
   - 🔄 Automated payment processing
   - 🎚️ User-controlled spending limits
   - 🏪 Restaurant wallet integration

## 🔗 API Endpoints

### 🍽️ Core Menu & Orders
```
GET    /api/categories              - 📂 Menu categories
GET    /api/menu-items             - 🍽️ Menu items (with category filter)
GET    /api/menu-items/:id         - 🔍 Specific menu item
GET    /api/orders                 - 📜 Order history
POST   /api/orders                 - ➕ Create new order
PUT    /api/orders/:id/status      - 🔄 Update order status
GET    /api/stats                  - 📊 Order statistics
```

### 📱 Telegram Integration
```
POST   /api/telegram/webhook       - 🔔 Telegram webhook handler
POST   /api/telegram/set-webhook   - ⚙️ Configure webhook URL
```

### 📸 Instagram Integration
```
GET    /api/instagram/webhook      - ✅ Instagram webhook verification
POST   /api/instagram/webhook      - 💬 Instagram message processing
```

### 🌊 Flow Blockchain
```
GET    /api/flow/balance/:address  - 💰 Flow token balance
POST   /api/flow/payment          - 💳 Process Flow payment
GET    /api/flow/wallet-page      - 💼 Wallet connection interface
POST   /api/flow/wallet-connected - 🔗 Wallet connection callback
```

### 🏥 Apple HealthKit Integration
```
POST   /api/healthkit/authorize      - 🔐 Apple HealthKit authorization
GET    /api/healthkit/samples/:userId - 📊 Retrieve health data samples
GET    /api/healthkit/authorization/:userId - ✅ Check authorization status
POST   /api/healthkit/revoke/:userId - 🚫 Revoke HealthKit permissions
```

### 🪙 BPTS Loyalty System
```
GET    /api/loyalty/info          - ℹ️ Token contract information
GET    /api/loyalty/balance/:address - 💰 BPTS token balance
GET    /api/loyalty/transactions/:address - 📊 Transaction history
POST   /api/loyalty/transfer      - 🔄 Transfer BPTS tokens
POST   /api/loyalty/redeem        - 🎁 Redeem BPTS for rewards
```

## 🚀 Installation & Setup

### 🔧 Prerequisites
```bash
# 🟢 Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 🐘 Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib
```

### 🚀 Project Setup
```bash
# 📥 Clone repository
git clone <repository-url>
cd boustan-ai-platform

# 📦 Install dependencies
npm install

# 🔧 Environment setup
cp .env.example .env
# Configure all environment variables

# 🗄️ Database setup
npm run db:push    # Apply schema migrations
npm run db:seed    # Seed initial data

# 🌟 Development server
npm run dev        # Starts Express + Vite servers
```

### 🔄 Database Migration
```bash
# 📊 Schema changes
npm run db:push

# ⚠️ Reset database (careful!)
npm run db:reset

# 🛠️ Generate new migrations
npx drizzle-kit generate:pg
```

## 🏃‍♂️ Development Workflow

### Project Structure
```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/        # Application pages
│   │   └── lib/          # Client utilities
├── server/                # Express backend
│   ├── services/         # Business logic
│   │   ├── ai.ts        # AI integration
│   │   ├── flow.ts      # Flow blockchain
│   │   └── flow-loyalty-token.ts  # BPTS system
│   ├── telegram/        # Telegram bot logic
│   ├── instagram/       # Instagram bot logic
│   └── routes.ts        # API endpoints
├── shared/               # Shared code
│   └── schema.ts        # Database schema
└── db/                  # Database utilities
    └── seed.ts          # Data seeding
```

### 💻 Development Commands
```bash
npm run dev              # 🚀 Development server
npm run build           # 🏗️ Production build
npm run db:push         # 📊 Update database schema
npm run db:seed         # 🌱 Seed database
npm run lint            # 🔍 Code linting
npm run type-check      # ✅ TypeScript validation
```

### 🧪 Testing
```bash
# 🔗 API endpoint testing
curl http://localhost:5000/api/loyalty/info

# 🌊 Flow blockchain connectivity
curl http://localhost:5000/api/flow/balance/0x01cf0e2f2f715450

# 📱 Telegram webhook (requires ngrok)
curl -X POST http://localhost:5000/api/telegram/webhook
```

## 🔒 Security Features

### 🔐 Authentication & Authorization
- 📱 Telegram user verification via Bot API
- 📸 Instagram webhook signature validation
- 💼 Flow wallet address validation
- 🤖 AI agent spending limits and timeouts

### 🛡️ Data Protection
- 🔑 Environment variable security for all API keys
- 🐘 PostgreSQL with parameterized queries
- ✅ Input validation on all endpoints
- 🔒 Secure webhook verification

### ⛓️ Blockchain Security
- 🧪 Flow testnet for safe development
- 💼 Wallet address format validation
- 💰 Transaction amount limits
- 📝 Development mode transaction logging

## 📊 Monitoring & Analytics

### 📋 Order Tracking
- 🔔 Real-time order status updates
- 🚚 Delivery tracking integration
- 📱 Customer notification system
- 📈 Performance metrics collection

### 🤖 AI Analytics
- ✅ Conversation success rates
- 🎯 Recommendation accuracy tracking
- 👤 User preference analysis
- 📊 Platform usage statistics

### ⛓️ Blockchain Monitoring
- 🪙 BPTS token transaction history
- 🎁 Loyalty reward distribution
- 💳 Payment success rates
- 💼 Wallet connection analytics

## 🔧 Troubleshooting

### ⚠️ Common Issues

**🐘 Database Connection**
```bash
# ✅ Check PostgreSQL status
sudo systemctl status postgresql

# 🔄 Reset database connection
npm run db:push
```

**🌊 Flow Blockchain Issues**
```bash
# 🔗 Test Flow connectivity
curl https://rest-testnet.onflow.org/v1/blocks?height=sealed

# 💼 Verify wallet address format
# Flow addresses: 0x + 16 hex characters
```

**🤖 AI Service Errors**
```bash
# 🔑 Check API key configuration
echo $OPENAI_API_KEY | cut -c1-7
echo $ANTHROPIC_API_KEY | cut -c1-7

# 🧪 Test AI endpoints
curl -X POST localhost:5000/api/ai/recommendations
```

**📱 Telegram/Instagram Bot Issues**
```bash
# ✅ Verify webhook configuration
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# 🧪 Test message processing
curl -X POST localhost:5000/api/telegram/webhook
```

## 📈 Performance Optimization

### 🗄️ Database Optimization
- 📊 Indexed foreign keys for fast joins
- 🔗 Connection pooling with proper limits
- ⚡ Query optimization with Drizzle ORM
- 📄 Pagination for large datasets

### 🚀 API Performance
- 💾 Response caching for static data
- ⚡ Async/await for non-blocking operations
- ❌ Error handling with proper HTTP codes
- ✅ Request validation with Zod schemas

### ⛓️ Blockchain Efficiency
- 📦 Batched BPTS token operations
- 🧪 Testnet-first development approach
- 🔧 Optimized transaction formatting
- 🔗 Connection pooling for Flow API calls

## 🚀 Deployment

### 🏗️ Production Requirements
- 🟢 Node.js 20+ production environment
- 🐘 PostgreSQL database (managed service recommended)
- 🔒 SSL certificates for webhook endpoints
- 🔑 Environment variable management system

### 🌐 Replit Deployment
```bash
# 🏗️ Build production assets
npm run build

# 🚀 Deploy to Replit
# 🔧 Configure production environment variables
# 🌍 Set up custom domain (optional)
```

### ⚙️ Environment Configuration
```bash
# 🏭 Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://prod-connection-string
TELEGRAM_BOT_TOKEN=production-bot-token
# ... other production configurations
```

## 📚 Additional Resources

### 📖 Documentation Links
- 🌊 [Flow Blockchain Documentation](https://docs.onflow.org/)
- 📱 [Telegram Bot API](https://core.telegram.org/bots/api)
- 📸 [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/)
- 🤖 [OpenAI API Documentation](https://platform.openai.com/docs)
- 🧠 [Anthropic Claude API](https://docs.anthropic.com/)

### 🛠️ Development Tools
- 🗄️ [Drizzle ORM Documentation](https://orm.drizzle.team/)
- 🎨 [Tailwind CSS](https://tailwindcss.com/)
- 🧩 [shadcn/ui Components](https://ui.shadcn.com/)
- ⚡ [React Query](https://tanstack.com/query/)

## 📄 License

This project is proprietary software developed for Boustan Lebanese restaurant chain. All rights reserved. 🏛️

## 🤝 Contributing

This is a private project. For internal development questions or issues, please contact the development team. 👥

---

🎉 **Last Updated**: January 2025  
🚀 **Version**: 2.0.0  
🟢 **Node.js**: 20+  
🐘 **Database**: PostgreSQL with Drizzle ORM  
⛓️ **Blockchain**: Flow Testnet Integration  
🤖 **AI**: OpenAI GPT-4o + Anthropic Claude Sonnet 4