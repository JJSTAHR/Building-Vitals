# Deviation Heatmap Configuration Algorithm

## 1. Main Configuration Flow

```
ALGORITHM: ConfigureDeviationHeatmap
INPUT: userContext (object), existingConfig (object or null)
OUTPUT: chartConfiguration (object) or error

CONSTANTS:
    MIN_POINTS = 1
    MAX_POINTS = 100
    MIN_TIME_RANGE_HOURS = 1
    MAX_TIME_RANGE_DAYS = 90
    TUTORIAL_STORAGE_KEY = "deviation_heatmap_tutorial_seen"

BEGIN
    // Step 0: Initialize and determine entry mode
    wizardState ← InitializeWizardState(userContext, existingConfig)

    IF NOT HasSeenTutorial(TUTORIAL_STORAGE_KEY) THEN
        tutorialChoice ← ShowTutorialDialog()
        IF tutorialChoice == "view_tutorial" THEN
            ShowInteractiveTutorial()
        ELSE IF tutorialChoice == "use_template" THEN
            template ← ShowTemplateSelector()
            IF template IS NOT NULL THEN
                wizardState ← LoadTemplate(template)
                GOTO step_4_preview
            END IF
        END IF
        MarkTutorialSeen(TUTORIAL_STORAGE_KEY)
    END IF

    // Step 1: Point Selection
    step_1_point_selection:
    pointSelection ← SelectPointsWithGuidance(wizardState)

    IF pointSelection.cancelled THEN
        RETURN null
    END IF

    IF pointSelection.points.length < MIN_POINTS THEN
        ShowError("At least one point must be selected")
        GOTO step_1_point_selection
    END IF

    IF pointSelection.points.length > MAX_POINTS THEN
        ShowError("Maximum of {MAX_POINTS} points allowed")
        GOTO step_1_point_selection
    END IF

    // Validate unit compatibility
    unitValidation ← ValidateUnitCompatibility(pointSelection.points)
    IF NOT unitValidation.isValid THEN
        userChoice ← ShowUnitConflictDialog(unitValidation)
        IF userChoice == "cancel" THEN
            GOTO step_1_point_selection
        ELSE IF userChoice == "filter_by_unit" THEN
            selectedUnit ← ShowUnitSelector(unitValidation.unitsFound)
            pointSelection.points ← FilterPointsByUnit(
                pointSelection.points,
                selectedUnit
            )
        END IF
    END IF

    wizardState.points ← pointSelection.points
    wizardState.unit ← DetectPrimaryUnit(pointSelection.points)

    // Step 2: Time Range Selection with Preview
    step_2_time_range:
    timeRangeConfig ← SelectTimeRangeWithPreview(
        wizardState.points,
        wizardState.defaultTimeRange
    )

    IF timeRangeConfig.cancelled THEN
        GOTO step_1_point_selection
    END IF

    wizardState.timeRange ← timeRangeConfig.range
    wizardState.aggregationImpact ← timeRangeConfig.impact

    // Step 3: Deviation Configuration
    step_3_deviation_config:
    deviationConfig ← ConfigureDeviationWithSmartDefaults(
        wizardState.unit,
        wizardState.points,
        wizardState.timeRange
    )

    IF deviationConfig.cancelled THEN
        GOTO step_2_time_range
    END IF

    wizardState.deviationConfig ← deviationConfig

    // Step 4: Preview and Confirmation
    step_4_preview:
    previewResult ← ShowConfigurationPreview(wizardState)

    IF previewResult.action == "cancel" THEN
        RETURN null
    ELSE IF previewResult.action == "edit_points" THEN
        GOTO step_1_point_selection
    ELSE IF previewResult.action == "edit_time_range" THEN
        GOTO step_2_time_range
    ELSE IF previewResult.action == "edit_deviation" THEN
        GOTO step_3_deviation_config
    ELSE IF previewResult.action == "confirm" THEN
        // Step 5: Generate and Save Configuration
        finalConfig ← BuildFinalConfiguration(wizardState)

        // Optionally save as template
        IF previewResult.saveAsTemplate THEN
            SaveConfigurationTemplate(finalConfig, previewResult.templateName)
        END IF

        // Save to user history
        SaveToConfigurationHistory(finalConfig)

        RETURN finalConfig
    END IF
END
```

