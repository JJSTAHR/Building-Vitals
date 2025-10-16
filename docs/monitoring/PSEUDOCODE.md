# Monitoring & Analytics Architecture - Pseudocode Specification

## Overview

This document contains the algorithmic design for the monitoring and analytics system that tracks cache performance, API efficiency, error patterns, and provides real-time dashboard updates for the Building Vitals application.

---

## 1. Worker Analytics Middleware

### 1.1 Request Tracking Algorithm

```
ALGORITHM: TrackRequest
INPUT: event (HTTP request event), environment (worker bindings)
OUTPUT: response (HTTP response) with metrics

CONSTANTS:
    MAX_REQUEST_TIME = 30000 ms
    METRICS_BATCH_SIZE = 100
    METRICS_FLUSH_INTERVAL = 5000 ms

DATA STRUCTURES:
    MetricsBatch: Array[Metric]
    Metric: {
        requestId: string,
        timestamp: number,
        duration: number,
        status: number,
        endpoint: string,
        method: string,
        cacheStatus: enum(HIT, MISS, BYPASS, STALE),
        dataPoints: number,
        hasMore: boolean,
        error: string or null,
        userId: string or null,
        region: string
    }

BEGIN
    requestId ← GenerateUUID()
    startTime ← GetHighResolutionTime()
    metric ← InitializeMetric(requestId, startTime)

    // Extract request metadata
    metric.endpoint ← ExtractEndpoint(event.request.url)
    metric.method ← event.request.method
    metric.region ← event.request.cf.region
    metric.userId ← ExtractUserId(event.request.headers)

    TRY
        // Execute request handler
        response ← HandleRequest(event, environment)

        // Calculate duration
        endTime ← GetHighResolutionTime()
        metric.duration ← endTime - startTime

        // Extract response metadata
        metric.status ← response.status
        metric.cacheStatus ← ParseCacheStatus(response.headers.get('X-Cache'))
        metric.dataPoints ← ParseInt(response.headers.get('X-Data-Points')) OR 0
        metric.hasMore ← response.headers.get('X-Has-More') = 'true'

        // Validate request time
        IF metric.duration > MAX_REQUEST_TIME THEN
            LogWarning("Slow request detected", metric)
        END IF

        // Write metrics asynchronously
        context.waitUntil(
            WriteMetricsAsync(environment.ANALYTICS, metric)
        )

        RETURN response

    CATCH error
        // Handle errors
        endTime ← GetHighResolutionTime()
        metric.duration ← endTime - startTime
        metric.status ← error.status OR 500
        metric.error ← error.message

        // Write error metrics
        context.waitUntil(
            WriteMetricsAsync(environment.ANALYTICS, metric)
        )

        // Re-throw error
        THROW error
    END TRY
END

SUBROUTINE: WriteMetricsAsync
INPUT: analyticsEngine, metric
OUTPUT: void

BEGIN
    // Batch metrics for efficiency
    IF MetricsBatch.length < METRICS_BATCH_SIZE THEN
        MetricsBatch.append(metric)
    ELSE
        // Flush batch
        analyticsEngine.writeDataPoint(metric)
        MetricsBatch.clear()
    END IF

    // Write individual critical metrics immediately
    IF metric.status >= 500 OR metric.duration > MAX_REQUEST_TIME THEN
        analyticsEngine.writeDataPoint(metric)
    END IF
END

SUBROUTINE: ExtractEndpoint
INPUT: url (string)
OUTPUT: endpoint (string)

BEGIN
    parsedUrl ← ParseURL(url)
    pathname ← parsedUrl.pathname

    // Normalize endpoint by removing IDs
    normalized ← RegexReplace(pathname, '/\\d+', '/:id')
    normalized ← RegexReplace(normalized, '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/:uuid')

    RETURN normalized
END
```

### 1.2 Complexity Analysis

```
TIME COMPLEXITY:
    - Request tracking overhead: O(1)
    - Endpoint normalization: O(n) where n = URL length
    - Metrics batching: O(1) amortized
    - Total per request: O(n) dominated by URL parsing

SPACE COMPLEXITY:
    - Metric object: O(1)
    - Metrics batch: O(METRICS_BATCH_SIZE) = O(100) = O(1)
    - Total: O(1)

OPTIMIZATION NOTES:
    - Use regex compilation cache for endpoint normalization
    - Batch metrics to reduce Analytics Engine writes
    - Write critical metrics immediately for alerting
    - Use context.waitUntil for async writes without blocking response
```

---

## 2. Cache Performance Tracker

### 2.1 Cache Analytics Algorithm

