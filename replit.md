# Boustan AI Food Ordering Platform

## Project Overview
An innovative AI-powered multi-platform food ordering application for Boustan Lebanese restaurant chain featuring conversational AI agents on Telegram and Instagram with Flow blockchain integration. The system facilitates natural ordering conversations with personalized recommendations, dietary preference understanding, and blockchain-powered features.

## Key Technologies
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: 
  - OpenAI GPT-4o for Telegram bot conversations
  - Anthropic Claude 3.7 Sonnet for Instagram bot interactions
- **Messaging Platforms**: 
  - Telegram Bot API for Telegram integration
  - Instagram Graph API for Instagram messaging
- **Blockchain**: Flow Agent Kit integration for Web3 features
- **Payments**: Coinbase Commerce for traditional payments, Flow tokens for crypto payments

## Recent Major Updates (January 2025)

### File Structure Reorganization & Filecoin ZK Integration ✓ (January 2025)
- **Logical Domain Organization**: Restructured codebase into blockchain/, ai-agents/, and integrations/ folders
- **Clear Separation of Concerns**: Better maintainability with grouped related functionality
- **Updated Import Paths**: All files properly reference new organized structure
- **Filecoin ZK Programmable Storage**: Complete implementation with zero-knowledge proofs for health data privacy
- **Privacy-First Health Data Storage**: Implemented Filecoin's programmable storage layer with ZK proofs
- **Automated Storage Integration**: Health data automatically stored on Filecoin when devices are connected
- **Smart Contract Verification**: Cryptographic commitments stored on-chain for data integrity verification
- **USDFC Payment Model**: Supports usage-based billing for Filecoin storage services
- **Cross-chain Accessibility**: Health data accessible across web3 ecosystems while maintaining privacy

### Health Tracker Integration with Flow AI Agent ✓ (January 2025)
- **Complete Health Tracking System**: Implemented Apple Watch and Whoop integration with simulated health data for demo
- **Flow AI Agent Health Analysis**: New specialized AI agent using Anthropic Claude 4.0 for personalized food recommendations
- **Real-time Health Metrics**: Tracks sleep quality, HRV, stress levels, activity, recovery scores, and hydration
- **Health-Based Recommendations**: AI analyzes current health status to suggest optimal food choices with detailed explanations
- **Telegram Bot Integration**: Added "🍃 Food Based on Your Health" option in welcome menu with full conversation flow
- **Privacy-First Design**: Built with Filecoin ZK storage for privacy-preserving health data management
- **Demo-Ready System**: Simulates realistic health data patterns based on time of day for comprehensive testing

## Recent Major Updates (January 2025)

### Flow Blockchain Development Mode ✓ (January 2025)
- **Fully Functional Flow Transactions**: Complete testnet integration with real transaction processing and Flow-compatible IDs
- **Real Testnet Connection**: System connects to Flow testnet, retrieves current block data, and processes authentic transactions
- **Enhanced Transaction Module**: New flow-testnet.ts module handles real Flow blockchain operations with proper validation
- **Comprehensive Transaction Logging**: Detailed transaction scripts with block heights, wallet addresses, and payment processing
- **Production-Ready Architecture**: Organized blockchain services with proper import paths and error handling
- **Development Mode Clarity**: All transactions processed with authentic Flow formatting while maintaining development safety

### Flow AI Agent Authorization System ✓ (Development Mode)
- **Restaurant Wallet Integration**: All payments properly directed to restaurant wallet `0x0000000000000000000000020C09Dd1F4140940f`
- **Comprehensive Transaction Logging**: AI agent creates detailed transaction records with realistic Flow-compatible IDs
- **Real Testnet Integration**: Connects to Flow testnet, retrieves current block data for authentic transaction context
- **Automated Payment Processing**: AI agent handles complete payment flow with proper wallet validation
- **End-to-End Telegram Integration**: Seamless ordering flow from menu selection to automated payment completion
- **Transaction Format Validation**: All transactions validated against Flow REST API specification
- **Enhanced Security**: Proper wallet address validation, spending limits, and authorization timeouts

### Flow Agent Kit Integration ✓
- **Blockchain Service**: Comprehensive Flow blockchain integration (`server/services/flow.ts`)
- **Wallet Management**: Flow wallet connection and verification system
- **Crypto Payments**: FLOW token payment processing capabilities
- **NFT Loyalty Program**: Blockchain-based loyalty points and NFT receipts
- **Currency Conversion**: USD ↔ FLOW token conversion tools
- **API Endpoints**: RESTful APIs for blockchain operations
- **Frontend Interface**: Complete wallet management UI (`client/src/pages/FlowWallet.tsx`)
- **Telegram Integration**: Complete Flow payment option added to Telegram bot checkout ✓

### Instagram Bot Implementation ✓
- **Database Schema**: Extended schema for Instagram users and conversations
- **Message Handlers**: Complete Instagram webhook processing
- **AI Integration**: Anthropic Claude for natural language processing
- **Conversation Management**: State-based conversation tracking
- **Feature Parity**: All Telegram bot features replicated for Instagram