## 2. Point Selection with Guidance

```
ALGORITHM: SelectPointsWithGuidance
INPUT: wizardState (object)
OUTPUT: pointSelection (object with points array and cancelled flag)

BEGIN
    // Initialize point selector UI
    selector ← InitializePointSelector()

    // Pre-populate if editing existing config
    IF wizardState.existingPoints IS NOT NULL THEN
        selector.selectedPoints ← wizardState.existingPoints
    END IF

    // Show helpful guidance
    ShowGuidancePanel({
        title: "Select Monitoring Points",
        tips: [
            "Choose points with the same unit for comparison",
            "Select devices from the same system or area",
            "Recommended: 5-20 points for optimal visualization"
        ],
        examples: [
            "All VAV temperature sensors on Floor 3",
            "All pressure sensors in AHU-1 system"
        ]
    })

    // Enable smart filtering
    selector.enableSmartFilters({
        groupBySystem: true,
        groupByUnit: true,
        groupByLocation: true,
        showRecentlyUsed: true
    })

    // Wait for user selection
    WHILE selector.isOpen DO
        event ← WaitForUserInput()

        IF event.type == "points_changed" THEN
            // Real-time validation feedback
            validation ← QuickValidatePoints(event.selectedPoints)
            selector.updateValidationStatus(validation)

        ELSE IF event.type == "confirm" THEN
            RETURN {
                points: selector.selectedPoints,
                cancelled: false
            }

        ELSE IF event.type == "cancel" THEN
            RETURN {
                points: [],
                cancelled: true
            }
        END IF
    END WHILE
END
```

## 3. Time Range Selection with Impact Preview

```
ALGORITHM: SelectTimeRangeWithPreview
INPUT: points (array), defaultRange (object or null)
OUTPUT: timeRangeConfig (object)

BEGIN
    // Initialize time range picker
    rangePicker ← InitializeTimeRangePicker()

    IF defaultRange IS NOT NULL THEN
        rangePicker.setRange(defaultRange)
    ELSE
        rangePicker.setRange({
            start: CurrentTime() - 7 days,
            end: CurrentTime()
        })
    END IF

    // Initialize live preview panel
    previewPanel ← InitializePreviewPanel()

    WHILE rangePicker.isOpen DO
        // Calculate impact whenever range changes
        currentRange ← rangePicker.getCurrentRange()
        impact ← CalculateAggregationImpact(currentRange, points)

        // Update preview panel
        UpdatePreviewPanel(previewPanel, impact, currentRange)

        // Wait for user action
        event ← WaitForUserInput()

        IF event.type == "range_changed" THEN
            // Preview updates automatically via loop
            CONTINUE

        ELSE IF event.type == "confirm" THEN
            RETURN {
                range: currentRange,
                impact: impact,
                cancelled: false
            }

        ELSE IF event.type == "cancel" THEN
            RETURN {
                range: null,
                impact: null,
                cancelled: true
            }
        END IF
    END WHILE
END

SUBROUTINE: CalculateAggregationImpact
INPUT: timeRange (object), points (array)
OUTPUT: impact (object)

BEGIN
    durationHours ← (timeRange.end - timeRange.start) / (1000 * 3600)
    pointCount ← points.length

    // Determine optimal aggregation interval
    aggregationMinutes ← DetermineAggregationInterval(durationHours)

    // Calculate cell dimensions
    cellsPerDevice ← CEILING(durationHours * 60 / aggregationMinutes)
    totalCells ← cellsPerDevice * pointCount

    // Estimate points per cell (assumes 1-minute data collection)
    pointsPerCell ← aggregationMinutes

    // Determine quality rating
    quality ← DetermineDataQuality(aggregationMinutes, durationHours)

    // Generate recommendation
    recommendation ← GenerateRecommendation(quality, durationHours, cellsPerDevice)

    RETURN {
        durationHours: durationHours,
        aggregationMinutes: aggregationMinutes,
        cellsPerDevice: cellsPerDevice,
        totalCells: totalCells,
        pointsPerCell: pointsPerCell,
        resolution: FormatResolution(aggregationMinutes),
        quality: quality,
        recommendation: recommendation
    }
END

SUBROUTINE: DetermineAggregationInterval
INPUT: durationHours (number)
OUTPUT: aggregationMinutes (number)

BEGIN
    IF durationHours <= 24 THEN
        RETURN 15  // 15-minute intervals for 1 day
    ELSE IF durationHours <= 168 THEN  // 1 week
        RETURN 60  // 1-hour intervals
    ELSE IF durationHours <= 720 THEN  // 30 days
        RETURN 240  // 4-hour intervals
    ELSE IF durationHours <= 2160 THEN  // 90 days
        RETURN 1440  // 1-day intervals
    ELSE
        RETURN 1440  // Cap at daily aggregation
    END IF
END

SUBROUTINE: DetermineDataQuality
INPUT: aggregationMinutes (number), durationHours (number)
OUTPUT: quality (string: "Excellent", "Good", "Fair", "Poor")

BEGIN
    // Quality based on detail vs. overview balance
    IF aggregationMinutes <= 15 AND durationHours <= 168 THEN
        RETURN "Excellent"
    ELSE IF aggregationMinutes <= 60 AND durationHours <= 720 THEN
        RETURN "Good"
    ELSE IF aggregationMinutes <= 240 THEN
        RETURN "Fair"
    ELSE
        RETURN "Poor"
    END IF
END
```

