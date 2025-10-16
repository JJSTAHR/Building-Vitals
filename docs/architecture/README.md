# Building Vitals - Architecture Documentation

## Token Management Architecture

This directory contains the complete architectural design for the Building Vitals token management system.

## Document Index

### 1. Executive Summary
**File**: [TOKEN_ARCHITECTURE_SUMMARY.md](./TOKEN_ARCHITECTURE_SUMMARY.md)

**Purpose**: High-level overview and quick reference

**Contents**:
- Architecture highlights
- Key features summary
- Implementation timeline
- Success criteria
- Quick reference guides

**Read this first** for a comprehensive overview.

---

### 2. Full Architecture Specification
**File**: [TOKEN_MANAGEMENT_ARCHITECTURE.md](./TOKEN_MANAGEMENT_ARCHITECTURE.md)

**Purpose**: Complete technical specification

**Contents**:
- System architecture overview (with ASCII diagrams)
- Component breakdown and interfaces
- Data models and schemas
- UI/UX flow designs
- API patterns and examples
- Security considerations
- Storage mechanisms
- Fallback strategies
- Multi-tenancy support
- Migration path (6-week plan)
- Performance considerations
- Monitoring and observability

**Read this** for complete architectural details.

---

### 3. Visual Diagrams
**File**: [TOKEN_ARCHITECTURE_DIAGRAMS.md](./TOKEN_ARCHITECTURE_DIAGRAMS.md)

**Purpose**: Visual representation of the architecture

**Contents**:
- System Context Diagram (C4 Level 1)
- Container Diagram (C4 Level 2)
- Component Diagram - Token Management Service
- Sequence Diagram - Adding a New Token
- Sequence Diagram - Token Expiry Handling
- Data Flow Diagram - Multi-Site Token Management
- State Machine - Token Lifecycle
- Security Architecture Diagram
- Deployment Architecture
- Performance Optimization Diagram

**Read this** for visual understanding of the system.

---

### 4. Implementation Guide
**File**: [TOKEN_IMPLEMENTATION_GUIDE.md](./TOKEN_IMPLEMENTATION_GUIDE.md)

**Purpose**: Practical implementation reference

**Contents**:
- Quick start checklist
- Phase-by-phase implementation guide
- Complete code examples for all services
- UI component implementations
- Testing checklist and examples
- Common integration patterns
- Troubleshooting guide
- Performance monitoring
- Security best practices
- Migration script
- Deployment steps

**Read this** when implementing the architecture.

---

## Quick Start Guide

### For Architects & Tech Leads
1. Read: **TOKEN_ARCHITECTURE_SUMMARY.md** (15 min)
2. Review: **TOKEN_ARCHITECTURE_DIAGRAMS.md** (10 min)
3. Study: **TOKEN_MANAGEMENT_ARCHITECTURE.md** (45 min)
4. **Total Time**: ~70 minutes for complete understanding

### For Developers
1. Skim: **TOKEN_ARCHITECTURE_SUMMARY.md** (5 min)
2. Focus on: **TOKEN_IMPLEMENTATION_GUIDE.md** (30 min)
3. Reference: **TOKEN_MANAGEMENT_ARCHITECTURE.md** as needed
4. **Total Time**: ~35 minutes to start implementing