```
ALGORITHM: TrackCachePerformance
INPUT: cacheKey (string), operation (enum), result (CacheResult)
OUTPUT: void

CONSTANTS:
    CACHE_STATS_TTL = 3600 seconds
    SLIDING_WINDOW = 300 seconds (5 minutes)
    MIN_SAMPLES_FOR_ANALYSIS = 100

DATA STRUCTURES:
    CacheStats: {
        key: string,
        hits: number,
        misses: number,
        bypasses: number,
        staleServed: number,
        totalRequests: number,
        hitRate: float,
        avgHitLatency: float,
        avgMissLatency: float,
        lastUpdated: timestamp
    }

    CacheEvent: {
        timestamp: number,
        operation: enum(HIT, MISS, BYPASS, STALE, WRITE, INVALIDATE),
        key: string,
        latency: number,
        ttl: number,
        size: number
    }

    CacheKeyPattern: {
        pattern: string,
        frequency: number,
        hitRate: float,
        avgTTL: number
    }

BEGIN
    event ← CreateCacheEvent(cacheKey, operation, result)

    // Update global statistics
    UpdateGlobalStats(event)

    // Update key-specific statistics
    UpdateKeyStats(cacheKey, event)

    // Analyze cache patterns
    IF ShouldAnalyzePatterns() THEN
        AnalyzeCachePatterns()
    END IF

    // Write to Analytics Engine
    WriteAnalyticsEvent(event)
END

SUBROUTINE: UpdateGlobalStats
INPUT: event (CacheEvent)
OUTPUT: void

BEGIN
    // Get current stats from KV with sliding window
    stats ← KV.get("cache:global:stats") OR InitializeStats()

    // Update counters
    SWITCH event.operation
        CASE HIT:
            stats.hits ← stats.hits + 1
            stats.avgHitLatency ← UpdateMovingAverage(
                stats.avgHitLatency,
                event.latency,
                stats.hits
            )
        CASE MISS:
            stats.misses ← stats.misses + 1
            stats.avgMissLatency ← UpdateMovingAverage(
                stats.avgMissLatency,
                event.latency,
                stats.misses
            )
        CASE BYPASS:
            stats.bypasses ← stats.bypasses + 1
        CASE STALE:
            stats.staleServed ← stats.staleServed + 1
    END SWITCH

    // Calculate derived metrics
    stats.totalRequests ← stats.hits + stats.misses + stats.bypasses

    IF stats.totalRequests > 0 THEN
        stats.hitRate ← stats.hits / stats.totalRequests
    END IF

    stats.lastUpdated ← GetCurrentTime()

    // Persist with TTL
    KV.put("cache:global:stats", JSON.stringify(stats), {
        expirationTtl: CACHE_STATS_TTL
    })

    // Check for anomalies
    IF stats.hitRate < 0.5 AND stats.totalRequests > MIN_SAMPLES_FOR_ANALYSIS THEN
        TriggerAlert("Low cache hit rate", stats)
    END IF
END

SUBROUTINE: AnalyzeCachePatterns
INPUT: none
OUTPUT: Array[CacheKeyPattern]

BEGIN
    // Get recent cache events from Analytics
    events ← QueryAnalyticsEngine(
        "SELECT * FROM cache_events WHERE timestamp > NOW() - INTERVAL SLIDING_WINDOW"
    )

    // Group by pattern
    patternMap ← Map<string, Array[CacheEvent]>()

    FOR EACH event IN events DO
        pattern ← ExtractKeyPattern(event.key)

        IF NOT patternMap.has(pattern) THEN
            patternMap.set(pattern, [])
        END IF

        patternMap.get(pattern).append(event)
    END FOR

    // Analyze each pattern
    patterns ← []

    FOR EACH (pattern, patternEvents) IN patternMap DO
        analysis ← AnalyzePattern(pattern, patternEvents)
        patterns.append(analysis)

        // Store pattern analysis
        KV.put(
            "cache:pattern:" + pattern,
            JSON.stringify(analysis),
            { expirationTtl: CACHE_STATS_TTL }
        )
    END FOR

    RETURN patterns
END

SUBROUTINE: ExtractKeyPattern
INPUT: cacheKey (string)
OUTPUT: pattern (string)

BEGIN
    // Remove variable parts to extract pattern
    // Example: "api:v1:buildings:123:vitals" -> "api:v1:buildings:*:vitals"

    parts ← Split(cacheKey, ':')
    normalized ← []

    FOR EACH part IN parts DO
        IF IsNumeric(part) OR IsUUID(part) OR IsTimestamp(part) THEN
            normalized.append('*')
        ELSE
            normalized.append(part)
        END IF
    END FOR

    RETURN Join(normalized, ':')
END

SUBROUTINE: AnalyzePattern
INPUT: pattern (string), events (Array[CacheEvent])
OUTPUT: CacheKeyPattern

BEGIN
    hitCount ← 0
    totalCount ← events.length
    ttlSum ← 0

    FOR EACH event IN events DO
        IF event.operation = HIT THEN
            hitCount ← hitCount + 1
        END IF
        ttlSum ← ttlSum + event.ttl
    END FOR

    RETURN {
        pattern: pattern,
        frequency: totalCount,
        hitRate: hitCount / totalCount,
        avgTTL: ttlSum / totalCount
    }
END
```

### 2.2 TTL Effectiveness Analysis

