# Deviation Heatmap Configuration State Machine

## State Diagram

```
                                    START
                                      |
                                      v
                              +--------------+
                              |  ENTRY_CHECK |
                              +--------------+
                                      |
                        +-------------+-------------+
                        |                           |
                    [new user]                [returning user]
                        |                           |
                        v                           v
                +--------------+            +--------------+
                |   TUTORIAL   |            |   LOAD_LAST  |
                |   _PROMPT    |            +--------------+
                +--------------+                    |
                        |                           |
            +-----------+----------+                |
            |           |          |                |
       [skip]    [view tutorial] [template]        |
            |           |          |                |
            |           v          v                |
            |     +----------+ +----------+         |
            |     | TUTORIAL | | TEMPLATE |         |
            |     |  _VIEW   | | _SELECT  |         |
            |     +----------+ +----------+         |
            |           |          |                |
            +-----------+----------+----------------+
                        |
                        v
                +--------------+
                |    POINT     |<---+
                |  _SELECTION  |    |
                +--------------+    |
                        |           |
                  [validate]        |
                        |           |
            +-----------+----------+|
            |                      ||
     [invalid/cancel]       [valid]||
            |                      ||
            v                      v|
        +--------+          +--------------+
        | CANCEL |          |   VALIDATE   |
        +--------+          |    _UNITS    |
                            +--------------+
                                    |
                        +-----------+----------+
                        |                      |
                  [compatible]          [incompatible]
                        |                      |
                        |                      v
                        |            +------------------+
                        |            |  UNIT_CONFLICT   |
                        |            |    _DIALOG       |
                        |            +------------------+
                        |                      |
                        |            +---------+---------+
                        |            |                   |
                        |       [filter]            [cancel]
                        |            |                   |
                        |            v                   |
                        |     +--------------+           |
                        |     |   FILTER_BY  |           |
                        |     |    _UNIT     |-----------+
                        |     +--------------+
                        |
                        v
                +--------------+
                |  TIME_RANGE  |<---+
                |  _SELECTION  |    |
                +--------------+    |
                        |           |
                 [on change]        |
                        |           |
                        v           |
            +-------------------+   |
            | CALCULATE_IMPACT  |   |
            +-------------------+   |
                        |           |
                        v           |
            +-------------------+   |
            |  UPDATE_PREVIEW   |   |
            +-------------------+   |
                        |           |
                  [continue]        |
                        |           |
            +-----------+----------+|
            |                      ||
        [cancel]            [confirm]|
            |                      ||
            v                      v|
        +--------+          +--------------+
        | CANCEL |          |  DEVIATION   |<---+
        +--------+          |    _CONFIG   |    |
                            +--------------+    |
                                    |           |
                             [on change]        |
                                    |           |
                                    v           |
                        +-------------------+   |
                        | VALIDATE_CONFIG   |   |
                        +-------------------+   |
                                    |           |
                            +-------+-------+   |
                            |               |   |
                        [errors]      [warnings/ok]
                            |               |   |
                            v               v   |
                    +--------------+  +--------------+
                    | SHOW_ERRORS  |  | SHOW_PREVIEW |
                    +--------------+  +--------------+
                            |               |
                            |        +------+------+
                            |        |             |
                            +---[retry]    [warnings exist]
                                            |
                                            v
                                    +--------------+
                                    |   CONFIRM    |
                                    |   _DIALOG    |
                                    +--------------+
                                            |
                                +-----------+----------+
                                |                      |
                            [cancel]              [continue]
                                |                      |
                                +-----------+----------+
                                            |
                                            v
                                    +--------------+
                                    |    FINAL     |<---+
                                    |   PREVIEW    |    |
                                    +--------------+    |
                                            |           |
                            +---------------+-----------+-----------+
                            |               |           |           |
                       [edit_points]  [edit_time]  [edit_dev]  [confirm]
                            |               |           |           |
                            |               |           |           v
                            |               |           |    +--------------+
                            +---------------+-----------+    |    BUILD     |
                                                             |    _CONFIG   |
                                                             +--------------+
                                                                     |
                                                        +------------+------------+
                                                        |                         |
                                                 [save template]            [no save]
                                                        |                         |
                                                        v                         |
                                            +------------------+                  |
                                            |  SAVE_TEMPLATE   |                  |
                                            +------------------+                  |
                                                        |                         |
                                                        +-------------+-----------+
                                                                      |
                                                                      v
                                                            +------------------+
                                                            |   SAVE_HISTORY   |
                                                            +------------------+
                                                                      |
                                                                      v
                                                                  +--------+
                                                                  |  DONE  |
                                                                  +--------+
```

