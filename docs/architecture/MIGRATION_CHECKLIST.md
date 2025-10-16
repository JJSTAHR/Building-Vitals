# Migration Checklist: Unified Data Fetching Architecture

**Version:** 1.0
**Date:** 2025-10-13
**Purpose:** Step-by-step checklist for migrating charts to unified architecture

---

## Pre-Migration Assessment

### Phase 0: Discovery

- [ ] **Chart Inventory**
  - [ ] List all chart components in codebase
  - [ ] Identify charts using `useChartData` (compliant)
  - [ ] Identify charts with custom data fetching (non-compliant)
  - [ ] Document current data fetching patterns per chart

- [ ] **Data Analysis**
  - [ ] Measure typical data point counts per chart type
  - [ ] Identify charts handling >10,000 points
  - [ ] Document current collection intervals (30s, 1min, 5min)
  - [ ] Verify if any charts are aggregating data

- [ ] **Performance Baseline**
  - [ ] Measure current load times for each chart
  - [ ] Profile memory usage
  - [ ] Record rendering frame rates
  - [ ] Document user-reported issues

**Deliverable:** `CHART_AUDIT.md` report

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Configuration Setup

- [ ] **Create Configuration Files**
  - [ ] `src/config/chartDataConfig.ts` with global defaults
  - [ ] ECharts optimization presets
  - [ ] Chart type specific configurations
  - [ ] Performance threshold definitions

- [ ] **Create Base Adapter**
  - [ ] `src/adapters/chart-adapters/BaseChartAdapter.ts`
  - [ ] Implement validation logic
  - [ ] Add helper methods (detectInterval, countPoints)
  - [ ] Write unit tests for base adapter

### 1.2 Adapter Implementation

- [ ] **TimeSeriesAdapter**
  - [ ] Implement `transform()` method
  - [ ] Pass-through logic (no modification)
  - [ ] Unit tests with 1K, 10K, 100K points

- [ ] **SPCChartAdapter**
  - [ ] Implement control limit calculations
  - [ ] Add violation detection
  - [ ] Support for multiple SPC rules
  - [ ] Unit tests with edge cases

- [ ] **EconomizerAdapter**
  - [ ] Implement economizer logic checks
  - [ ] Timestamp alignment across multiple points
  - [ ] Efficiency calculation
  - [ ] Unit tests with real-world scenarios

- [ ] **DeviationAdapter**
  - [ ] Baseline comparison logic
  - [ ] Deviation calculation
  - [ ] Statistical analysis
  - [ ] Unit tests

- [ ] **GaugeAdapter**
  - [ ] Current value extraction
  - [ ] Min/max range determination
  - [ ] Threshold indicators
  - [ ] Unit tests

### 1.3 Hook Enhancement

- [ ] **Enhance `useChartData`**
  - [ ] Add `chartType` option
  - [ ] Integrate adapter selection logic
  - [ ] Add ECharts config generation
  - [ ] Expose metadata in return value

- [ ] **Create `useBaseChartOptions`**
  - [ ] Automatic optimization based on data size
  - [ ] Chart type specific overrides
  - [ ] WebGL mode for large datasets
  - [ ] Unit tests

### 1.4 Registry Setup

- [ ] **Adapter Registry**
  - [ ] `src/adapters/chart-adapters/index.ts`
  - [ ] `getChartAdapter()` factory function
  - [ ] `registerChartAdapter()` for extensibility
  - [ ] Documentation

---

## Phase 2: Migration (Week 3-5)

### 2.1 High Priority Charts

#### Deviation Heatmap
- [ ] **Pre-Migration**
  - [ ] Document current implementation
  - [ ] Identify data fetching method
  - [ ] Measure baseline performance

- [ ] **Migration**
  - [ ] Replace data fetching with `useChartData`
  - [ ] Apply `DeviationAdapter`
  - [ ] Integrate `useBaseChartOptions`
  - [ ] Add ECharts optimization config

- [ ] **Validation**
  - [ ] Visual regression test
  - [ ] Performance comparison
  - [ ] Test with 100K+ points
  - [ ] User acceptance testing

#### SPC Charts
- [ ] **Pre-Migration**
  - [ ] Document control limit calculations
  - [ ] Identify violation rules
  - [ ] Baseline performance

- [ ] **Migration**
  - [ ] Use `useChartData` with `chartType: 'spc'`
  - [ ] Configure SPCAdapter options
  - [ ] Verify control limit accuracy
  - [ ] Preserve all violation detection

- [ ] **Validation**
  - [ ] Compare control limits with legacy
  - [ ] Verify all violations detected
  - [ ] Performance benchmarks

#### High-Resolution TimeSeries
- [ ] **Pre-Migration**
  - [ ] Verify current interval preservation
  - [ ] Document aggregation (if any)
  - [ ] Baseline metrics

- [ ] **Migration**
  - [ ] Ensure `raw_data=true` enforcement
  - [ ] Add large dataset optimizations
  - [ ] Progressive rendering config
  - [ ] MessagePack binary transfer

- [ ] **Validation**
  - [ ] Verify no data loss
  - [ ] Test 365-day queries
  - [ ] Measure load time improvement

### 2.2 Medium Priority Charts

#### Perfect Economizer
- [ ] Pre-Migration assessment
- [ ] Migration to `useChartData` + `EconomizerAdapter`
- [ ] Validation & testing

#### Time Series (General)
- [ ] Pre-Migration assessment
- [ ] Migration to `useChartData` + `TimeSeriesAdapter`
- [ ] Validation & testing