## 4. Deviation Configuration with Smart Defaults

```
ALGORITHM: ConfigureDeviationWithSmartDefaults
INPUT: unit (string), points (array), timeRange (object)
OUTPUT: deviationConfig (object)

BEGIN
    // Get smart defaults for unit
    defaults ← SuggestDefaultsForUnit(unit)

    // Analyze historical data for better defaults
    IF timeRange IS NOT NULL THEN
        historicalStats ← AnalyzeHistoricalData(points, timeRange)
        IF historicalStats IS NOT NULL THEN
            defaults ← RefineDefaultsWithHistoricalData(defaults, historicalStats)
        END IF
    END IF

    // Initialize configuration UI
    configurator ← InitializeDeviationConfigurator({
        mode: defaults.mode,
        setpoint: defaults.setpoint,
        tolerance: defaults.tolerance,
        minValue: defaults.minValue,
        maxValue: defaults.maxValue,
        unit: unit,
        showExamples: true,
        showHistoricalStats: historicalStats IS NOT NULL
    })

    // Show helpful guidance
    ShowConfigurationGuidance(unit, defaults)

    WHILE configurator.isOpen DO
        event ← WaitForUserInput()

        IF event.type == "config_changed" THEN
            // Real-time validation
            currentConfig ← configurator.getCurrentConfig()
            validation ← ValidateDeviationConfig(currentConfig, unit)

            // Update UI with validation feedback
            configurator.updateValidation(validation)

            // Show color scale preview
            colorPreview ← GenerateColorScalePreview(currentConfig)
            configurator.updateColorPreview(colorPreview)

        ELSE IF event.type == "mode_changed" THEN
            // Switch between single setpoint and range modes
            configurator.updateUIForMode(event.newMode)

        ELSE IF event.type == "use_historical" THEN
            // Apply historical statistics
            IF historicalStats IS NOT NULL THEN
                configurator.applyHistoricalDefaults(historicalStats)
            END IF

        ELSE IF event.type == "confirm" THEN
            finalConfig ← configurator.getCurrentConfig()
            validation ← ValidateDeviationConfig(finalConfig, unit)

            IF validation.hasErrors THEN
                ShowErrorDialog(validation.errors)
                CONTINUE
            END IF

            IF validation.hasWarnings THEN
                confirmed ← ShowWarningDialog(validation.warnings)
                IF NOT confirmed THEN
                    CONTINUE
                END IF
            END IF

            RETURN {
                config: finalConfig,
                cancelled: false
            }

        ELSE IF event.type == "cancel" THEN
            RETURN {
                config: null,
                cancelled: true
            }
        END IF
    END WHILE
END

SUBROUTINE: SuggestDefaultsForUnit
INPUT: unit (string)
OUTPUT: defaults (object)

DATA STRUCTURE: UnitPresetsTable
    Type: Hash Map
    Purpose: Store predefined defaults for common units

    Entries:
        "°F" → { mode: "single", setpoint: 72, tolerance: 2, description: "Room temperature" }
        "°C" → { mode: "single", setpoint: 22, tolerance: 1, description: "Room temperature" }
        "%RH" → { mode: "range", minValue: 30, maxValue: 60, tolerance: 10, description: "Comfort range" }
        '"H2O' → { mode: "single", setpoint: -0.02, tolerance: 0.005, description: "Static pressure" }
        "psi" → { mode: "single", setpoint: 15, tolerance: 0.5, description: "Building pressure" }
        "CFM" → { mode: "single", setpoint: 1000, tolerance: 100, description: "Airflow" }
        "%" → { mode: "single", setpoint: 50, tolerance: 10, description: "Percentage" }

BEGIN
    IF UnitPresetsTable.has(unit) THEN
        RETURN UnitPresetsTable.get(unit)
    ELSE
        // Generic defaults for unknown units
        RETURN {
            mode: "single",
            setpoint: 0,
            tolerance: 1,
            description: "Custom unit"
        }
    END IF
END

SUBROUTINE: AnalyzeHistoricalData
INPUT: points (array), timeRange (object)
OUTPUT: stats (object) or null

BEGIN
    // Query aggregated historical data
    TRY
        data ← QueryHistoricalData(points, timeRange, "1hour")

        IF data.length == 0 THEN
            RETURN null
        END IF

        // Calculate statistics across all points
        allValues ← []
        FOR EACH point IN points DO
            pointValues ← data.filter(d → d.pointId == point.id).map(d → d.value)
            allValues ← allValues.concat(pointValues)
        END FOR

        // Statistical analysis
        stats ← {
            mean: CalculateMean(allValues),
            median: CalculateMedian(allValues),
            stdDev: CalculateStdDev(allValues),
            min: Min(allValues),
            max: Max(allValues),
            p5: CalculatePercentile(allValues, 5),
            p95: CalculatePercentile(allValues, 95),
            sampleSize: allValues.length
        }

        RETURN stats

    CATCH error
        LogError("Failed to analyze historical data", error)
        RETURN null
    END TRY
END

SUBROUTINE: RefineDefaultsWithHistoricalData
INPUT: defaults (object), historicalStats (object)
OUTPUT: refinedDefaults (object)

BEGIN
    refined ← Clone(defaults)

    IF defaults.mode == "single" THEN
        // Use median as setpoint (more robust than mean)
        refined.setpoint ← RoundToSignificantDigits(historicalStats.median, 2)

        // Use standard deviation for tolerance (1 sigma covers ~68%)
        refined.tolerance ← RoundToSignificantDigits(historicalStats.stdDev, 2)

        // Ensure tolerance is reasonable
        IF refined.tolerance < ABS(refined.setpoint) * 0.01 THEN
            refined.tolerance ← ABS(refined.setpoint) * 0.05
        END IF

        IF refined.tolerance > ABS(refined.setpoint) * 0.5 THEN
            refined.tolerance ← ABS(refined.setpoint) * 0.2
        END IF

    ELSE IF defaults.mode == "range" THEN
        // Use 5th and 95th percentiles for range
        refined.minValue ← RoundToSignificantDigits(historicalStats.p5, 2)
        refined.maxValue ← RoundToSignificantDigits(historicalStats.p95, 2)

        // Tolerance as 10% of range
        rangeSize ← refined.maxValue - refined.minValue
        refined.tolerance ← RoundToSignificantDigits(rangeSize * 0.1, 2)
    END IF

    refined.source ← "historical_data"
    refined.historicalStats ← historicalStats

    RETURN refined
END
```