## State Definitions

### State: ENTRY_CHECK
**Purpose**: Determine initial wizard flow based on user history
**Data**: User context, tutorial status, recent configurations
**Transitions**:
- → TUTORIAL_PROMPT (if new user)
- → LOAD_LAST (if returning user with history)
- → POINT_SELECTION (if tutorial dismissed)

### State: TUTORIAL_PROMPT
**Purpose**: Offer tutorial or template shortcuts to new users
**Data**: Tutorial availability, template list
**Transitions**:
- → TUTORIAL_VIEW (if user chooses tutorial)
- → TEMPLATE_SELECT (if user chooses template)
- → POINT_SELECTION (if user skips)

### State: POINT_SELECTION
**Purpose**: Allow user to select monitoring points
**Data**: Available points, selected points, filters
**Actions**:
- Display point browser with smart filters
- Show real-time selection count
- Enable multi-select and search
**Transitions**:
- → VALIDATE_UNITS (on confirm)
- → CANCEL (on cancel)
- ← FINAL_PREVIEW (if editing from preview)

### State: VALIDATE_UNITS
**Purpose**: Check unit compatibility of selected points
**Data**: Selected points, detected units
**Actions**:
- Analyze units of all selected points
- Detect unit conflicts
**Transitions**:
- → TIME_RANGE_SELECTION (if compatible)
- → UNIT_CONFLICT_DIALOG (if incompatible)

### State: UNIT_CONFLICT_DIALOG
**Purpose**: Resolve unit compatibility issues
**Data**: Conflicting units, point groups by unit
**Actions**:
- Show unit conflict message
- Offer filtering options
**Transitions**:
- → FILTER_BY_UNIT (if user chooses to filter)
- → POINT_SELECTION (if user cancels)

### State: FILTER_BY_UNIT
**Purpose**: Filter points to single unit
**Data**: Selected unit, filtered points
**Actions**:
- Show unit selector
- Filter points by selected unit
**Transitions**:
- → TIME_RANGE_SELECTION (after filtering)
- → POINT_SELECTION (if cancel)

### State: TIME_RANGE_SELECTION
**Purpose**: Select time range with live impact preview
**Data**: Current range, aggregation impact, preview metrics
**Actions**:
- Display time range picker
- Calculate and show aggregation impact
- Update preview panel on range change
**Events**:
- range_changed → CALCULATE_IMPACT
**Transitions**:
- → CALCULATE_IMPACT (on range change)
- → DEVIATION_CONFIG (on confirm)
- → POINT_SELECTION (on back)
- → CANCEL (on cancel)

### State: CALCULATE_IMPACT
**Purpose**: Calculate aggregation impact for current range
**Data**: Time range, point count, aggregation interval
**Actions**:
- Determine optimal aggregation interval
- Calculate cell count and resolution
- Assess data quality
**Transitions**:
- → UPDATE_PREVIEW (automatically)

### State: UPDATE_PREVIEW
**Purpose**: Update preview panel with impact metrics
**Data**: Calculated impact, quality assessment, recommendations
**Actions**:
- Render preview panel
- Show quality indicators
- Display recommendations
**Transitions**:
- → TIME_RANGE_SELECTION (return to picker)