#### Gauge Charts
- [ ] Pre-Migration assessment
- [ ] Migration to `useChartData` + `GaugeAdapter`
- [ ] Validation & testing

### 2.3 Low Priority Charts

#### Calendar Heatmap
- [ ] Pre-Migration assessment
- [ ] Migration (custom adapter if needed)
- [ ] Validation & testing

#### Box Plot
- [ ] Pre-Migration assessment
- [ ] Migration
- [ ] Validation & testing

#### Specialized Charts
- [ ] Candlestick
- [ ] Sankey
- [ ] Treemap
- [ ] Radar
- [ ] Psychrometric

---

## Phase 3: Validation (Week 6)

### 3.1 Automated Testing

- [ ] **Unit Tests**
  - [ ] All adapters have 90%+ coverage
  - [ ] Edge cases handled
  - [ ] Error scenarios tested

- [ ] **Integration Tests**
  - [ ] End-to-end chart rendering
  - [ ] Data flow from API to chart
  - [ ] Error handling and recovery

- [ ] **Performance Tests**
  - [ ] Load time benchmarks (1K, 10K, 100K, 500K points)
  - [ ] Memory profiling
  - [ ] Rendering frame rate
  - [ ] Network payload size

### 3.2 Visual Regression Testing

- [ ] **Screenshot Comparison**
  - [ ] Capture before/after screenshots
  - [ ] Automated diff detection
  - [ ] Review differences

- [ ] **Cross-Browser Testing**
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge

### 3.3 User Acceptance Testing

- [ ] **Beta Testing**
  - [ ] Deploy to staging environment
  - [ ] Invite beta testers
  - [ ] Collect feedback

- [ ] **Performance Validation**
  - [ ] Verify load time improvements
  - [ ] Check memory usage
  - [ ] Confirm smooth rendering

---

## Phase 4: Cleanup (Week 7)

### 4.1 Code Removal

- [ ] **Delete Deprecated Code**
  - [ ] Old data fetching hooks
  - [ ] Unused service functions
  - [ ] Legacy transformation utilities

- [ ] **Update Imports**
  - [ ] Find and replace old imports
  - [ ] Update barrel exports
  - [ ] Clean up unused dependencies

### 4.2 Documentation

- [ ] **Update Documentation**
  - [ ] Architecture diagrams
  - [ ] API documentation
  - [ ] Code comments
  - [ ] README files

- [ ] **Create Guides**
  - [ ] Developer guide for new charts
  - [ ] Best practices document
  - [ ] Troubleshooting guide
  - [ ] Performance optimization tips

### 4.3 Communication

- [ ] **Team Communication**
  - [ ] Send migration summary email
  - [ ] Present findings in team meeting
  - [ ] Update design system docs

- [ ] **User Communication**
  - [ ] Release notes
  - [ ] Blog post (if applicable)
  - [ ] User guide updates

---

## Post-Migration Monitoring

### Week 8-12: Observability

- [ ] **Performance Monitoring**
  - [ ] Set up dashboards for load times
  - [ ] Track error rates
  - [ ] Monitor memory usage
  - [ ] Measure API call reduction

- [ ] **User Feedback**
  - [ ] Collect feedback via support channels
  - [ ] Monitor app analytics
  - [ ] Identify any regressions

- [ ] **Optimization**
  - [ ] Address performance bottlenecks
  - [ ] Tune ECharts configurations
  - [ ] Optimize hot paths

---

## Success Criteria

### Functional Requirements
- [x] All charts use `useChartData` hook
- [x] 100% use paginated endpoint with `raw_data=true`
- [x] ECharts optimizations applied automatically
- [x] Zero visual regressions
- [x] All existing features preserved

### Performance Requirements
- [x] Load time: ≤ current performance (ideally improved)
- [x] Memory: ≤ current usage (ideally reduced)
- [x] 100K+ points render smoothly (60fps)
- [x] 365-day queries complete successfully

### Quality Requirements
- [x] 90%+ unit test coverage for adapters
- [x] Integration tests pass
- [x] Visual regression tests pass
- [x] Cross-browser compatibility verified

### Developer Experience
- [x] Documentation complete and clear
- [x] Simple API for chart developers
- [x] Easy to add new chart types
- [x] Best practices guide available

---

## Rollback Plan

### If Migration Fails

**Trigger Conditions:**
- Performance degradation >20%
- User-reported bugs >10 per week
- Visual regressions affecting core features
- Memory issues causing crashes

**Rollback Steps:**
1. [ ] Revert git commits to pre-migration state
2. [ ] Deploy previous version to production
3. [ ] Notify team of rollback
4. [ ] Document issues encountered
5. [ ] Create action plan for retry

**Post-Rollback:**
1. [ ] Root cause analysis
2. [ ] Fix issues in development
3. [ ] Re-test thoroughly
4. [ ] Plan new migration date

---

## Migration Status Dashboard

| Chart Type | Status | Assigned | Completion Date | Notes |
|------------|--------|----------|-----------------|-------|
| Deviation Heatmap | ⏳ Pending | - | - | High priority |
| SPC Chart | ⏳ Pending | - | - | High priority |
| Time Series | ⏳ Pending | - | - | High priority |
| Perfect Economizer | ⏳ Pending | - | - | Medium priority |
| Gauge Chart | ⏳ Pending | - | - | Medium priority |
| Calendar Heatmap | ⏳ Pending | - | - | Low priority |
| Box Plot | ⏳ Pending | - | - | Low priority |

**Legend:**
- ⏳ Pending
- 🚧 In Progress
- ✅ Complete
- ⚠️ Blocked
- ❌ Failed

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
**Owner:** Architecture Team