```
ALGORITHM: AnalyzeTTLEffectiveness
INPUT: pattern (string), timeWindow (seconds)
OUTPUT: TTLRecommendation

DATA STRUCTURES:
    TTLRecommendation: {
        currentTTL: number,
        recommendedTTL: number,
        confidence: float,
        reasoning: string,
        impactEstimate: {
            hitRateImprovement: float,
            storageIncrease: float
        }
    }

BEGIN
    // Query cache events for pattern
    events ← QueryAnalyticsEngine(
        "SELECT * FROM cache_events
         WHERE pattern = ? AND timestamp > NOW() - INTERVAL ?",
        [pattern, timeWindow]
    )

    // Analyze invalidation patterns
    invalidations ← Filter(events, e => e.operation = INVALIDATE)
    writes ← Filter(events, e => e.operation = WRITE)
    reads ← Filter(events, e => e.operation IN (HIT, MISS))

    // Calculate time between write and read
    accessPatterns ← AnalyzeAccessPatterns(writes, reads)

    // Calculate time between write and invalidation
    staleTimes ← []
    FOR EACH invalidation IN invalidations DO
        lastWrite ← FindLastWrite(writes, invalidation.key, invalidation.timestamp)
        IF lastWrite IS NOT NULL THEN
            staleTime ← invalidation.timestamp - lastWrite.timestamp
            staleTimes.append(staleTime)
        END IF
    END FOR

    // Determine optimal TTL
    IF staleTimes.length > MIN_SAMPLES_FOR_ANALYSIS THEN
        // Use percentile approach: 90th percentile of stale times
        recommendedTTL ← Percentile(staleTimes, 0.90)
        confidence ← CalculateConfidence(staleTimes.length)
        reasoning ← "Based on invalidation patterns"
    ELSE IF accessPatterns.length > MIN_SAMPLES_FOR_ANALYSIS THEN
        // Use access pattern approach: median time between accesses
        recommendedTTL ← Median(accessPatterns)
        confidence ← CalculateConfidence(accessPatterns.length)
        reasoning ← "Based on access patterns"
    ELSE
        // Insufficient data
        recommendedTTL ← GetDefaultTTL(pattern)
        confidence ← 0.3
        reasoning ← "Insufficient data, using defaults"
    END IF

    // Estimate impact
    currentHitRate ← CalculateHitRate(reads)
    estimatedHitRate ← EstimateHitRateWithNewTTL(reads, recommendedTTL)

    RETURN {
        currentTTL: GetCurrentTTL(pattern),
        recommendedTTL: recommendedTTL,
        confidence: confidence,
        reasoning: reasoning,
        impactEstimate: {
            hitRateImprovement: estimatedHitRate - currentHitRate,
            storageIncrease: EstimateStorageIncrease(recommendedTTL)
        }
    }
END
```

### 2.3 Complexity Analysis

```
TIME COMPLEXITY:
    - UpdateGlobalStats: O(1)
    - AnalyzeCachePatterns: O(n * m) where n = events, m = pattern matching
    - ExtractKeyPattern: O(k) where k = key length
    - AnalyzeTTLEffectiveness: O(n log n) dominated by percentile calculation
    - Total: O(n log n) for batch analysis

SPACE COMPLEXITY:
    - CacheStats: O(1)
    - Pattern map: O(p) where p = unique patterns
    - Events storage: O(n) where n = events in window
    - Total: O(n + p)

OPTIMIZATION NOTES:
    - Use sliding window to limit event history
    - Batch Analytics Engine queries
    - Cache pattern analysis results
    - Use approximate percentile algorithms for large datasets
    - Consider sampling for high-traffic patterns
```

---

## 3. Error Correlation Engine

### 3.1 Error Pattern Detection