### State: DEVIATION_CONFIG
**Purpose**: Configure deviation settings with smart defaults
**Data**: Unit, defaults, historical stats, current config
**Actions**:
- Display deviation configurator
- Apply smart defaults
- Show color scale preview
- Validate in real-time
**Events**:
- config_changed → VALIDATE_CONFIG
- mode_changed → Update UI
- use_historical → Apply historical defaults
**Transitions**:
- → VALIDATE_CONFIG (on change)
- → SHOW_ERRORS (if validation errors)
- → SHOW_PREVIEW (if warnings)
- → FINAL_PREVIEW (if valid and confirmed)
- → TIME_RANGE_SELECTION (on back)
- → CANCEL (on cancel)

### State: VALIDATE_CONFIG
**Purpose**: Validate deviation configuration
**Data**: Current config, validation rules, unit
**Actions**:
- Run validation rules
- Check for errors and warnings
- Generate validation feedback
**Transitions**:
- → SHOW_ERRORS (if errors exist)
- → CONFIRM_DIALOG (if warnings exist)
- → FINAL_PREVIEW (if valid and no warnings)

### State: SHOW_ERRORS
**Purpose**: Display validation errors to user
**Data**: Error list, field references
**Actions**:
- Show error dialog
- Highlight problematic fields
- Provide suggestions
**Transitions**:
- → DEVIATION_CONFIG (to retry)

### State: CONFIRM_DIALOG
**Purpose**: Confirm configuration despite warnings
**Data**: Warning list, suggestions
**Actions**:
- Show warning dialog
- Explain potential issues
- Offer to continue or edit
**Transitions**:
- → FINAL_PREVIEW (if user confirms)
- → DEVIATION_CONFIG (if user cancels)

### State: FINAL_PREVIEW
**Purpose**: Show complete configuration preview with sample chart
**Data**: Complete wizard state, sample chart data
**Actions**:
- Render configuration summary
- Generate sample heatmap preview
- Show estimated metrics
- Offer edit options
**Transitions**:
- → BUILD_CONFIG (on confirm)
- → POINT_SELECTION (if edit points)
- → TIME_RANGE_SELECTION (if edit time range)
- → DEVIATION_CONFIG (if edit deviation)
- → CANCEL (on cancel)

### State: BUILD_CONFIG
**Purpose**: Assemble final configuration object
**Data**: Wizard state, configuration structure
**Actions**:
- Build configuration object
- Add metadata
- Prepare for save
**Transitions**:
- → SAVE_TEMPLATE (if save as template checked)
- → SAVE_HISTORY (if not saving as template)

### State: SAVE_TEMPLATE
**Purpose**: Save configuration as reusable template
**Data**: Configuration, template name, user metadata
**Actions**:
- Validate template name
- Save to template storage
- Confirm save
**Transitions**:
- → SAVE_HISTORY (automatically)

### State: SAVE_HISTORY
**Purpose**: Save configuration to user history
**Data**: Configuration, timestamp, user ID
**Actions**:
- Add to configuration history
- Update recent configs
- Trigger autosave
**Transitions**:
- → DONE (automatically)

### State: DONE
**Purpose**: Complete wizard and return configuration
**Data**: Final configuration object
**Actions**:
- Return configuration to caller
- Close wizard
- Trigger chart render
**Transitions**: None (terminal state)

### State: CANCEL
**Purpose**: Exit wizard without saving
**Data**: None
**Actions**:
- Discard wizard state
- Close wizard
- Return null
**Transitions**: None (terminal state)

## State Transition Table