## 5. Configuration Validation

```
ALGORITHM: ValidateDeviationConfig
INPUT: config (object), unit (string)
OUTPUT: validation (object with errors, warnings, hasErrors, hasWarnings)

BEGIN
    errors ← []
    warnings ← []

    // Mode-specific validation
    IF config.mode == "single" THEN
        errors ← errors.concat(ValidateSingleMode(config))
        warnings ← warnings.concat(WarnSingleMode(config))

    ELSE IF config.mode == "range" THEN
        errors ← errors.concat(ValidateRangeMode(config))
        warnings ← warnings.concat(WarnRangeMode(config))

    ELSE
        errors.push({
            field: "mode",
            message: "Invalid mode. Must be 'single' or 'range'"
        })
    END IF

    // Unit-specific validation
    unitWarnings ← ValidateUnitSpecificRules(config, unit)
    warnings ← warnings.concat(unitWarnings)

    RETURN {
        errors: errors,
        warnings: warnings,
        hasErrors: errors.length > 0,
        hasWarnings: warnings.length > 0,
        isValid: errors.length == 0
    }
END

SUBROUTINE: ValidateSingleMode
INPUT: config (object)
OUTPUT: errors (array)

BEGIN
    errors ← []

    // Required fields
    IF config.setpoint IS UNDEFINED OR config.setpoint IS NULL THEN
        errors.push({
            field: "setpoint",
            message: "Setpoint is required",
            severity: "error"
        })
    ELSE IF NOT IsNumeric(config.setpoint) THEN
        errors.push({
            field: "setpoint",
            message: "Setpoint must be a valid number",
            severity: "error"
        })
    END IF

    IF config.tolerance IS UNDEFINED OR config.tolerance IS NULL THEN
        errors.push({
            field: "tolerance",
            message: "Tolerance is required",
            severity: "error"
        })
    ELSE IF NOT IsNumeric(config.tolerance) THEN
        errors.push({
            field: "tolerance",
            message: "Tolerance must be a valid number",
            severity: "error"
        })
    ELSE IF config.tolerance <= 0 THEN
        errors.push({
            field: "tolerance",
            message: "Tolerance must be greater than zero",
            severity: "error"
        })
    END IF

    RETURN errors
END

SUBROUTINE: WarnSingleMode
INPUT: config (object)
OUTPUT: warnings (array)

BEGIN
    warnings ← []

    IF config.tolerance IS DEFINED AND config.setpoint IS DEFINED THEN
        // Warning: Tolerance too large
        IF config.tolerance > ABS(config.setpoint) THEN
            warnings.push({
                field: "tolerance",
                message: "Tolerance is larger than setpoint. Most values will appear green (in range).",
                severity: "warning",
                suggestion: "Consider reducing tolerance to " +
                           RoundToSignificantDigits(ABS(config.setpoint) * 0.2, 2)
            })
        END IF

        // Warning: Tolerance too small
        IF config.setpoint != 0 AND config.tolerance < ABS(config.setpoint) * 0.01 THEN
            warnings.push({
                field: "tolerance",
                message: "Tolerance is very small (< 1% of setpoint). Most values will appear red/blue (out of range).",
                severity: "warning",
                suggestion: "Consider increasing tolerance to " +
                           RoundToSignificantDigits(ABS(config.setpoint) * 0.05, 2)
            })
        END IF

        // Warning: Very large values
        IF ABS(config.setpoint) > 1000 THEN
            warnings.push({
                field: "setpoint",
                message: "Large setpoint value detected. Verify this is correct.",
                severity: "info"
            })
        END IF
    END IF

    RETURN warnings
END

SUBROUTINE: ValidateRangeMode
INPUT: config (object)
OUTPUT: errors (array)

BEGIN
    errors ← []

    // Required fields
    IF config.minValue IS UNDEFINED OR config.minValue IS NULL THEN
        errors.push({
            field: "minValue",
            message: "Minimum value is required",
            severity: "error"
        })
    ELSE IF NOT IsNumeric(config.minValue) THEN
        errors.push({
            field: "minValue",
            message: "Minimum value must be a valid number",
            severity: "error"
        })
    END IF

    IF config.maxValue IS UNDEFINED OR config.maxValue IS NULL THEN
        errors.push({
            field: "maxValue",
            message: "Maximum value is required",
            severity: "error"
        })
    ELSE IF NOT IsNumeric(config.maxValue) THEN
        errors.push({
            field: "maxValue",
            message: "Maximum value must be a valid number",
            severity: "error"
        })
    END IF

    // Range validation
    IF config.minValue IS DEFINED AND config.maxValue IS DEFINED THEN
        IF config.minValue >= config.maxValue THEN
            errors.push({
                field: "maxValue",
                message: "Maximum value must be greater than minimum value",
                severity: "error"
            })
        END IF

        IF config.maxValue - config.minValue < 0.01 THEN
            errors.push({
                field: "range",
                message: "Range is too narrow. Difference must be at least 0.01",
                severity: "error"
            })
        END IF
    END IF

    // Tolerance validation
    IF config.tolerance IS DEFINED THEN
        IF NOT IsNumeric(config.tolerance) THEN
            errors.push({
                field: "tolerance",
                message: "Tolerance must be a valid number",
                severity: "error"
            })
        ELSE IF config.tolerance <= 0 THEN
            errors.push({
                field: "tolerance",
                message: "Tolerance must be greater than zero",
                severity: "error"
            })
        END IF
    END IF

    RETURN errors
END

SUBROUTINE: WarnRangeMode
INPUT: config (object)
OUTPUT: warnings (array)

BEGIN
    warnings ← []

    IF config.minValue IS DEFINED AND config.maxValue IS DEFINED THEN
        rangeSize ← config.maxValue - config.minValue

        // Warning: Tolerance too large relative to range
        IF config.tolerance IS DEFINED AND config.tolerance > rangeSize * 0.5 THEN
            warnings.push({
                field: "tolerance",
                message: "Tolerance is more than 50% of the range. Most values will appear green.",
                severity: "warning",
                suggestion: "Consider reducing tolerance to " +
                           RoundToSignificantDigits(rangeSize * 0.2, 2)
            })
        END IF

        // Warning: Tolerance too small relative to range
        IF config.tolerance IS DEFINED AND config.tolerance < rangeSize * 0.05 THEN
            warnings.push({
                field: "tolerance",
                message: "Tolerance is very small (< 5% of range). Color transitions may be too sharp.",
                severity: "warning",
                suggestion: "Consider increasing tolerance to " +
                           RoundToSignificantDigits(rangeSize * 0.1, 2)
            })
        END IF
    END IF

    RETURN warnings
END

SUBROUTINE: ValidateUnitSpecificRules
INPUT: config (object), unit (string)
OUTPUT: warnings (array)

BEGIN
    warnings ← []

    // Temperature validation
    IF unit == "°F" OR unit == "°C" THEN
        IF config.mode == "single" THEN
            // Typical room temperature ranges
            IF unit == "°F" THEN
                IF config.setpoint < 55 OR config.setpoint > 85 THEN
                    warnings.push({
                        field: "setpoint",
                        message: "Setpoint outside typical room temperature range (55-85°F)",
                        severity: "info"
                    })
                END IF
            ELSE  // °C
                IF config.setpoint < 13 OR config.setpoint > 29 THEN
                    warnings.push({
                        field: "setpoint",
                        message: "Setpoint outside typical room temperature range (13-29°C)",
                        severity: "info"
                    })
                END IF
            END IF
        END IF
    END IF

    // Humidity validation
    IF unit == "%RH" THEN
        IF config.mode == "range" THEN
            IF config.minValue < 20 OR config.maxValue > 70 THEN
                warnings.push({
                    field: "range",
                    message: "Humidity range outside typical comfort zone (20-70% RH)",
                    severity: "info"
                })
            END IF
        END IF
    END IF

    // Pressure validation
    IF unit == '"H2O' OR unit == "psi" THEN
        IF config.mode == "single" THEN
            IF ABS(config.tolerance) > ABS(config.setpoint) * 0.5 THEN
                warnings.push({
                    field: "tolerance",
                    message: "Large tolerance for pressure monitoring may miss important deviations",
                    severity: "warning"
                })
            END IF
        END IF
    END IF

    RETURN warnings
END
```