```
ALGORITHM: DetectErrorPatterns
INPUT: timeWindow (seconds), threshold (float)
OUTPUT: Array[ErrorPattern]

CONSTANTS:
    MIN_ERROR_COUNT = 5
    PATTERN_CONFIDENCE_THRESHOLD = 0.7
    CORRELATION_WINDOW = 60 seconds
    ERROR_RATE_ALERT_THRESHOLD = 0.05 (5%)

DATA STRUCTURES:
    ErrorPattern: {
        patternId: string,
        errorType: string,
        frequency: number,
        errorRate: float,
        affectedEndpoints: Array[string],
        timeRange: {start: timestamp, end: timestamp},
        correlations: Array[Correlation],
        rootCause: RootCause or null,
        severity: enum(LOW, MEDIUM, HIGH, CRITICAL)
    }

    Correlation: {
        type: enum(CACHE_MISS, HIGH_LATENCY, RATE_LIMIT, API_ERROR),
        strength: float (0-1),
        details: object
    }

    RootCause: {
        category: enum(CACHE, NETWORK, DATABASE, EXTERNAL_API, RATE_LIMIT, LOGIC),
        description: string,
        confidence: float,
        evidence: Array[string]
    }

BEGIN
    // Query recent errors from Analytics
    errors ← QueryAnalyticsEngine(
        "SELECT * FROM metrics
         WHERE status >= 400 AND timestamp > NOW() - INTERVAL ?",
        [timeWindow]
    )

    // Calculate baseline error rate
    totalRequests ← QueryAnalyticsEngine(
        "SELECT COUNT(*) FROM metrics WHERE timestamp > NOW() - INTERVAL ?",
        [timeWindow]
    )

    baselineErrorRate ← errors.length / totalRequests

    // Check for error rate spike
    IF baselineErrorRate > ERROR_RATE_ALERT_THRESHOLD THEN
        TriggerAlert("High error rate detected", {
            rate: baselineErrorRate,
            count: errors.length
        })
    END IF

    // Group errors by characteristics
    errorGroups ← GroupErrors(errors)

    patterns ← []

    FOR EACH (groupKey, groupErrors) IN errorGroups DO
        IF groupErrors.length >= MIN_ERROR_COUNT THEN
            pattern ← AnalyzeErrorGroup(groupKey, groupErrors, totalRequests)

            // Find correlations
            pattern.correlations ← FindCorrelations(groupErrors)

            // Attempt root cause attribution
            pattern.rootCause ← AttributeRootCause(pattern)

            // Determine severity
            pattern.severity ← CalculateSeverity(pattern)

            IF pattern.rootCause.confidence >= PATTERN_CONFIDENCE_THRESHOLD THEN
                patterns.append(pattern)
            END IF
        END IF
    END FOR

    // Sort by severity and frequency
    patterns.sortBy(p => (p.severity, p.frequency), descending: true)

    RETURN patterns
END

SUBROUTINE: GroupErrors
INPUT: errors (Array[ErrorEvent])
OUTPUT: Map<string, Array[ErrorEvent>>

BEGIN
    groups ← Map<string, Array[ErrorEvent>>()

    FOR EACH error IN errors DO
        // Create composite key from error characteristics
        key ← CreateErrorKey(error)

        IF NOT groups.has(key) THEN
            groups.set(key, [])
        END IF

        groups.get(key).append(error)
    END FOR

    RETURN groups
END

SUBROUTINE: CreateErrorKey
INPUT: error (ErrorEvent)
OUTPUT: key (string)

BEGIN
    components ← [
        error.status,
        error.endpoint,
        ExtractErrorType(error.error)
    ]

    RETURN Join(components, '|')
END

SUBROUTINE: FindCorrelations
INPUT: errors (Array[ErrorEvent])
OUTPUT: Array[Correlation]

BEGIN
    correlations ← []

    // Check cache miss correlation
    cacheMissRate ← CalculateRateWhere(errors, e => e.cacheStatus = MISS)
    IF cacheMissRate > 0.8 THEN
        correlations.append({
            type: CACHE_MISS,
            strength: cacheMissRate,
            details: {
                missRate: cacheMissRate,
                affectedKeys: ExtractCacheKeys(errors)
            }
        })
    END IF

    // Check high latency correlation
    avgLatency ← Average(errors.map(e => e.duration))
    p95Latency ← Percentile(errors.map(e => e.duration), 0.95)

    IF avgLatency > 5000 OR p95Latency > 10000 THEN
        correlations.append({
            type: HIGH_LATENCY,
            strength: Min(avgLatency / 10000, 1.0),
            details: {
                avgLatency: avgLatency,
                p95Latency: p95Latency
            }
        })
    END IF

    // Check for sequential error patterns (cascading failures)
    IF HasSequentialPattern(errors) THEN
        cascadeStrength ← CalculateCascadeStrength(errors)
        correlations.append({
            type: API_ERROR,
            strength: cascadeStrength,
            details: {
                pattern: "cascading_failure",
                firstError: errors[0].timestamp
            }
        })
    END IF

    // Check rate limiting correlation
    rateLimitErrors ← Filter(errors, e => e.status = 429)
    IF rateLimitErrors.length > 0 THEN
        correlations.append({
            type: RATE_LIMIT,
            strength: rateLimitErrors.length / errors.length,
            details: {
                endpoint: MostFrequent(rateLimitErrors.map(e => e.endpoint))
            }
        })
    END IF

    RETURN correlations
END

SUBROUTINE: AttributeRootCause
INPUT: pattern (ErrorPattern)
OUTPUT: RootCause

BEGIN
    evidence ← []
    scores ← Map<Category, float>()

    // Analyze correlations for root cause
    FOR EACH correlation IN pattern.correlations DO
        SWITCH correlation.type
            CASE CACHE_MISS:
                scores[CACHE] ← scores[CACHE] + (correlation.strength * 0.8)
                evidence.append("High cache miss rate: " + correlation.strength)

            CASE HIGH_LATENCY:
                scores[NETWORK] ← scores[NETWORK] + (correlation.strength * 0.6)
                scores[DATABASE] ← scores[DATABASE] + (correlation.strength * 0.4)
                evidence.append("High latency detected: " + correlation.details.avgLatency + "ms")

            CASE RATE_LIMIT:
                scores[RATE_LIMIT] ← scores[RATE_LIMIT] + (correlation.strength * 0.9)
                evidence.append("Rate limiting on: " + correlation.details.endpoint)

            CASE API_ERROR:
                scores[EXTERNAL_API] ← scores[EXTERNAL_API] + (correlation.strength * 0.7)
                evidence.append("External API failure pattern detected")
        END SWITCH
    END FOR

    // Analyze error messages
    errorMessages ← ExtractErrorMessages(pattern)
    FOR EACH message IN errorMessages DO
        IF Contains(message, "cache") OR Contains(message, "KV") THEN
            scores[CACHE] ← scores[CACHE] + 0.5
            evidence.append("Cache-related error: " + message)
        ELSE IF Contains(message, "timeout") THEN
            scores[NETWORK] ← scores[NETWORK] + 0.5
            evidence.append("Timeout error: " + message)
        ELSE IF Contains(message, "database") OR Contains(message, "query") THEN
            scores[DATABASE] ← scores[DATABASE] + 0.5
            evidence.append("Database error: " + message)
        END IF
    END FOR

    // Find highest scoring category
    IF scores.isEmpty() THEN
        RETURN {
            category: LOGIC,
            description: "Unknown error pattern",
            confidence: 0.3,
            evidence: evidence
        }
    END IF

    topCategory ← MaxBy(scores, (k, v) => v)
    confidence ← Min(scores[topCategory], 1.0)

    RETURN {
        category: topCategory,
        description: GenerateRootCauseDescription(topCategory, pattern),
        confidence: confidence,
        evidence: evidence
    }
END

SUBROUTINE: CalculateSeverity
INPUT: pattern (ErrorPattern)
OUTPUT: enum(LOW, MEDIUM, HIGH, CRITICAL)

BEGIN
    // Factors: frequency, error rate, affected endpoints, root cause confidence

    score ← 0

    // Frequency weight
    IF pattern.frequency > 100 THEN
        score ← score + 3
    ELSE IF pattern.frequency > 50 THEN
        score ← score + 2
    ELSE IF pattern.frequency > 10 THEN
        score ← score + 1
    END IF

    // Error rate weight
    IF pattern.errorRate > 0.1 THEN
        score ← score + 3
    ELSE IF pattern.errorRate > 0.05 THEN
        score ← score + 2
    ELSE IF pattern.errorRate > 0.01 THEN
        score ← score + 1
    END IF

    // Error type weight
    IF pattern.errorType STARTS WITH "5" THEN
        score ← score + 2  // Server errors more severe
    END IF

    // Root cause confidence weight
    IF pattern.rootCause.confidence > 0.8 THEN
        score ← score + 1  // Higher confidence = easier to fix
    END IF

    // Determine severity
    IF score >= 8 THEN
        RETURN CRITICAL
    ELSE IF score >= 5 THEN
        RETURN HIGH
    ELSE IF score >= 3 THEN
        RETURN MEDIUM
    ELSE
        RETURN LOW
    END IF
END
```