| Current State         | Event           | Guards                    | Next State            | Side Effects                    |
|-----------------------|-----------------|---------------------------|-----------------------|---------------------------------|
| ENTRY_CHECK           | user_is_new     | -                         | TUTORIAL_PROMPT       | Load tutorial content           |
| ENTRY_CHECK           | user_returning  | -                         | LOAD_LAST             | Load last config                |
| TUTORIAL_PROMPT       | skip            | -                         | POINT_SELECTION       | Mark tutorial as seen           |
| TUTORIAL_PROMPT       | view            | -                         | TUTORIAL_VIEW         | Show tutorial                   |
| TUTORIAL_PROMPT       | template        | -                         | TEMPLATE_SELECT       | Load templates                  |
| POINT_SELECTION       | confirm         | points.length >= 1        | VALIDATE_UNITS        | Store selected points           |
| POINT_SELECTION       | cancel          | -                         | CANCEL                | Discard state                   |
| VALIDATE_UNITS        | compatible      | units.unique == 1         | TIME_RANGE_SELECTION  | Set primary unit                |
| VALIDATE_UNITS        | incompatible    | units.unique > 1          | UNIT_CONFLICT_DIALOG  | Show conflict                   |
| UNIT_CONFLICT_DIALOG  | filter          | -                         | FILTER_BY_UNIT        | Show unit selector              |
| UNIT_CONFLICT_DIALOG  | cancel          | -                         | POINT_SELECTION       | Return to selection             |
| TIME_RANGE_SELECTION  | range_changed   | -                         | CALCULATE_IMPACT      | Trigger calculation             |
| TIME_RANGE_SELECTION  | confirm         | range.valid               | DEVIATION_CONFIG      | Store range                     |
| TIME_RANGE_SELECTION  | cancel          | -                         | CANCEL                | Discard state                   |
| CALCULATE_IMPACT      | complete        | -                         | UPDATE_PREVIEW        | Pass impact data                |
| DEVIATION_CONFIG      | config_changed  | -                         | VALIDATE_CONFIG       | Trigger validation              |
| DEVIATION_CONFIG      | confirm         | validation.isValid        | FINAL_PREVIEW         | Store config                    |
| DEVIATION_CONFIG      | cancel          | -                         | CANCEL                | Discard state                   |
| VALIDATE_CONFIG       | has_errors      | errors.length > 0         | SHOW_ERRORS           | Display errors                  |
| VALIDATE_CONFIG       | has_warnings    | warnings.length > 0       | CONFIRM_DIALOG        | Display warnings                |
| VALIDATE_CONFIG       | valid           | errors.length == 0        | FINAL_PREVIEW         | Proceed to preview              |
| SHOW_ERRORS           | retry           | -                         | DEVIATION_CONFIG      | Return to config                |
| CONFIRM_DIALOG        | continue        | -                         | FINAL_PREVIEW         | Proceed despite warnings        |
| CONFIRM_DIALOG        | cancel          | -                         | DEVIATION_CONFIG      | Return to config                |
| FINAL_PREVIEW         | confirm         | -                         | BUILD_CONFIG          | Finalize config                 |
| FINAL_PREVIEW         | edit_points     | -                         | POINT_SELECTION       | Return to step 1                |
| FINAL_PREVIEW         | edit_time       | -                         | TIME_RANGE_SELECTION  | Return to step 2                |
| FINAL_PREVIEW         | edit_deviation  | -                         | DEVIATION_CONFIG      | Return to step 3                |
| FINAL_PREVIEW         | cancel          | -                         | CANCEL                | Discard state                   |
| BUILD_CONFIG          | complete        | saveAsTemplate == true    | SAVE_TEMPLATE         | Prepare template                |
| BUILD_CONFIG          | complete        | saveAsTemplate == false   | SAVE_HISTORY          | Skip template save              |
| SAVE_TEMPLATE         | complete        | -                         | SAVE_HISTORY          | Template saved                  |
| SAVE_HISTORY          | complete        | -                         | DONE                  | History saved                   |

## State Persistence

**Persistent State** (survives page reload):
- Point selection history
- Template library
- Configuration history
- Tutorial completion status

**Session State** (cleared on wizard close):
- Current wizard step
- Selected points
- Time range
- Deviation config
- Validation results

**Volatile State** (recalculated on change):
- Aggregation impact
- Validation errors/warnings
- Color scale preview
- Sample chart data