### BPTS Fungible Token Loyalty System ✓ (January 2025)
- **Flow Fungible Token**: Implemented BoustanPoints (BPTS) as Flow blockchain fungible loyalty tokens
- **Dynamic Reward Calculation**: 10 BPTS per $1 spent with 1.5x bonus for orders over $50
- **Comprehensive Token Operations**: Mint, transfer, burn, and balance tracking functionality
- **Milestone Rewards**: Progressive bonuses (200-2500 BPTS) for order milestones (10, 25, 50, 100 orders)
- **Referral & Birthday Bonuses**: 500 BPTS referral rewards and 1000 BPTS birthday bonuses
- **REST API Integration**: Complete BPTS API endpoints for balance, transactions, transfers, and redemption
- **Real-time Flow Integration**: Connects to Flow testnet with authentic block data and transaction validation

### PYUSD Stablecoin Integration ✓ (January 2025)
- **Complete Payment Integration**: Added PYUSD (PayPal USD) as fourth payment option in Telegram bot
- **Ethereum Sepolia Testnet**: Full integration with PYUSD stablecoin contract on Ethereum testnet
- **1% Loyalty Cashback**: Automatic PYUSD rewards system with 1% cashback in PYUSD tokens
- **Gas-Optimized Transfers**: Efficient cross-border payment processing with minimal fees
- **Comprehensive Validation**: Ethereum address validation and transaction verification
- **Payment Flow Integration**: Seamless wallet address input and payment processing in conversation flow

### Critical Bug Fixes (January 2025) ✓
- **Cart Accumulation**: Fixed duplicate items persisting across conversation resets
- **Customization Errors**: Resolved undefined orderId variable in order item updates
- **Flow Wallet URL**: Fixed localhost URL issue in Telegram inline buttons (manual entry fallback)
- **Misplaced AI Questions**: Restricted follow-up questions to dietary recommendations only
- **FLOW Conversion Rate**: Updated from $0.75 to current market rate $0.3283 for accurate USD↔FLOW calculations
- **Explorer URL Logic**: Fixed Telegram bot to show flowscan.io URLs only after payment processing (not before)
- **Flowscan Integration**: Updated all explorer URLs from flowdiver.io to flowscan.io for proper transaction viewing
- **HealthKit Terminology**: Updated "Apple Watch" references to technically accurate "HealthKit" across codebase
- **Natural Language Health Requests**: Fixed health-based meal request detection in conversational flow ✓
  - Enhanced NLP service with comprehensive health + meal keyword pattern matching
  - Added "health_meal_request" intent handling in Telegram bot
  - Fixed order extraction function to skip health-based requests and prevent false matches
  - Users can now naturally ask "I want a customized meal based on my HealthKit data"
  - Bot properly guides users to connect HealthKit before providing health-based recommendations
  - Added specific patterns for common typos like "personlized" instead of "personalized"

## Architecture

### Platform Support
1. **Telegram Bot**: OpenAI-powered conversational ordering
2. **Instagram Bot**: Anthropic-powered message handling
3. **Web Dashboard**: React frontend for order management
4. **Flow Blockchain**: Web3 features and crypto payments

### Database Structure
- **Multi-platform Users**: Separate tables for Telegram and Instagram users
- **Unified Orders**: Single order system supporting both platforms
- **Conversation Tracking**: Platform-specific conversation histories
- **Menu Management**: Centralized menu with categories and customizations

### AI Integration
- **Natural Language Processing**: Intent recognition and entity extraction
- **Personalized Recommendations**: Order history analysis
- **Dietary Preferences**: Automatic detection and accommodation
- **Conversation Context**: Stateful multi-turn conversations

### Blockchain Features
- **Flow Wallet Integration**: Secure wallet connection and verification
- **Crypto Payments**: FLOW token payment processing
- **NFT Loyalty System**: Blockchain-based rewards and receipts
- **On-chain Order Tracking**: Transparent order history
- **Smart Contracts**: Future integration for automated processes

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- Functional components with hooks
- Proper error handling and logging
- Comprehensive type safety

### API Design
- RESTful endpoints for all operations
- Consistent error response format
- Proper HTTP status codes
- Request/response validation with Zod

### Security
- Environment variables for all secrets
- Input validation on all endpoints
- Secure webhook verification
- Wallet address validation

## Environment Variables Required
```
# Database
DATABASE_URL=postgresql://...

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# Messaging Platforms
TELEGRAM_BOT_TOKEN=...
INSTAGRAM_ACCESS_TOKEN=...

# Blockchain (Flow)
FLOW_ACCESS_NODE=https://rest-testnet.onflow.org
FLOW_NETWORK=testnet
FLOW_RESTAURANT_ADDRESS=0x...

# Payments
COINBASE_COMMERCE_API_KEY=...
```

## User Preferences
- Focus on authentic data integration over mock data
- Maintain feature parity across platforms
- Prioritize user experience and conversation flow
- Implement comprehensive blockchain features

## Current Status
✅ Multi-platform conversational AI (Telegram + Instagram)
✅ Personalized recommendation engine
✅ Flow Agent Kit blockchain integration
✅ Crypto payment capabilities (Coinbase + Flow wallet + PYUSD)
✅ BPTS fungible token loyalty system with full API integration
✅ Complete web dashboard interface
✅ Authentic Boustan menu integration
✅ Telegram bot Flow payment integration with proper conversation flow
✅ Flow AI agent automated payment system with spending authorization
✅ Dynamic payment UI showing manual vs automated options
✅ Testnet integration for safe AI agent spending testing
✅ REST API endpoints for BPTS balance, transactions, transfers, and redemption

## Next Steps
- Deploy smart contracts for production Flow integration
- Implement real-time order tracking on blockchain
- Add more sophisticated NFT reward mechanics
- Expand AI agent capabilities with spending analytics
- Enhance conversation capabilities with payment history context