### 3.2 Complexity Analysis

```
TIME COMPLEXITY:
    - DetectErrorPatterns: O(n) where n = error count
    - GroupErrors: O(n)
    - FindCorrelations: O(n log n) for percentile calculations
    - AttributeRootCause: O(c * e) where c = correlations, e = evidence items
    - Total: O(n log n)

SPACE COMPLEXITY:
    - Error groups: O(n) worst case (all unique)
    - Patterns: O(g) where g = number of groups
    - Correlations: O(g * c) where c = correlations per pattern
    - Total: O(n)

OPTIMIZATION NOTES:
    - Use time-series indexing for error queries
    - Cache pattern analysis results
    - Sample large error sets for correlation analysis
    - Use approximate algorithms for percentiles
    - Limit correlation analysis to top error groups
```

---

## 4. Dashboard Data Service

### 4.1 Real-Time WebSocket Updates

```
ALGORITHM: DashboardDataService
INPUT: clientId (string), subscriptions (Array[Subscription])
OUTPUT: WebSocket connection

CONSTANTS:
    UPDATE_INTERVAL = 5000 ms
    BATCH_SIZE = 50
    MAX_HISTORY = 1000 points
    AGGREGATION_INTERVAL = 60 seconds

DATA STRUCTURES:
    Subscription: {
        type: enum(METRICS, ERRORS, CACHE, ALERTS),
        filters: object,
        aggregation: enum(NONE, SUM, AVG, P95, P99)
    }

    DashboardUpdate: {
        timestamp: number,
        type: string,
        data: object,
        metadata: object
    }

    TimeSeriesData: {
        timestamps: Array[number],
        values: Array[number],
        metadata: object
    }

BEGIN
    // Initialize WebSocket connection
    ws ← EstablishWebSocket(clientId)

    // Set up update loop
    updateTimer ← SetInterval(UPDATE_INTERVAL, () => {
        ProcessClientUpdates(clientId, subscriptions, ws)
    })

    // Handle client messages
    ws.onMessage((message) => {
        HandleClientMessage(clientId, message, subscriptions)
    })

    // Cleanup on disconnect
    ws.onClose(() => {
        ClearInterval(updateTimer)
        CleanupClientState(clientId)
    })

    RETURN ws
END

SUBROUTINE: ProcessClientUpdates
INPUT: clientId, subscriptions, websocket
OUTPUT: void

BEGIN
    updates ← []

    FOR EACH subscription IN subscriptions DO
        data ← FetchSubscriptionData(subscription)

        IF data IS NOT NULL THEN
            update ← {
                timestamp: GetCurrentTime(),
                type: subscription.type,
                data: data,
                metadata: {
                    aggregation: subscription.aggregation,
                    interval: AGGREGATION_INTERVAL
                }
            }
            updates.append(update)
        END IF
    END FOR

    IF updates.length > 0 THEN
        // Send batched updates
        websocket.send(JSON.stringify({
            type: 'batch_update',
            updates: updates
        }))
    END IF
END

SUBROUTINE: FetchSubscriptionData
INPUT: subscription (Subscription)
OUTPUT: data or null

BEGIN
    SWITCH subscription.type
        CASE METRICS:
            RETURN FetchMetricsData(subscription)
        CASE ERRORS:
            RETURN FetchErrorData(subscription)
        CASE CACHE:
            RETURN FetchCacheData(subscription)
        CASE ALERTS:
            RETURN FetchActiveAlerts(subscription)
        DEFAULT:
            RETURN null
    END SWITCH
END
```

### 4.2 Historical Data Aggregation

