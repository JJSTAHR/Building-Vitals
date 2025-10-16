# Chart Configuration Workflow Completeness Scorecard

**Review Date**: 2025-10-16
**Total Chart Types Reviewed**: 23
**Codebase**: Building Vitals - Chart Wizard & Unified Renderer

---

## Executive Summary

### Overall Findings
- **Workflow Consistency**: Highly variable across chart types
- **Critical Gaps**: 9 charts have incomplete or broken workflows
- **User Frustration Risk**: HIGH for advanced chart types
- **Best Practices**: Only 6 charts have complete end-to-end workflows

### Workflow Completion Rate by Phase
| Phase | Complete | Partial | Missing | Broken |
|-------|----------|---------|---------|--------|
| 1. Discovery | 23 | 0 | 0 | 0 |
| 2. Selection | 23 | 0 | 0 | 0 |
| 3. Configuration | 6 | 8 | 9 | 0 |
| 4. Validation | 10 | 8 | 5 | 0 |
| 5. Preview | 0 | 0 | 23 | 0 |
| 6. Creation | 23 | 0 | 0 | 0 |
| 7. Adjustment | 0 | 0 | 23 | 0 |

---

## Chart Type Workflow Ratings

### Legend
- ★★★★★ (5 stars): Complete, intuitive, well-documented
- ★★★★☆ (4 stars): Mostly complete with minor gaps
- ★★★☆☆ (3 stars): Functional but missing key features
- ★★☆☆☆ (2 stars): Major workflow gaps
- ★☆☆☆☆ (1 star): Severely incomplete or broken

---

## 1. TIME SERIES CHARTS

### TimeSeries (Line Chart) ★★★★★
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Clear categorization, excellent tooltips |
| Selection | ★★★★★ | Complete | Unified point selector with marker tags |
| Configuration | ★★★★★ | Complete | Aggregation, legend, grid, Y-axis label |
| Validation | ★★★★★ | Complete | Min 1 point required, enforced |
| Preview | ★☆☆☆☆ | Missing | No live preview before creation |
| Creation | ★★★★★ | Complete | Renders correctly via UnifiedChartRenderer |
| Adjustment | ★☆☆☆☆ | Missing | No edit-after-creation UI |

**User Journey**: Excellent. This is the gold standard workflow.

---

### AreaChart (Overlapping) ★★★★★
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Clear distinction from StackedArea |
| Selection | ★★★★★ | Complete | Standard point selector |
| Configuration | ★★★★☆ | Complete | Uses standard config, could clarify overlapping behavior |
| Validation | ★★★★★ | Complete | Min 1 point required |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders correctly |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Excellent. Users understand overlapping vs stacked.

---

### StackedArea ★★★★★
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Clear use cases (cumulative totals) |
| Selection | ★★★★★ | Complete | Standard point selector |
| Configuration | ★★★★★ | Complete | Automatic stacking applied |
| Validation | ★★★★★ | Complete | Min 1 point required |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders with stacking |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Excellent. Clear guidance on part-to-whole relationships.

---

### Bar Chart ★★★★★
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Time-based comparison clear |
| Selection | ★★★★★ | Complete | Standard selector |
| Configuration | ★★★★★ | Complete | Aggregation settings (latest) |
| Validation | ★★★★★ | Complete | Min 1 point required |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders correctly |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Excellent. Aggregation defaults work well.

---

## 2. STATISTICAL CHARTS

### Scatter Plot ★★★★☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Clear correlation use cases |
| Selection | ★★★★★ | Complete | Enforces exactly 2 points |
| Configuration | ★★★★★ | Complete | **X-axis & Y-axis point selection UI present** (lines 3470-3531) |
| Validation | ★★★★★ | Complete | Validates 2 points selected |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders X vs Y correctly |
| Adjustment | ★☆☆☆☆ | Missing | Cannot change axis assignments after creation |

**User Journey**: Very Good. Axis selection is clear during wizard.

**Critical Finding**: Scatter plot HAS axis selection UI - users choose which point is X and which is Y.

---