## 6. Configuration Preview and Final Assembly

```
ALGORITHM: ShowConfigurationPreview
INPUT: wizardState (object)
OUTPUT: previewResult (object with action and optional fields)

BEGIN
    // Build preview data
    preview ← {
        points: {
            count: wizardState.points.length,
            unit: wizardState.unit,
            devices: ExtractDeviceNames(wizardState.points)
        },
        timeRange: {
            start: FormatDateTime(wizardState.timeRange.start),
            end: FormatDateTime(wizardState.timeRange.end),
            duration: FormatDuration(wizardState.timeRange)
        },
        aggregation: {
            resolution: wizardState.aggregationImpact.resolution,
            cellsPerDevice: wizardState.aggregationImpact.cellsPerDevice,
            totalCells: wizardState.aggregationImpact.totalCells,
            quality: wizardState.aggregationImpact.quality
        },
        deviation: wizardState.deviationConfig.config,
        colorScale: GenerateColorScalePreview(wizardState.deviationConfig.config)
    }

    // Show preview dialog
    dialog ← InitializePreviewDialog(preview)

    // Generate sample chart preview if possible
    TRY
        sampleData ← GenerateSampleHeatmapData(wizardState)
        dialog.showSampleChart(sampleData)
    CATCH error
        LogWarning("Could not generate sample chart", error)
    END TRY

    // Wait for user decision
    WHILE dialog.isOpen DO
        event ← WaitForUserInput()

        IF event.type == "confirm" THEN
            result ← {
                action: "confirm",
                saveAsTemplate: dialog.saveAsTemplateChecked(),
                templateName: dialog.getTemplateName()
            }
            RETURN result

        ELSE IF event.type == "edit_points" THEN
            RETURN { action: "edit_points" }

        ELSE IF event.type == "edit_time_range" THEN
            RETURN { action: "edit_time_range" }

        ELSE IF event.type == "edit_deviation" THEN
            RETURN { action: "edit_deviation" }

        ELSE IF event.type == "cancel" THEN
            RETURN { action: "cancel" }
        END IF
    END WHILE
END

ALGORITHM: BuildFinalConfiguration
INPUT: wizardState (object)
OUTPUT: configuration (object)

BEGIN
    config ← {
        type: "deviation_heatmap",
        version: "1.0",
        created: CurrentTimestamp(),

        points: wizardState.points.map(p → {
            id: p.id,
            name: p.name,
            unit: p.unit,
            deviceId: p.deviceId
        }),

        timeRange: {
            start: wizardState.timeRange.start,
            end: wizardState.timeRange.end,
            aggregationMinutes: wizardState.aggregationImpact.aggregationMinutes
        },

        deviation: {
            mode: wizardState.deviationConfig.config.mode,
            unit: wizardState.unit
        },

        display: {
            colorScale: GenerateColorScale(wizardState.deviationConfig.config),
            showLegend: true,
            showTooltips: true
        },

        metadata: {
            pointCount: wizardState.points.length,
            estimatedCells: wizardState.aggregationImpact.totalCells,
            dataQuality: wizardState.aggregationImpact.quality
        }
    }

    // Add mode-specific fields
    IF wizardState.deviationConfig.config.mode == "single" THEN
        config.deviation.setpoint ← wizardState.deviationConfig.config.setpoint
        config.deviation.tolerance ← wizardState.deviationConfig.config.tolerance
    ELSE IF wizardState.deviationConfig.config.mode == "range" THEN
        config.deviation.minValue ← wizardState.deviationConfig.config.minValue
        config.deviation.maxValue ← wizardState.deviationConfig.config.maxValue
        config.deviation.tolerance ← wizardState.deviationConfig.config.tolerance
    END IF

    RETURN config
END
```

