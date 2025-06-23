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
✅ Crypto payment capabilities
✅ NFT loyalty program foundation
✅ Complete web dashboard interface
✅ Authentic Boustan menu integration

## Next Steps
- Deploy smart contracts for production Flow integration
- Implement real-time order tracking on blockchain
- Add more sophisticated NFT reward mechanics
- Expand payment options with additional cryptocurrencies
- Enhance AI conversation capabilities with advanced context