### BoxPlot ★★☆☆☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Statistical distribution clear |
| Selection | ★★★★★ | Complete | Min 1 point |
| Configuration | ★☆☆☆☆ | **Missing** | **No aggregation settings UI** |
| Validation | ★★★☆☆ | Partial | No guidance on data requirements |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★☆ | Likely Works | Component exists but untested |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Poor. Users don't know how data will be aggregated.

**Critical Gap**: BoxPlot needs to explain:
- How are quartiles calculated?
- What aggregation period? (daily, hourly?)
- How to configure outlier detection threshold?

---

### Candlestick ★★☆☆☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Daily range use case clear |
| Selection | ★★★★☆ | Partial | Min 1 point, but needs 4 values (OHLC) |
| Configuration | ★☆☆☆☆ | **Missing** | **No aggregation period UI** |
| Validation | ★★☆☆☆ | Weak | Doesn't validate OHLC structure |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★☆☆ | Unknown | Component exists but format unclear |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Poor. Users won't understand how single point becomes OHLC.

**Critical Gap**: Needs to explain:
- Aggregation period selection (daily, hourly, 15-min)
- How Open/High/Low/Close are calculated from timeseries

---

### ParallelCoordinates ★★☆☆☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Multi-variable comparison clear |
| Selection | ★★★★★ | Complete | Min 3 points enforced |
| Configuration | ★☆☆☆☆ | **Missing** | **No dimension ordering UI** |
| Validation | ★★★★☆ | Good | Enforces 3+ points |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★☆☆ | Unknown | Component exists, order unclear |
| Adjustment | ★☆☆☆☆ | Missing | Cannot reorder dimensions |

**User Journey**: Poor. Dimension order matters but isn't configurable.

**Critical Gap**: Needs:
- Drag-and-drop dimension ordering
- Normalization settings (0-100 vs actual ranges)
- Axis inversion options

---

### Radar Chart ★★☆☆☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | KPI comparison clear |
| Selection | ★★★★★ | Complete | Min 3 metrics enforced |
| Configuration | ★☆☆☆☆ | **Missing** | **No normalization settings UI** |
| Validation | ★★★★☆ | Good | Enforces 3+ metrics |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★☆☆ | Unknown | Component exists |
| Adjustment | ★☆☆☆☆ | Missing | Cannot adjust normalization |

**User Journey**: Poor. Metrics with different scales (0-100 vs 0-1000) won't display well.

**Critical Gap**: Needs:
- Normalization method (min-max, z-score, percentage)
- Custom range per metric
- Benchmark value configuration

---

## 3. PATTERN ANALYSIS CHARTS

### Heatmap ★★★★★
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Hour/day patterns clear |
| Selection | ★★★★★ | Complete | Standard selector |
| Configuration | ★★★★☆ | Good | Color scale auto-applied |
| Validation | ★★★★★ | Complete | Min 1 point |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders correctly |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Excellent. Auto-aggregation to hour/day works well.

---

### DeviceDeviationHeatmap ★★★★★
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Target deviation clear |
| Selection | ★★★★★ | Complete | Min 1 point |
| Configuration | ★★★★★ | **Complete** | **Embedded UI with tabs, target/range modes** (lines 2828-3300) |
| Validation | ★★★★★ | Complete | Requires configuration before creation |
| Preview | ★★★☆☆ | Partial | Color gradient preview shown |
| Creation | ★★★★★ | Complete | Renders with custom configs |
| Adjustment | ★★★☆☆ | Partial | Config persisted but no edit UI |

**User Journey**: Excellent. This is the BEST configured chart type.

**Best Practice**: Target/range mode, sensitivity presets, visual color preview all present.

---

### CalendarHeatmap ★★★★☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Monthly patterns clear |
| Selection | ★★★★★ | Complete | Standard selector |
| Configuration | ★★★☆☆ | Partial | Auto-aggregation, no customization |
| Validation | ★★★★★ | Complete | Min 1 point |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders correctly |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Very Good. Works well with defaults.

---