```
ALGORITHM: AggregateHistoricalData
INPUT: metric (string), timeRange (TimeRange), granularity (seconds)
OUTPUT: TimeSeriesData

DATA STRUCTURES:
    TimeRange: {
        start: timestamp,
        end: timestamp
    }

    AggregationBucket: {
        timestamp: number,
        count: number,
        sum: number,
        min: number,
        max: number,
        values: Array[number]  // For percentile calculation
    }

BEGIN
    // Calculate number of buckets
    duration ← timeRange.end - timeRange.start
    bucketCount ← Ceiling(duration / granularity)

    // Initialize buckets
    buckets ← Array[AggregationBucket](bucketCount)
    FOR i FROM 0 TO bucketCount - 1 DO
        buckets[i] ← {
            timestamp: timeRange.start + (i * granularity),
            count: 0,
            sum: 0,
            min: INFINITY,
            max: -INFINITY,
            values: []
        }
    END FOR

    // Query raw data points
    dataPoints ← QueryAnalyticsEngine(
        "SELECT timestamp, value FROM metrics
         WHERE metric = ? AND timestamp BETWEEN ? AND ?
         ORDER BY timestamp ASC",
        [metric, timeRange.start, timeRange.end]
    )

    // Distribute data points into buckets
    FOR EACH point IN dataPoints DO
        bucketIndex ← Floor((point.timestamp - timeRange.start) / granularity)

        IF bucketIndex >= 0 AND bucketIndex < bucketCount THEN
            bucket ← buckets[bucketIndex]
            bucket.count ← bucket.count + 1
            bucket.sum ← bucket.sum + point.value
            bucket.min ← Min(bucket.min, point.value)
            bucket.max ← Max(bucket.max, point.value)
            bucket.values.append(point.value)
        END IF
    END FOR

    // Calculate aggregated values
    timestamps ← []
    values ← []

    FOR EACH bucket IN buckets DO
        timestamps.append(bucket.timestamp)

        IF bucket.count > 0 THEN
            // Calculate based on requested aggregation
            aggregatedValue ← CalculateAggregation(bucket)
            values.append(aggregatedValue)
        ELSE
            // No data for this bucket
            values.append(null)
        END IF
    END FOR

    RETURN {
        timestamps: timestamps,
        values: values,
        metadata: {
            granularity: granularity,
            bucketCount: bucketCount,
            totalPoints: dataPoints.length
        }
    }
END

SUBROUTINE: CalculateAggregation
INPUT: bucket (AggregationBucket)
OUTPUT: value (number)

BEGIN
    // Determine aggregation method from context
    aggregationType ← GetRequestedAggregation()

    SWITCH aggregationType
        CASE SUM:
            RETURN bucket.sum

        CASE AVG:
            RETURN bucket.sum / bucket.count

        CASE MIN:
            RETURN bucket.min

        CASE MAX:
            RETURN bucket.max

        CASE P95:
            RETURN Percentile(bucket.values, 0.95)

        CASE P99:
            RETURN Percentile(bucket.values, 0.99)

        DEFAULT:
            RETURN bucket.sum / bucket.count
    END SWITCH
END
```

### 4.3 Alert Trigger Logic