### For Product/UX
1. Read: **TOKEN_ARCHITECTURE_SUMMARY.md** (15 min)
2. Focus on UI/UX sections in: **TOKEN_MANAGEMENT_ARCHITECTURE.md** (20 min)
3. Review: **TOKEN_ARCHITECTURE_DIAGRAMS.md** for user flows (10 min)
4. **Total Time**: ~45 minutes for UX understanding

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Token Management System                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         TokenManagerService (Singleton)            │    │
│  │  • Centralized token management                    │    │
│  │  • Multi-site support                              │    │
│  │  • Automatic expiry handling                       │    │
│  └────────────┬──────────────────────┬────────────────┘    │
│               │                      │                      │
│  ┌────────────▼─────────┐  ┌────────▼─────────────┐       │
│  │ TokenStorageService  │  │ TokenValidationService│       │
│  │ • IndexedDB storage  │  │ • JWT validation      │       │
│  │ • AES-GCM encryption │  │ • Expiry detection    │       │
│  └──────────────────────┘  └──────────────────────┘       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              API Interceptor Layer                 │    │
│  │  • Automatic token injection                       │    │
│  │  • Error handling & retry                          │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### ✅ Default Token Support
- Hardcode default site/device token in environment variables
- Automatic initialization on app startup
- Fallback to default when no custom tokens configured

### ✅ Multi-Site Management
- Store unlimited site tokens
- Easy switching between sites
- Visual status indicators (active/expired/invalid)
- Bulk import/export capabilities

### ✅ Automatic Token Injection
- Transparent middleware integration
- No manual token handling in components
- Automatic header injection on all API calls
- Retry logic with token refresh

### ✅ Expiration Handling
- Proactive expiry detection (7-day warning)
- Automatic scheduling of expiry checks
- User-friendly refresh dialogs
- Fallback to alternate tokens

### ✅ Secure Storage
- AES-GCM-256 encryption
- PBKDF2 key derivation (100k iterations)
- Device-bound encryption keys
- IndexedDB with LocalStorage fallback
- Secure deletion on logout

### ✅ Multi-Tenancy
- Tenant isolation
- Per-tenant token storage
- Cross-tenant access prevention

## Implementation Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | Week 1-2 | Core Services (TokenManager, Storage, Validation) |
| Phase 2 | Week 2-3 | API Integration (Interceptor, API clients) |
| Phase 3 | Week 3-4 | UI Components (Token management, dialogs) |
| Phase 4 | Week 4-5 | Backend Sync (Firestore, cross-device) |
| Phase 5 | Week 5-6 | Testing & Polish (Unit tests, E2E, security audit) |

**Total**: 6 weeks for complete implementation

## File Structure

After implementation, the token management code will be organized as:

```
src/
├── services/
│   └── token/
│       ├── TokenManagerService.ts         # Main service (singleton)
│       ├── TokenStorageService.ts         # IndexedDB + encryption
│       ├── TokenValidationService.ts      # JWT validation
│       ├── TokenEncryption.ts             # Web Crypto API wrapper
│       ├── tokenInterceptor.ts            # API middleware
│       └── index.ts                       # Public exports
│
├── components/
│   └── settings/
│       ├── TokenManager.tsx               # Enhanced token list UI
│       ├── TokenExpiryDialog.tsx          # Expiry handling dialog
│       ├── TokenRefreshPrompt.tsx         # Refresh notification
│       └── FirstTimeSetup.tsx             # Onboarding wizard
│
├── types/
│   └── token.types.ts                     # TypeScript interfaces
│
└── __tests__/
    ├── token/
    │   ├── TokenManagerService.test.ts
    │   ├── TokenStorageService.test.ts
    │   ├── TokenValidationService.test.ts
    │   └── TokenEncryption.test.ts
    └── integration/
        └── tokenWorkflows.test.ts
```

## Dependencies

### Required
- `idb` - IndexedDB wrapper with Promises
- Web Crypto API (native browser)
- `jwt-decode` - JWT parsing

### Optional
- `eventemitter3` - Event handling (if not using native EventEmitter)

## Security Considerations

- ✅ All tokens encrypted at rest (AES-GCM-256)
- ✅ Secure key derivation (PBKDF2, 100k iterations)
- ✅ Device-bound encryption keys
- ✅ No tokens in logs or console output
- ✅ Secure deletion on logout (multiple overwrite passes)
- ✅ Rate limiting per token
- ✅ Comprehensive audit logging
- ✅ Token rotation support
- ✅ Multi-tenant isolation
- ✅ HTTPS/TLS for all API communications

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Token retrieval (cached) | < 1ms | In-memory cache hit |
| Token retrieval (IndexedDB) | < 10ms | Cold read from storage |
| Token encryption | < 5ms | AES-GCM-256 with PBKDF2 |
| Token validation | < 2ms | JWT decode + format check |
| Bulk operations (100 tokens) | < 50ms | Parallel processing |