### CalendarYearHeatmap ★★★★☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Full year view clear |
| Selection | ★★★★★ | Complete | Exactly 1 point enforced |
| Configuration | ★★★☆☆ | Partial | Auto-aggregation to days |
| Validation | ★★★★★ | Complete | Enforces 1 point only |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders year view |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Very Good. Single point restriction makes sense.

---

## 4. HVAC DIAGNOSTICS CHARTS

### Psychrometric Chart ★★★★☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Air conditions clear |
| Selection | ★★★★★ | Complete | Exactly 2 points (temp + humidity) with guidance |
| Configuration | ★★★★★ | **Complete** | **Temperature unit (F/C) and comfort zone toggle** (lines 2796-2826) |
| Validation | ★★★★★ | Complete | Validates temp + humidity/dewpoint |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders psychrometric chart |
| Adjustment | ★☆☆☆☆ | Missing | Cannot change temp unit after creation |

**User Journey**: Excellent. Point type hints help users find right sensors.

**Best Practice**: Clear point type requirements (temperature vs humidity).

---

### PerfectEconomizer ★★★★★
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Free cooling analysis clear |
| Selection | ★★★★★ | Complete | OAT + MAT required, RAT optional, with marker tag hints |
| Configuration | ★★★★★ | **Complete** | **Full economizer settings UI** (lines 2714-2795) |
| Validation | ★★★★★ | Complete | Validates required points |
| Preview | ★★☆☆☆ | Partial | Configuration summary shown |
| Creation | ★★★★★ | Complete | Renders economizer zones |
| Adjustment | ★☆☆☆☆ | Missing | Cannot adjust setpoints after creation |

**User Journey**: Excellent. Default setpoints work for most AHUs.

**Best Practice**: Provides defaults (55°F MAT, 20% min OA, 75°F high limit).

---

### VAVComprehensive ★★★★☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | 7-point diagnostic clear |
| Selection | ★★★★★ | Complete | Exactly 7 points with clear ordering |
| Configuration | ★★★☆☆ | Auto | No UI needed - chart handles internally |
| Validation | ★★★★★ | Complete | Enforces 7 points in correct order |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders all diagnostics |
| Adjustment | ★☆☆☆☆ | Missing | Cannot reorder points |

**User Journey**: Very Good. Point order description is excellent.

---

### ChilledWaterReset ★★★★☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Load-based reset clear |
| Selection | ★★★★★ | Complete | Min 3 points (supply, return, load) |
| Configuration | ★★★★★ | **Complete** | **Full reset strategy UI** (lines 3764-3868) |
| Validation | ★★★★★ | Complete | Validates required points |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders reset curves |
| Adjustment | ★☆☆☆☆ | Missing | Cannot change strategy after creation |

**User Journey**: Excellent. Reset strategy selection is clear.

---

### DPOptimization ★★★★☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Pressure optimization clear |
| Selection | ★★★★★ | Complete | Min 2 points (DP + status) |
| Configuration | ★★★★★ | **Complete** | **DP setpoint and trim-respond settings** (lines 3869-3973) |
| Validation | ★★★★★ | Complete | Validates required points |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders optimization zones |
| Adjustment | ★☆☆☆☆ | Missing | Cannot adjust setpoints |

**User Journey**: Excellent. Default ranges work for most systems.

---

### SimultaneousHC ★★★★☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Energy waste detection clear |
| Selection | ★★★★★ | Complete | Exactly 2 points (heating + cooling) |
| Configuration | ★★★★★ | **Complete** | **Threshold settings for detection** (lines 3974-4078) |
| Validation | ★★★★★ | Complete | Validates heating + cooling points |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders fault detection |
| Adjustment | ★☆☆☆☆ | Missing | Cannot adjust thresholds |

**User Journey**: Excellent. Threshold defaults are sensible.

---

## 5. ADVANCED ANALYTICS CHARTS

### TimelineChart ★★★☆☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Animation concept clear |
| Selection | ★★★★★ | Complete | Min 1 point |
| Configuration | ★☆☆☆☆ | **Missing** | **No playback speed or date range UI** |
| Validation | ★★★☆☆ | Partial | No validation of time range |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★☆☆ | Unknown | Component exists |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: Poor. Users don't know how to control playback.