```
ALGORITHM: EvaluateAlertConditions
INPUT: none
OUTPUT: Array[Alert]

CONSTANTS:
    ALERT_CHECK_INTERVAL = 60 seconds
    ALERT_COOLDOWN = 300 seconds
    THRESHOLD_ERROR_RATE = 0.05
    THRESHOLD_P95_LATENCY = 5000 ms
    THRESHOLD_CACHE_HIT_RATE = 0.5

DATA STRUCTURES:
    Alert: {
        alertId: string,
        severity: enum(WARNING, ERROR, CRITICAL),
        title: string,
        description: string,
        metric: string,
        threshold: number,
        currentValue: number,
        timestamp: number,
        acknowledged: boolean,
        resolvedAt: number or null
    }

    AlertRule: {
        ruleId: string,
        metric: string,
        condition: enum(GREATER_THAN, LESS_THAN, EQUALS),
        threshold: number,
        duration: number,  // Sustained for this duration
        severity: enum(WARNING, ERROR, CRITICAL),
        cooldown: number
    }

BEGIN
    // Define alert rules
    rules ← [
        {
            ruleId: "high_error_rate",
            metric: "error_rate",
            condition: GREATER_THAN,
            threshold: THRESHOLD_ERROR_RATE,
            duration: 120,
            severity: ERROR,
            cooldown: ALERT_COOLDOWN
        },
        {
            ruleId: "high_latency",
            metric: "p95_latency",
            condition: GREATER_THAN,
            threshold: THRESHOLD_P95_LATENCY,
            duration: 180,
            severity: WARNING,
            cooldown: ALERT_COOLDOWN
        },
        {
            ruleId: "low_cache_hit_rate",
            metric: "cache_hit_rate",
            condition: LESS_THAN,
            threshold: THRESHOLD_CACHE_HIT_RATE,
            duration: 300,
            severity: WARNING,
            cooldown: ALERT_COOLDOWN
        },
        {
            ruleId: "critical_errors",
            metric: "error_5xx_rate",
            condition: GREATER_THAN,
            threshold: 0.02,
            duration: 60,
            severity: CRITICAL,
            cooldown: ALERT_COOLDOWN
        }
    ]

    triggeredAlerts ← []

    FOR EACH rule IN rules DO
        // Check cooldown
        lastAlert ← GetLastAlert(rule.ruleId)
        IF lastAlert IS NOT NULL THEN
            timeSinceLastAlert ← GetCurrentTime() - lastAlert.timestamp
            IF timeSinceLastAlert < rule.cooldown THEN
                CONTINUE  // Skip this rule due to cooldown
            END IF
        END IF

        // Evaluate condition
        isViolated ← EvaluateRule(rule)

        IF isViolated THEN
            // Create alert
            alert ← CreateAlert(rule)
            triggeredAlerts.append(alert)

            // Store alert
            StoreAlert(alert)

            // Notify subscribers
            NotifyAlertSubscribers(alert)
        END IF
    END FOR

    RETURN triggeredAlerts
END

SUBROUTINE: EvaluateRule
INPUT: rule (AlertRule)
OUTPUT: isViolated (boolean)

BEGIN
    // Get metric data for evaluation window
    currentTime ← GetCurrentTime()
    windowStart ← currentTime - rule.duration

    metricData ← QueryAnalyticsEngine(
        "SELECT AVG(value) as avg_value FROM metrics
         WHERE metric = ? AND timestamp BETWEEN ? AND ?",
        [rule.metric, windowStart, currentTime]
    )

    IF metricData IS NULL OR metricData.avg_value IS NULL THEN
        RETURN false  // Insufficient data
    END IF

    currentValue ← metricData.avg_value

    // Evaluate condition
    SWITCH rule.condition
        CASE GREATER_THAN:
            RETURN currentValue > rule.threshold
        CASE LESS_THAN:
            RETURN currentValue < rule.threshold
        CASE EQUALS:
            RETURN currentValue = rule.threshold
        DEFAULT:
            RETURN false
    END SWITCH
END

SUBROUTINE: CreateAlert
INPUT: rule (AlertRule)
OUTPUT: alert (Alert)

BEGIN
    // Get current metric value
    currentValue ← GetCurrentMetricValue(rule.metric)

    // Generate alert details
    title ← GenerateAlertTitle(rule, currentValue)
    description ← GenerateAlertDescription(rule, currentValue)

    RETURN {
        alertId: GenerateUUID(),
        severity: rule.severity,
        title: title,
        description: description,
        metric: rule.metric,
        threshold: rule.threshold,
        currentValue: currentValue,
        timestamp: GetCurrentTime(),
        acknowledged: false,
        resolvedAt: null
    }
END

SUBROUTINE: NotifyAlertSubscribers
INPUT: alert (Alert)
OUTPUT: void

BEGIN
    // Get all WebSocket connections subscribed to alerts
    subscribers ← GetAlertSubscribers()

    FOR EACH subscriber IN subscribers DO
        // Send alert via WebSocket
        subscriber.ws.send(JSON.stringify({
            type: 'alert',
            alert: alert
        }))
    END FOR

    // Store in Durable Object for persistence
    DO_AlertManager.createAlert(alert)

    // Log to Analytics Engine
    WriteAnalyticsEvent({
        type: 'alert_triggered',
        alertId: alert.alertId,
        severity: alert.severity,
        metric: alert.metric
    })
END
```

### 4.4 Complexity Analysis

```
TIME COMPLEXITY:
    - ProcessClientUpdates: O(s) where s = subscriptions
    - AggregateHistoricalData: O(n + b) where n = data points, b = buckets
    - EvaluateAlertConditions: O(r * q) where r = rules, q = query time
    - Total dashboard update: O(s * n)

SPACE COMPLEXITY:
    - WebSocket connections: O(c) where c = clients
    - Aggregation buckets: O(b) per query
    - Alert rules: O(r)
    - Total: O(c + b + r)

OPTIMIZATION NOTES:
    - Use connection pooling for Analytics Engine queries
    - Cache aggregated data for common time ranges
    - Use streaming queries for large datasets
    - Implement rate limiting per client
    - Use Durable Objects for alert state management
    - Batch WebSocket messages to reduce overhead
    - Implement backpressure for slow clients
```

---

## 5. Integration Architecture

### 5.1 System Integration Flow

```
ALGORITHM: MonitoringSystemIntegration
INPUT: request (HTTP event)
OUTPUT: response with monitoring metadata

BEGIN
    // 1. Worker Analytics Middleware intercepts request
    requestId ← GenerateRequestId()
    startTime ← GetHighResolutionTime()

    // 2. Execute request with monitoring
    TRY
        response ← HandleRequest(request)

        // 3. Track cache performance
        IF response.headers['X-Cache'] IS NOT NULL THEN
            TrackCachePerformance(
                request.url,
                response.headers['X-Cache'],
                response
            )
        END IF

        // 4. Write request metrics
        metric ← CreateRequestMetric(request, response, startTime)
        WriteMetricsAsync(metric)

        // 5. Check for error patterns (async)
        IF response.status >= 400 THEN
            context.waitUntil(
                DetectErrorPatterns(300, 0.05)
            )
        END IF

        // 6. Update dashboard subscribers (async)
        context.waitUntil(
            BroadcastMetricUpdate(metric)
        )

        RETURN response

    CATCH error
        // 7. Handle error with full monitoring
        metric ← CreateErrorMetric(request, error, startTime)
        WriteMetricsAsync(metric)

        // 8. Immediate error pattern detection
        context.waitUntil(
            DetectErrorPatterns(60, 0.1)  // Shorter window for errors
        )

        // 9. Trigger alert evaluation
        context.waitUntil(
            EvaluateAlertConditions()
        )

        THROW error
    END TRY
END
```

### 5.2 Data Flow Architecture