## Complexity Analysis

### Time Complexity

**Main Configuration Flow:**
- Step 1 (Point Selection): O(n) where n = number of available points
- Step 2 (Time Range): O(1) for UI, O(m) for impact calculation where m = number of selected points
- Step 3 (Deviation Config): O(1) for defaults, O(m × t) for historical analysis where t = time range
- Step 4 (Preview): O(m × t) for sample generation
- Overall: O(n + m × t)

**Validation:**
- Single mode validation: O(1)
- Range mode validation: O(1)
- Unit-specific validation: O(1)
- Overall validation: O(1)

**Historical Data Analysis:**
- Query: O(m × t) database query
- Statistical calculations: O(k) where k = data point count
- Overall: O(m × t + k)

### Space Complexity

**Wizard State:**
- Point storage: O(m) where m = selected points
- Time range: O(1)
- Configuration: O(1)
- Historical data cache: O(k) where k = queried data points
- Overall: O(m + k)

**Preview Generation:**
- Sample data: O(c) where c = cell count
- Color scale: O(1)
- Overall: O(c)

### Performance Optimizations

1. **Lazy Loading**: Load point list incrementally as user scrolls
2. **Debouncing**: Delay impact calculations until user stops adjusting time range
3. **Caching**: Cache historical statistics for frequently used time ranges
4. **Incremental Validation**: Validate only changed fields, not entire config
5. **Sample Preview**: Limit sample chart to 100 cells max for quick rendering