**Critical Gap**: Needs playback controls configuration.

---

## 6. FLOW & HIERARCHY CHARTS

### Sankey Diagram ★☆☆☆☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Flow visualization clear |
| Selection | ★★★★☆ | Partial | Min 2 points, but no source/target guidance |
| Configuration | ★☆☆☆☆ | **Missing** | **No source/target relationship UI** |
| Validation | ★☆☆☆☆ | **Broken** | Cannot validate without relationship config |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★☆☆☆☆ | **Will Fail** | No way to define which points are sources vs targets |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: BROKEN. This chart cannot be created successfully.

**Critical Failure**: Sankey needs hierarchical relationships:
- Which points are sources?
- Which points are targets?
- How do they connect?
- Current implementation: Just selects points with no structure.

**Recommendation**: Either build full relationship UI or remove this chart type.

---

### Treemap ★☆☆☆☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Hierarchical comparison clear |
| Selection | ★★★★☆ | Partial | Min 1 point, no hierarchy guidance |
| Configuration | ★☆☆☆☆ | **Missing** | **No hierarchy/grouping UI** |
| Validation | ★★☆☆☆ | Weak | No validation of hierarchical structure |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★☆☆☆ | **Likely Fails** | No way to define parent-child relationships |
| Adjustment | ★☆☆☆☆ | Missing | No edit UI |

**User Journey**: BROKEN. Treemap needs hierarchical structure.

**Critical Failure**: Treemap needs:
- Building → Floor → Zone → Equipment hierarchy
- Current implementation: Flat list of points

**Recommendation**: Build grouping UI or remove chart type.

---

## 7. GAUGE CHART

### Gauge Chart ★★★☆☆
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Single value display clear |
| Selection | ★★★★★ | Complete | Single point |
| Configuration | ★★★☆☆ | **Partial** | **Default ranges provided** (lines 1404-1413) |
| Validation | ★★★★☆ | Good | Single point enforced |
| Preview | ★☆☆☆☆ | Missing | No preview |
| Creation | ★★★★★ | Complete | Renders with ranges |
| Adjustment | ★☆☆☆☆ | Missing | Cannot change min/max/target after creation |

**User Journey**: Good. Default ranges (0-70 normal, 70-85 warning, 85-100 critical) work for percentages.

**Gap**: No UI to customize min/max/target during wizard - only defaults applied.

---

## 8. CONTROL BAND CHART

### ControlBand (formerly SPC) ★★★★★
| Phase | Rating | Status | Notes |
|-------|--------|--------|-------|
| Discovery | ★★★★★ | Complete | Operating limits clear |
| Selection | ★★★★★ | Complete | Standard selector |
| Configuration | ★★★★★ | **Complete** | **Full limits UI with visual helper** (lines 3538-3763) |
| Validation | ★★★★★ | Complete | Requires upper/lower limits |
| Preview | ★★★☆☆ | Partial | Visual range helper shown |
| Creation | ★★★★★ | Complete | Renders control zones |
| Adjustment | ★☆☆☆☆ | Missing | Cannot edit limits after creation |

**User Journey**: Excellent. VisualRangeHelper provides intuitive limit setting.

**Best Practice**: Clear upper/lower/target configuration with visual feedback.

---

## SUMMARY SCORECARD

### Complete Workflows (★★★★★ or ★★★★☆)
1. **TimeSeries** - Gold standard
2. **AreaChart** - Excellent
3. **StackedArea** - Excellent
4. **Bar Chart** - Excellent
5. **Heatmap** - Excellent
6. **DeviceDeviationHeatmap** - Best in class configuration
7. **Psychrometric** - Excellent
8. **PerfectEconomizer** - Excellent with defaults
9. **ControlBand** - Excellent with visual helper
10. **ChilledWaterReset** - Excellent HVAC config
11. **DPOptimization** - Excellent HVAC config
12. **SimultaneousHC** - Excellent HVAC config

