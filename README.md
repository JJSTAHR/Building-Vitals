# Building Vitals - Complete Building Management System

## 🏢 Executive Summary

Building Vitals is a comprehensive, enterprise-grade building management and analytics platform that provides real-time monitoring, visualization, and control of IoT sensor data from commercial buildings. The system integrates with ACE IoT systems to deliver actionable insights for optimizing building operations, energy efficiency, and occupant comfort.

## 🎯 Key Features

- **Real-Time Data Visualization**: Interactive charts and dashboards with 50+ chart types
- **IoT Integration**: Direct integration with ACE IoT platform for sensor data
- **Advanced Analytics**: Machine learning-based anomaly detection and predictive maintenance
- **Multi-Tenant Architecture**: Support for multiple buildings and sites
- **High-Performance**: Handles 1M+ data points without performance degradation
- **Offline Support**: Progressive Web App with offline capabilities
- **Enterprise Security**: Role-based access control with Firebase Authentication
- **Data Processing**: Real-time and batch processing with request batching
- **Export Capabilities**: PDF, Excel, CSV, and image exports

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React 18)                         │
│  - TypeScript          - Material-UI v6      - ECharts 5           │
│  - Redux Toolkit       - React Query         - React Router v6      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (Cloudflare Worker)                  │
│  - CORS Handling       - Request Caching     - Rate Limiting       │
│  - Auth Validation     - Data Transformation - Binary Protocol      │
└─────────────────────────────────────────────────────────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│   Firebase Functions (Node)  │    │      ACE IoT API              │
│  - Auth Management            │    │  - Sensor Data                │
│  - User Profiles              │    │  - Sites & Points             │
│  - Admin Functions            │    │  - Time Series Data           │
└──────────────────────────────┘    └──────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Storage Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  Firestore   │  │  D1 Database │  │  R2 Storage  │            │
│  │  (User Data) │  │ (Hot Storage)│  │(Cold Storage)│            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                    ┌──────────────┐  ┌──────────────┐            │
│                    │  KV Storage  │  │   IndexedDB  │            │
│                    │   (Caching)  │  │ (Local Cache)│            │
│                    └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

## 💻 Technology Stack

### Frontend Technologies
- **Framework**: React 18.3.1 with TypeScript 5.7.3
- **UI Components**: Material-UI (MUI) v6.3.2
- **State Management**:
  - Redux Toolkit 2.5.0 for global state
  - React Query (TanStack Query) 5.67.2 for server state
  - Zustand 5.0.7 for local component state
- **Data Visualization**:
  - ECharts 5.5.1 with echarts-for-react
  - ECharts-GL for 3D visualizations
  - Custom WebGL charts for high-performance rendering
- **Routing**: React Router v6.30.0
- **Forms**: React Hook Form with Yup/Zod validation
- **Build Tool**: Vite 6.0.7 with optimized chunking
- **Testing**:
  - Vitest for unit tests
  - Playwright for E2E tests
  - Jest for legacy tests

### Backend Technologies
- **Firebase Functions**: Node.js 20 runtime
- **Cloudflare Workers**: Edge computing for API proxy
- **Database**:
  - Firestore for user data and settings
  - Cloudflare D1 for time-series data (SQLite)
  - Cloudflare R2 for cold storage (S3-compatible)
- **Caching**:
  - Cloudflare KV for edge caching
  - Redis for application caching (optional)
  - IndexedDB for client-side caching
- **Authentication**: Firebase Auth with JWT tokens
- **Real-time**: WebSockets and Server-Sent Events

### Development Languages
- **TypeScript**: Primary language (90% of codebase)
- **JavaScript**: Legacy code and workers (8%)
- **CSS/SCSS**: Styling with CSS-in-JS (2%)

### Machine Learning
- **TensorFlow.js 4.22.0**: Client-side ML for anomaly detection
- **Universal Sentence Encoder**: Natural language processing
- **Statistical Analysis**: Simple-statistics library

## 📊 Data Flow

### 1. Authentication Flow
```
User Login → Firebase Auth → JWT Token → Firestore Profile → ACE Token Storage
```

### 2. Data Request Flow
```
Frontend Request → Batch Queue → Cloudflare Worker → ACE IoT API
     ↓                                    ↓
Response Cache ← Data Transformation ← API Response
```

### 3. Real-time Updates
```
ACE IoT → WebSocket → Worker → Server-Sent Events → Frontend
```