## Testing Strategy

### Unit Tests (95%+ coverage)
- TokenManagerService
- TokenStorageService
- TokenValidationService
- TokenEncryption

### Integration Tests
- Token add/update/delete flows
- Multi-site switching
- Expiry handling
- API integration

### E2E Tests
- First-time setup wizard
- Token refresh workflow
- Multi-site usage
- Error scenarios

### Security Tests
- Encryption/decryption
- Key derivation
- Secure deletion
- Token rotation

## Migration Plan

### Pre-Migration
1. Audit existing token usage
2. Backup all user tokens
3. Test migration script
4. Prepare rollback plan

### Migration
1. Deploy backend changes
2. Deploy frontend with feature flag
3. Enable for 10% of users
4. Monitor for 48 hours
5. Expand to 50% of users
6. Monitor for 24 hours
7. Enable for 100% of users

### Post-Migration
1. Monitor error logs (7 days)
2. Gather user feedback
3. Remove old token code
4. Final security audit

## Support & Resources

### Documentation
- Architecture docs (this directory)
- API documentation (auto-generated)
- User guide (for token management UI)

### References
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [JWT Standards](https://jwt.io/introduction)

### Contact
- Architecture questions: Review these documents
- Implementation help: Check TOKEN_IMPLEMENTATION_GUIDE.md
- Security concerns: Review security sections in TOKEN_MANAGEMENT_ARCHITECTURE.md

## Version History

### v1.0.0 (2025-01-15)
- Initial architecture design
- Complete documentation suite
- Implementation guide
- Visual diagrams
- Migration plan

---

## Next Steps

1. **Review Documents** (Day 1):
   - Read TOKEN_ARCHITECTURE_SUMMARY.md
   - Review TOKEN_ARCHITECTURE_DIAGRAMS.md
   - Study TOKEN_MANAGEMENT_ARCHITECTURE.md

2. **Plan Sprint** (Day 2):
   - Break down into user stories
   - Estimate effort
   - Assign tasks

3. **Begin Implementation** (Week 1):
   - Start with core services
   - Set up testing framework
   - Create type definitions

4. **Iterate & Test** (Weeks 2-5):
   - Implement features
   - Write tests continuously
   - Review security regularly

5. **Deploy Gradually** (Week 6):
   - Phased rollout
   - Monitor metrics
   - Gather feedback

---

**Status**: Architecture Design Complete ✅
**Ready for**: Implementation Phase
**Estimated Timeline**: 6 weeks
**Team Size**: 2-3 developers + 1 QA

---

## Unified Data Fetching Architecture

**Added:** 2025-10-13

This directory also contains the architectural design for unified data fetching across all chart types, ensuring consistent high-performance data handling.

### Document Index

#### 1. Architecture Overview
**File**: [UNIFIED_DATA_FETCHING_ARCHITECTURE.md](./UNIFIED_DATA_FETCHING_ARCHITECTURE.md)

**Purpose**: Complete architectural design for unified data fetching

**Contents**:
- Current state analysis
- Architecture vision and design goals
- Core design principles (Adapter, Strategy, Facade patterns)
- System architecture (C4 diagrams)
- Component design and interfaces
- Data flow diagrams
- Chart-specific transformation strategy
- ECharts optimization strategy
- Migration strategy (8-week plan)
- Best practices and guidelines
- Architecture Decision Records (ADRs)

**Read this** for complete understanding of the unified data fetching system.

---

#### 2. Chart Adapter Specification
**File**: [CHART_ADAPTER_SPECIFICATION.md](./CHART_ADAPTER_SPECIFICATION.md)

**Purpose**: Technical specification for chart adapters

**Contents**:
- Base adapter interface and abstract class
- Adapter implementations (TimeSeries, SPC, Economizer, Deviation, Gauge)
- Adapter registry and factory pattern
- Testing guidelines and examples
- Best practices for adapter development

**Read this** when creating custom chart adapters or extending existing ones.

---

#### 3. Migration Checklist
**File**: [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)

**Purpose**: Step-by-step migration guide

**Contents**:
- Pre-migration assessment checklist
- Phase-by-phase migration tasks
- Chart-specific migration steps
- Validation and testing procedures
- Cleanup and documentation tasks
- Rollback plan
- Migration status dashboard

**Read this** when migrating existing charts to the unified architecture.

---

#### 4. Developer Quick Start
**File**: [DEVELOPER_QUICK_START.md](./DEVELOPER_QUICK_START.md)

**Purpose**: Quick reference for developers

**Contents**:
- TL;DR golden rules
- Quick example for creating charts
- Common usage patterns
- Hook options reference
- Performance tips
- Common pitfalls and solutions
- Testing templates
- Debugging guide
- FAQ

**Read this** for quick implementation guidance.

---

### Quick Start Guide for Data Fetching Architecture

#### For Developers
1. Read: **DEVELOPER_QUICK_START.md** (15 min)
2. Reference: **CHART_ADAPTER_SPECIFICATION.md** as needed
3. **Total Time**: ~15-30 minutes to start building charts

#### For Architects & Tech Leads
1. Read: **UNIFIED_DATA_FETCHING_ARCHITECTURE.md** (45 min)
2. Review: **CHART_ADAPTER_SPECIFICATION.md** (20 min)
3. Study: **MIGRATION_CHECKLIST.md** (15 min)
4. **Total Time**: ~80 minutes for complete understanding

#### For Project Managers
1. Skim: **UNIFIED_DATA_FETCHING_ARCHITECTURE.md** (sections 1-2, 20 min)
2. Review: **MIGRATION_CHECKLIST.md** (10 min)
3. **Total Time**: ~30 minutes for project planning

---

### Unified Data Fetching Overview

```
┌─────────────────────────────────────────────────────────────┐
│              Unified Data Fetching System                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         useChartData Hook (Unified)                │    │
│  │  • Single source of truth for all charts          │    │
│  │  • Automatic pagination (raw_data=true)           │    │
│  │  • ECharts optimization config                    │    │
│  │  • MessagePack binary transfer (60% smaller)      │    │
│  └────────────┬──────────────────────┬────────────────┘    │
│               │                      │                      │
│  ┌────────────▼─────────┐  ┌────────▼─────────────┐       │
│  │ Chart Adapters       │  │ paginatedTimeseries  │       │
│  │ • SPC transformer    │  │ Service              │       │
│  │ • Economizer logic   │  │ • Cursor pagination  │       │
│  │ • Deviation calc     │  │ • Raw data fetch     │       │
│  └──────────────────────┘  └──────────┬───────────┘       │
│                                        │                    │
│                            ┌───────────▼───────────┐       │
│                            │ Cloudflare Worker     │       │
│                            │ • API proxy           │       │
│                            │ • Data transform      │       │
│                            │ • Cache optimization  │       │
│                            └───────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

#### ✅ Unified Data Fetching
- Single `useChartData` hook for ALL chart types
- Automatic pagination with `raw_data=true`
- Preserves actual collection intervals (30s, 1min, etc.)
- No forced 5-minute aggregation

#### ✅ High Performance
- MessagePack binary transfer (60% payload reduction)
- ECharts large dataset mode (>2000 points)
- Progressive rendering (>10000 points)
- WebGL acceleration (>50000 points)
- LTTB sampling (rendering only, data preserved)

#### ✅ Chart Adapters
- Isolated chart-specific transformations
- SPC control limit calculations
- Perfect economizer logic checks
- Deviation baseline comparisons
- Extensible for new chart types

#### ✅ Developer Experience
- Simple API, complex implementation hidden
- Automatic optimization configuration
- Type-safe interfaces
- Comprehensive documentation

### Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| useChartData hook | ✅ Implemented | `src/hooks/useChartData.ts` |
| paginatedTimeseriesService | ✅ Implemented | `src/services/paginatedTimeseriesService.ts` |
| MessagePack support | ✅ Implemented | Integrated in service |
| ECharts optimization | ✅ Implemented | Lines 570-577 in useChartData |
| Chart Adapters | 📋 Designed | To be implemented |
| useBaseChartOptions hook | 📋 Designed | To be implemented |
| Migration | 📋 Planned | 8-week timeline |

### Implementation Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 0 | Week 1 | Discovery & audit |
| Phase 1 | Weeks 2-3 | Foundation (adapters, config) |
| Phase 2 | Weeks 4-6 | Migration (by priority) |
| Phase 3 | Week 7 | Validation & testing |
| Phase 4 | Week 8 | Cleanup & documentation |

**Total**: 8 weeks for complete migration

### Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Load time (1K points) | < 100ms | ~50ms | ✅ |
| Load time (10K points) | < 500ms | ~200ms | ✅ |
| Load time (100K points) | < 2s | ~800ms | ✅ |
| Payload reduction | 60% | 60% (MessagePack) | ✅ |
| Memory (100K points) | < 100MB | ~80MB | ✅ |
| Rendering FPS | 60fps | 60fps | ✅ |

### File Structure After Implementation

```
src/
├── hooks/
│   ├── useChartData.ts                ✅ Existing (compliant)
│   └── useBaseChartOptions.ts         🆕 To be created
│
├── services/
│   └── paginatedTimeseriesService.ts  ✅ Existing (compliant)
│
├── adapters/                          🆕 NEW
│   └── chart-adapters/
│       ├── BaseChartAdapter.ts        🆕 Abstract base
│       ├── TimeSeriesAdapter.ts       🆕 Default (pass-through)
│       ├── SPCChartAdapter.ts         🆕 SPC control limits
│       ├── EconomizerAdapter.ts       🆕 Economizer logic
│       ├── DeviationAdapter.ts        🆕 Deviation calculations
│       ├── GaugeAdapter.ts            🆕 Gauge/current value
│       └── index.ts                   🆕 Registry
│
├── config/
│   └── chartDataConfig.ts             🆕 Global configuration
│
└── components/
    └── charts/
        ├── EChartsSPCChart.tsx        📝 To be migrated
        ├── EChartsPerfectEconomizer.tsx 📝 To be migrated
        └── ...                        📝 Other charts
```

### Dependencies

#### Required
- `@tanstack/react-query` - Data fetching and caching
- `echarts` - Chart rendering
- `msgpack-lite` - Binary data transfer

#### Optional
- `echarts-gl` - WebGL acceleration for extreme datasets

### References

#### Internal Documentation
- [ACE API Integration Guide](../ACE_API_INTEGRATION_GUIDE.md)
- [Paginated Endpoint Spec](../specs/PAGINATED_ENDPOINT_SPEC.md)
- [Cloudflare Chart Enhancements](../CLOUDFLARE_CHART_ENHANCEMENTS.md)

#### External Resources
- [ECharts Documentation](https://echarts.apache.org/)
- [ECharts Large Dataset Optimization](https://echarts.apache.org/en/tutorial.html#Dataset)
- [MessagePack Specification](https://msgpack.org/)
- [React Query Documentation](https://tanstack.com/query/latest)

---

**Unified Data Fetching Architecture Status**: Design Complete ✅
**Ready for**: Implementation Phase
**Estimated Timeline**: 8 weeks
**Team Size**: 2-3 developers + 1 QA