```
FLOW: Monitoring Data Pipeline

[HTTP Request]
    → [Worker Analytics Middleware]
        → Capture request metadata
        → Start timing
        |
        ↓
    → [Request Handler]
        → Process request
        → Check cache
        → Call external APIs
        |
        ↓
    → [Response Interceptor]
        → Extract response metadata
        → Calculate duration
        → Determine cache status
        |
        ↓
    → [Metrics Writer] (async, non-blocking)
        → Batch metrics
        → Write to Analytics Engine
        |
        ↓
    → [Cache Performance Tracker] (async)
        → Update cache statistics
        → Analyze patterns
        → Generate TTL recommendations
        |
        ↓
    → [Error Correlation Engine] (async, on errors)
        → Detect error patterns
        → Find correlations
        → Attribute root causes
        |
        ↓
    → [Alert Evaluator] (periodic + triggered)
        → Evaluate alert rules
        → Check thresholds
        → Trigger notifications
        |
        ↓
    → [Dashboard Data Service]
        → Aggregate data
        → WebSocket broadcasts
        → Update dashboards

[Analytics Engine Storage]
    ↓
[Historical Data Aggregation] (scheduled)
    → Time-series buckets
    → Percentile calculations
    → Trend analysis
    |
    ↓
[Dashboard Queries]
    → Real-time metrics
    → Historical charts
    → Performance insights
```

---

## 6. Performance Considerations

### 6.1 Monitoring Overhead Analysis

```
ANALYSIS: Monitoring System Performance Impact

Per-Request Overhead:
    - Middleware instrumentation: ~0.5-1ms
    - Metric object creation: ~0.2ms
    - Async write queue: ~0.1ms
    - Total synchronous overhead: ~0.8-1.3ms (<1% of 160ms request)

Async Operations (non-blocking):
    - Analytics Engine write: 5-10ms
    - Cache stats update: 2-5ms
    - Pattern detection: 10-50ms (batched)
    - Total async time: 17-65ms

Memory Overhead:
    - Metric object: ~1KB
    - Metrics batch buffer: ~100KB (100 metrics)
    - Cache stats: ~10KB
    - Total per-worker: ~111KB

Storage Costs:
    - Analytics Engine writes: 0.25-0.50 requests/sec
    - KV writes (cache stats): 0.1 requests/sec
    - Durable Objects (alerts): 0.01 requests/sec
    - Total: ~0.36-0.61 billable requests/sec

Optimization Strategies:
    - Batch metrics writes (100 metrics per batch)
    - Use context.waitUntil for non-critical operations
    - Sample high-frequency events (>1000/sec)
    - Cache aggregated data for dashboards
    - Use sliding windows to limit data retention
```

### 6.2 Scalability Analysis

```
ANALYSIS: System Scalability

Request Volume Handling:
    - Target: 10,000 requests/minute
    - Metrics generated: 10,000/minute
    - Batched writes: 100/minute (100 metrics per batch)
    - Analytics Engine capacity: 10,000+ writes/sec (sufficient)

Cache Analytics Scaling:
    - Cache events: ~2x request volume = 20,000/minute
    - Pattern analysis: Every 5 minutes = 0.2 jobs/minute
    - Storage per pattern: ~1KB
    - Total KV storage: ~1MB for 1000 patterns

Error Correlation Scaling:
    - Baseline error rate: 2% = 200 errors/minute
    - Pattern detection: Every 5 minutes on 1000 errors
    - Complexity: O(n log n) = O(1000 * 10) = ~10,000 operations
    - Processing time: <100ms

Dashboard Scaling:
    - Active connections: 100 concurrent users
    - Update frequency: 5 seconds
    - Updates per minute: 100 * 12 = 1200 WebSocket messages
    - Bandwidth: ~1.2MB/minute (1KB per message)

Bottleneck Analysis:
    1. Analytics Engine query performance (mitigated by caching)
    2. WebSocket connection limits (mitigated by Durable Objects)
    3. KV read/write limits (mitigated by batching)
    4. Worker CPU time (mitigated by async operations)
```

---

## 7. Deliverables Summary

This pseudocode specification provides complete algorithmic designs for:

1. **Worker Analytics Middleware** - Request tracking with batched metrics writing
2. **Cache Performance Tracker** - Hit/miss analysis, pattern detection, TTL optimization
3. **Error Correlation Engine** - Pattern detection, correlation analysis, root cause attribution
4. **Dashboard Data Service** - Real-time WebSocket updates, historical aggregation, alert evaluation

### Key Design Decisions:

- **Async-first architecture** - Non-blocking operations using context.waitUntil
- **Batched writes** - Reduce Analytics Engine write costs by 100x
- **Pattern-based analysis** - Extract insights from cache keys and error messages
- **Sliding windows** - Limit memory and storage overhead
- **Confidence scoring** - Provide reliability metrics for automated decisions
- **Severity calculation** - Prioritize alerts based on impact
- **Real-time + historical** - Support both live monitoring and trend analysis

### Performance Characteristics:

- Synchronous overhead: <1ms per request
- Async processing: 17-65ms (non-blocking)
- Memory overhead: ~111KB per worker
- Scalable to 10,000+ requests/minute
- Alert latency: <60 seconds
- Dashboard updates: 5-second intervals

---

**File Location:** `C:\Users\jstahr\Desktop\Building Vitals\docs\monitoring\PSEUDOCODE.md`

**Next Phase:** Architecture - System design and component integration