### Partial Workflows (★★★☆☆)
13. **CalendarHeatmap** - Missing customization
14. **CalendarYearHeatmap** - Missing customization
15. **VAVComprehensive** - Works well with fixed structure
16. **Gauge** - Has defaults but no customization UI
17. **TimelineChart** - Missing playback controls

### Broken Workflows (★★☆☆☆ or ★☆☆☆☆)
18. **BoxPlot** - Missing aggregation UI
19. **Candlestick** - Missing OHLC period UI
20. **ParallelCoordinates** - Missing dimension ordering
21. **Radar** - Missing normalization
22. **Scatter** - Actually GOOD (has axis selection)
23. **Sankey** - BROKEN (no relationship UI)
24. **Treemap** - BROKEN (no hierarchy UI)

---

## CRITICAL GAPS BY PRIORITY

### P0 - Broken Workflows (Chart Cannot Be Created)
1. **Sankey Diagram**
   - **Issue**: No source/target relationship configuration
   - **Impact**: Chart will render incorrectly or fail
   - **Fix Required**: Build flow relationship UI or remove chart type
   - **User Frustration**: CRITICAL

2. **Treemap**
   - **Issue**: No hierarchy/grouping configuration
   - **Impact**: Flat display instead of hierarchical
   - **Fix Required**: Build grouping UI or remove chart type
   - **User Frustration**: CRITICAL

### P1 - Major Workflow Gaps (Confusing/Incorrect Results)
3. **BoxPlot**
   - **Issue**: No aggregation period configuration
   - **Impact**: Users don't know what quartiles represent
   - **Fix Required**: Add aggregation period selector (hourly/daily/weekly)
   - **User Frustration**: HIGH

4. **Candlestick**
   - **Issue**: No OHLC aggregation period
   - **Impact**: Unclear how single point becomes candles
   - **Fix Required**: Add period selector (15min/hourly/daily)
   - **User Frustration**: HIGH

5. **ParallelCoordinates**
   - **Issue**: No dimension ordering
   - **Impact**: Chart may be hard to read with poor ordering
   - **Fix Required**: Add drag-drop dimension reordering
   - **User Frustration**: MEDIUM-HIGH

6. **Radar Chart**
   - **Issue**: No normalization configuration
   - **Impact**: Metrics with different scales won't display well
   - **Fix Required**: Add normalization options (min-max, z-score, %)
   - **User Frustration**: MEDIUM-HIGH

### P2 - Missing Customization (Works but Not Configurable)
7. **Gauge Chart**
   - **Issue**: No min/max/target UI, only defaults
   - **Impact**: Fixed 0-100 range with 70/85 thresholds
   - **Fix Required**: Add range customization in wizard
   - **User Frustration**: MEDIUM

8. **TimelineChart**
   - **Issue**: No playback speed/range controls
   - **Impact**: User cannot control animation
   - **Fix Required**: Add playback configuration
   - **User Frustration**: MEDIUM

### P3 - Missing Preview & Adjustment
9. **ALL CHARTS**
   - **Issue**: No preview before creation
   - **Impact**: User must create chart to see result
   - **Fix Required**: Add preview panel in wizard
   - **User Frustration**: MEDIUM (affects all users)

10. **ALL CHARTS**
    - **Issue**: No edit-after-creation UI
    - **Impact**: Must delete and recreate to change config
    - **Fix Required**: Add "Edit Chart Configuration" modal
    - **User Frustration**: HIGH (affects all users)

---

## RECOMMENDATIONS

### Immediate Actions (Sprint 1)
1. **Remove or Fix Broken Charts**
   - Remove Sankey and Treemap from wizard OR
   - Build minimal relationship UI for both

2. **Add Missing Configuration UIs**
   - BoxPlot: Aggregation period dropdown
   - Candlestick: OHLC period dropdown
   - Gauge: Min/Max/Target number inputs

3. **Improve Validation Messages**
   - BoxPlot: "Quartiles will be calculated per [period]"
   - Candlestick: "Candles will show [period] high/low/open/close"
   - Radar: "Warning: Metrics with different scales may not display well"

### Medium-Term (Sprint 2-3)
4. **Add Chart Preview Panel**
   - Live preview in wizard Step 4 (before creation)
   - Shows sample data or last 100 points
   - Updates as config changes