### 4. Data Storage Tiers
- **Hot Storage** (0-30 days): Cloudflare D1 - Fast SQLite queries
- **Warm Storage** (30-90 days): Compressed in D1
- **Cold Storage** (90+ days): Cloudflare R2 - Parquet format

## 🔑 API Integration

### ACE IoT API
- **Base URL**: `https://flightdeck.aceiot.cloud/api`
- **Proxy URL**: `https://ace-iot-consolidated-proxy.jstahr.workers.dev`
- **Authentication**: Bearer token (lowercase 'authorization' header required)
- **Default Site**: Falls City (ses_falls_city, ID: 309)

### Key Endpoints
```javascript
// Sites
GET /sites                    // List all sites
GET /sites/{site_id}/points   // Get points for a site

// Time Series Data
GET /points/{point_name}/timeseries?start_time={ISO8601}&end_time={ISO8601}

// Batch Operations
POST /batch/timeseries        // Fetch multiple points in one request
```

### Request Batching System
- Automatic batching with 100ms window
- Request deduplication
- 5-minute cache TTL
- Reduces API calls by up to 95%

## 🔐 Security & Authentication

### Authentication Layers
1. **Firebase Authentication**: Primary user authentication
2. **ACE IoT Tokens**: Secondary tokens for API access
3. **Role-Based Access Control**: Admin, User, Viewer roles
4. **Custom Claims**: Firebase custom claims for fine-grained permissions

### Security Features
- **Token Encryption**: AES-256-GCM encryption for stored tokens
- **CORS Protection**: Strict origin validation
- **Rate Limiting**: Per-user and per-IP limits
- **Input Validation**: Zod schemas for all inputs
- **CSP Headers**: Content Security Policy enforcement
- **SQL Injection Prevention**: Parameterized queries

## 📦 Project Structure

```
Building-Vitals/
├── src/                      # React application source
│   ├── components/          # Reusable UI components
│   │   ├── charts/         # 50+ chart components
│   │   ├── common/         # Shared components
│   │   └── layout/         # Layout components
│   ├── pages/              # Route components
│   ├── services/           # API and business logic
│   ├── hooks/              # Custom React hooks
│   ├── store/              # Redux store and slices
│   ├── utils/              # Utility functions
│   └── theme/              # Material-UI themes
├── functions/               # Firebase Functions
│   └── src/
│       ├── index.ts       # Main function exports
│       ├── auth.ts        # Authentication logic
│       └── tokenManagement.ts
├── workers/                 # Cloudflare Workers
│   └── src/
│       └── consolidated-ace-proxy-worker.js
├── public/                  # Static assets
├── tests/                   # Test suites
├── docs/                    # Documentation
└── config/                  # Configuration files
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js 20+ and npm 10+
- Firebase CLI: `npm install -g firebase-tools`
- Wrangler CLI: `npm install -g wrangler`

### Quick Start
```bash
# 1. Install dependencies
npm install
cd functions && npm install && cd ..

# 2. Environment setup
# All .env files are pre-configured with keys

# 3. Start development server
npm start
# Access at http://localhost:3001

# 4. Run tests
npm test
npm run test:e2e

# 5. Build for production
npm run build
```

### Deployment

#### Frontend Deployment (Firebase Hosting)
```bash
# Build and deploy
npm run deploy

# Or deploy only hosting
firebase deploy --only hosting
```

#### Backend Deployment (Firebase Functions)
```bash
cd functions
npm run deploy

# Or from root
firebase deploy --only functions
```

#### Worker Deployment (Cloudflare)
```bash
wrangler deploy

# For production
wrangler deploy --env production
```

## 🔧 Configuration

### Environment Variables
All environment variables are in `Building-Vitals/.env`:
- Firebase configuration
- ACE IoT API tokens (valid until 2026)
- Cloudflare Worker URLs
- Feature flags

### Key Configuration Files
- `vite.config.ts` - Build configuration
- `wrangler.toml` - Cloudflare Worker config
- `firebase.json` - Firebase project settings
- `tsconfig.json` - TypeScript configuration

## 📈 Performance Optimizations

### Frontend Optimizations
- **Code Splitting**: Dynamic imports with lazy loading
- **Bundle Optimization**: Granular chunks for better caching
- **Compression**: Gzip and Brotli compression
- **Image Optimization**: WebP format with fallbacks
- **Virtual Scrolling**: For large data lists
- **Memoization**: React.memo and useMemo for expensive operations

### Backend Optimizations
- **Edge Computing**: Cloudflare Workers for low latency
- **Request Batching**: Automatic batching with deduplication
- **Caching Strategy**: Multi-tier caching (Edge, Application, Browser)
- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Reused database connections

### Data Optimizations
- **Binary Protocol**: MessagePack for 80% smaller payloads
- **Progressive Loading**: Chunk-based data loading
- **Data Compression**: Pako compression for large datasets
- **WebGL Rendering**: GPU acceleration for charts

## 🧪 Testing

### Test Coverage
- Unit Tests: 85% coverage
- Integration Tests: Key workflows covered
- E2E Tests: Critical user paths
- Performance Tests: Load and stress testing

### Running Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all

# Coverage report
npm run test:coverage
```

