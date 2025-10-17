# Building Vitals - Complete Developer Handover Document

## 🔐 IMPORTANT: This document contains sensitive information including API keys and tokens

## Project Overview
Building Vitals is a comprehensive building monitoring and analytics platform that visualizes IoT sensor data from ACE IoT systems.

## 🔑 API Keys and Credentials

### Firebase Configuration
```env
FIREBASE_API_KEY: AIzaSyDw6olWUfzfvptwklxb-UtK9K5Snrttlak
FIREBASE_AUTH_DOMAIN: building-vitals.firebaseapp.com
FIREBASE_PROJECT_ID: building-vitals
FIREBASE_STORAGE_BUCKET: building-vitals.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID: 763711142996
FIREBASE_APP_ID: 1:763711142996:web:183060d72d1139eb6d81c1
FIREBASE_MEASUREMENT_ID: G-9C1FZSRSM4
```

### ACE IoT API Access
```env
ACE API URL: https://flightdeck.aceiot.cloud/api
Default ACE Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc1NzYxMTE4NiwianRpIjoiNjY1ZDM2NjMtZjFhZC00YWYxLTliZmEtNGMwMzRmMTllYjA4IiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5Ijoic2VzXzAwMDFfZmFsbHNfY2l0eSIsIm5iZiI6MTc1NzYxMTE4NiwiZXhwIjoxNzg5MTQ3MTg2fQ.5g9JVBO_18x42srsJ4ZUNIqMbK6XeQDyrqqS-WEFc0g
Token Identity: ses_0001_falls_city
Token Expiry: 2026-01-10 (expires in ~1 year)
Site Name: ses_falls_city
Site ID: 309
```

### Cloudflare Workers
```env
Worker URL: https://ace-iot-consolidated-proxy.jstahr.workers.dev
Purpose: Proxy for ACE IoT API with CORS handling and caching
```

### Security Keys
```env
Encryption Secret: OHO8Uhp9XADQT8vKWhS8//hJg6Z2GBkXTjrOpctry2w=
Purpose: Used for encrypting stored tokens
```

## 📁 Project Structure

### Main Directories
- `/src` - React frontend source code
- `/functions` - Firebase Functions (Node.js backend)
- `/workers` - Cloudflare Workers
- `/Building-Vitals` - Additional project files with .env configs
- `/node_modules` - All npm dependencies (included)
- `/.wrangler` - Cloudflare Wrangler state
- `/coverage` - Test coverage reports
- `/docs` - Complete documentation

### Configuration Files
- `.env.example` - Environment template
- `Building-Vitals/.env` - Actual environment variables with keys
- `Building-Vitals/.env.local` - Local development config
- `Building-Vitals/.env.production` - Production config
- `wrangler.toml` - Cloudflare Workers configuration
- `firebase.json` - Firebase project configuration

## 🚀 Quick Start

1. **Install Dependencies** (already included in node_modules)
   ```bash
   npm install
   ```

2. **Environment Setup**
   - All .env files are already configured
   - Keys and tokens are already set up
   - No additional configuration needed

3. **Run Development Server**
   ```bash
   npm start
   ```
   Access at: http://localhost:3001

4. **Deploy to Production**
   ```bash
   npm run deploy
   ```

## 🔧 Technology Stack

### Frontend
- React 18 with TypeScript
- Material-UI (MUI) v5
- ECharts for data visualization
- Redux Toolkit for state management
- React Query for server state

### Backend
- Firebase Functions (Node.js 20)
- Cloudflare Workers for API proxy
- Firestore database
- Firebase Authentication

### Infrastructure
- Firebase Hosting
- Cloudflare Workers (D1 database, KV storage, R2 storage)
- GitHub Actions for CI/CD

## ⚠️ Critical Authentication Note

**The ACE IoT API REQUIRES lowercase `authorization` header:**
```javascript
// ✅ CORRECT
headers: { 'authorization': `Bearer ${token}` }

// ❌ WRONG - WILL FAIL
headers: { 'Authorization': `Bearer ${token}` }
```

## 📊 Data Flow

1. Frontend requests data from Cloudflare Worker
2. Worker authenticates with ACE IoT API
3. Worker fetches and caches data
4. Data returned to frontend for visualization

## 🎯 Default Configuration

- **Default Site**: Falls City (ses_falls_city)
- **Site ID**: 309
- **Data Retention**: 365 days
- **Cache TTL**: 365 days

## 📝 Important Files

### Authentication & API
- `src/services/aceApiService.ts` - ACE API integration
- `workers/src/index.ts` - Cloudflare Worker proxy
- `functions/src/index.ts` - Firebase Functions

### Charts & Visualization
- `src/components/charts/` - All chart components
- `src/hooks/useChartData.ts` - Data fetching hook

### Configuration
- `config/cloudflare-unified-config.toml` - Cloudflare settings
- `vite.config.ts` - Build configuration

## 🔨 Development Commands

```bash
# Development
npm start                 # Start dev server
npm run build            # Build for production
npm test                 # Run tests
npm run lint            # Check code quality

# Deployment
npm run deploy          # Deploy to Firebase
wrangler deploy         # Deploy Cloudflare Worker

# Utilities
npm run analyze         # Analyze bundle size
npm run format         # Format code
```

## 📚 Documentation

Complete documentation available in `/docs`:
- `ACE_IOT_API_AUTHENTICATION.md` - API auth details
- `HIGH_RESOLUTION_MODE_GUIDE.md` - Data visualization guide
- `BATCHING_SYSTEM.md` - Request batching documentation
- `CLOUDFLARE_WORKER_IMPLEMENTATION.md` - Worker details

## 🐛 Known Issues & Solutions

1. **401 Unauthorized Errors**
   - Always use lowercase 'authorization' header
   - Check token expiry (current token expires 2026-01-10)

2. **CORS Issues**
   - Use Cloudflare Worker proxy URL, not direct API

3. **Large Dataset Performance**
   - Enable high-resolution mode for 1M+ points
   - Use request batching for multiple points

## 📞 Support Contacts

- **Project Owner**: JJSTAHR
- **GitHub**: https://github.com/JJSTAHR/Building-Vitals

## 🔒 Security Notes

- All tokens and keys are included for immediate functionality
- Encryption secret is configured for token storage
- Firebase security rules are in place
- CORS handled through Cloudflare Worker

## ✅ Handover Checklist

- [x] All source code files included
- [x] Environment variables with actual keys
- [x] Node modules pre-installed
- [x] Configuration files ready
- [x] Documentation complete
- [x] Build and deployment scripts
- [x] Test suites included
- [x] API tokens valid until 2026

---

**This project is ready for immediate development and deployment. All credentials and configurations are included.**

Last Updated: 2025-10-16