5. **Build Edit Configuration Modal**
   - Accessible from chart toolbar (Edit button)
   - Reuses wizard Step 4 configuration panels
   - Updates chart without recreation

6. **Advanced Chart Features**
   - ParallelCoordinates: Dimension reordering
   - Radar: Normalization options
   - TimelineChart: Playback controls

### Long-Term (Sprint 4+)
7. **Configuration Templates**
   - Save chart configurations as templates
   - Quick apply to similar charts
   - Share templates across team

8. **Chart Suggestions**
   - AI-powered chart type recommendations
   - Based on selected points and use case
   - "You selected temp + humidity → Psychrometric?"

---

## BEST PRACTICES TO REPLICATE

From **DeviceDeviationHeatmap** (best in class):
- ✅ Embedded configuration UI with tabs for multiple points
- ✅ Mode selection (target vs range)
- ✅ Preset buttons (Tight/Normal/Relaxed)
- ✅ Fine-tune slider for sensitivity
- ✅ Visual color preview
- ✅ Configuration persistence

From **PerfectEconomizer**:
- ✅ Sensible defaults that work for 80% of cases
- ✅ Configuration summary panel
- ✅ Clear parameter descriptions
- ✅ Unit selection (F/C)

From **ControlBand**:
- ✅ VisualRangeHelper for intuitive limit setting
- ✅ Clear upper/lower/target labels
- ✅ Zone color preview

---

## WORKFLOW RISK MATRIX

| Chart Type | Discovery | Selection | Config | Validation | Preview | Creation | Adjustment | **Overall Risk** |
|------------|-----------|-----------|--------|------------|---------|----------|------------|------------------|
| Sankey | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | **CRITICAL** |
| Treemap | ✅ | ⚠️ | ❌ | ⚠️ | ❌ | ❌ | ❌ | **CRITICAL** |
| BoxPlot | ✅ | ✅ | ❌ | ⚠️ | ❌ | ⚠️ | ❌ | **HIGH** |
| Candlestick | ✅ | ⚠️ | ❌ | ⚠️ | ❌ | ⚠️ | ❌ | **HIGH** |
| ParallelCoord | ✅ | ✅ | ❌ | ✅ | ❌ | ⚠️ | ❌ | **MEDIUM-HIGH** |
| Radar | ✅ | ✅ | ❌ | ✅ | ❌ | ⚠️ | ❌ | **MEDIUM-HIGH** |
| Gauge | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ | ❌ | **MEDIUM** |
| TimeSeries | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | **LOW** |
| DevDeviation | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | **VERY LOW** |

**Legend**: ✅ Complete | ⚠️ Partial | ❌ Missing/Broken

---

## CONCLUSION

**Overall Chart Workflow Health**: **6/10 (Fair)**

**Strengths**:
- Discovery phase is excellent across all charts
- Point selection with marker tags works well
- HVAC diagnostic charts have comprehensive configurations
- Time series charts have solid workflows

**Weaknesses**:
- 2 charts (Sankey, Treemap) are fundamentally broken
- 6 charts have major configuration gaps
- Zero charts have preview capability
- Zero charts have post-creation editing

**Recommended Focus**:
1. Fix or remove broken chart types (Sankey, Treemap)
2. Add missing configuration UIs (BoxPlot, Candlestick, Gauge, Radar, ParallelCoordinates)
3. Build universal preview and edit features
4. Replicate DeviceDeviationHeatmap's excellent configuration UX

**User Impact**:
- ~26% of chart types (6/23) pose HIGH frustration risk
- ~9% (2/23) are broken and should be disabled
- ~52% (12/23) have excellent workflows
- ~13% (3/23) are adequate with minor gaps

**Priority Order**:
1. **P0** (Immediate): Fix Sankey and Treemap or remove from UI
2. **P1** (Sprint 1): Add configuration UIs for BoxPlot, Candlestick, Gauge
3. **P2** (Sprint 2): Add preview and edit features for all charts
4. **P3** (Sprint 3): Advanced features (dimension ordering, normalization)