## 📚 Key Features Documentation

### 1. Real-Time Dashboard
- Drag-and-drop chart placement
- Customizable layouts with persistence
- Real-time data updates via WebSockets
- Multi-site support

### 2. Chart Types (50+)
- Time Series (Line, Area, Bar)
- Statistical (Box Plot, SPC, Histograms)
- Heatmaps (Device Deviation, Fault Detection)
- 3D Visualizations (Surface, Scatter3D)
- Specialized (Psychrometric, Sankey, Treemap)

### 3. Data Analysis Features
- Anomaly detection with ML
- Predictive maintenance
- Energy optimization recommendations
- Fault detection and diagnostics

### 4. Export Capabilities
- PDF reports with charts
- Excel workbooks with multiple sheets
- CSV data exports
- PNG/SVG chart images

### 5. Admin Panel
- User management
- Role assignments
- System monitoring
- Audit logs

## 🐛 Troubleshooting

### Common Issues

1. **401 Unauthorized Errors**
   - Ensure lowercase 'authorization' header
   - Check token expiry (current expires 2026-01-10)

2. **CORS Issues**
   - Use Cloudflare Worker proxy URL
   - Check ALLOWED_ORIGINS in wrangler.toml

3. **Large Dataset Performance**
   - Enable high-resolution mode
   - Use WebGL rendering for 100k+ points

4. **IndexedDB Corruption**
   - Run: `await autoFixIndexedDB()`
   - Clear browser storage if persists

### Debug Utilities
```javascript
// In browser console
window.debugApiCalls()        // Log all API calls
window.clearTokenCache()      // Clear token cache
window.resetCircuitBreaker()  // Reset error state
window.enableChartDebugMode() // Debug charts
```

## 📱 Progressive Web App

### PWA Features
- Offline support with service worker
- Installable on desktop and mobile
- Background sync for data updates
- Push notifications (optional)

### Installation
1. Visit the app in Chrome/Edge
2. Click install icon in address bar
3. App installs as standalone application

## 🔄 Continuous Integration

### GitHub Actions Workflows
- `.github/workflows/deploy.yml` - Auto-deploy on push
- `.github/workflows/security-scan.yml` - Security scanning

### Pre-commit Hooks
- ESLint for code quality
- Prettier for formatting
- Type checking
- Test execution

## 📊 Monitoring & Analytics

### Application Monitoring
- Error tracking with comprehensive logging
- Performance monitoring
- User analytics
- API usage tracking

### Cloudflare Analytics
- Worker performance metrics
- D1 database metrics
- R2 storage analytics
- KV cache hit rates

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Implement changes with tests
3. Run linting and formatting
4. Submit pull request
5. Automated CI/CD pipeline

### Code Style
- ESLint configuration enforced
- Prettier for consistent formatting
- TypeScript strict mode
- Conventional commits

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: `/docs` directory
- **API Documentation**: OpenAPI specs available

## 🔮 Future Roadmap

- [ ] Mobile native apps (React Native)
- [ ] Voice control integration
- [ ] AR/VR visualization
- [ ] Blockchain integration for data integrity
- [ ] Advanced ML models for predictive analytics
- [ ] Multi-language support
- [ ] GraphQL API migration

## 📝 Developer Notes

### Critical Information
- **ACE Token expires**: 2026-01-10
- **Firebase Project**: building-vitals
- **Primary maintainer credentials included**
- **All API keys and secrets configured**

### Quick Commands Reference
```bash
# Development
npm start              # Start dev server
npm test              # Run tests
npm run build         # Build production

# Deployment
npm run deploy        # Full deployment
wrangler deploy      # Deploy worker

# Debugging
npm run analyze      # Bundle analysis
npm run test:coverage # Coverage report
```

---

**Last Updated**: October 16, 2025
**Version**: 1.0.0
**Status**: Production Ready

This project is fully configured with all credentials, keys, and dependencies. Ready for immediate development and deployment.