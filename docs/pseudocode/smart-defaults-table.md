# Smart Defaults Lookup Table

## Unit-Based Defaults Database

### Data Structure
```
STRUCTURE: DefaultsDatabase
    Type: Nested Hash Map
    Keys: Unit string → Defaults object

    Access Pattern: O(1) lookup by unit
    Storage: In-memory with lazy initialization
    Update Strategy: Configuration-driven, overridable by admin
```

## Temperature Units

### Fahrenheit (°F)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| Room Temperature | 72 | 2 | 68 | 76 | Standard comfort zone |
| Server Room | 65 | 3 | 62 | 68 | Cool environment |
| Warehouse | 60 | 5 | 55 | 65 | Less critical |
| Clean Room | 70 | 1 | 69 | 71 | Tight control |
| Refrigeration | 38 | 2 | 36 | 40 | Food safety |
| Freezer | 0 | 5 | -5 | 5 | Cold storage |

**Pseudocode:**
```
DEFAULT_FAHRENHEIT = {
    room_temp: {
        mode: "single",
        setpoint: 72,
        tolerance: 2,
        description: "Room temperature",
        typical_range: [65, 80]
    },
    server_room: {
        mode: "single",
        setpoint: 65,
        tolerance: 3,
        description: "Server room cooling"
    },
    refrigeration: {
        mode: "range",
        minValue: 36,
        maxValue: 40,
        tolerance: 2,
        description: "Food refrigeration"
    }
}
```

### Celsius (°C)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| Room Temperature | 22 | 1 | 20 | 24 | Standard comfort zone |
| Server Room | 18 | 2 | 16 | 20 | Cool environment |
| Warehouse | 15 | 3 | 12 | 18 | Less critical |
| Clean Room | 21 | 0.5 | 20.5 | 21.5 | Tight control |
| Refrigeration | 3 | 1 | 2 | 4 | Food safety |
| Freezer | -18 | 3 | -21 | -15 | Cold storage |

**Pseudocode:**
```
DEFAULT_CELSIUS = {
    room_temp: {
        mode: "single",
        setpoint: 22,
        tolerance: 1,
        description: "Room temperature",
        typical_range: [18, 27]
    },
    server_room: {
        mode: "single",
        setpoint: 18,
        tolerance: 2,
        description: "Server room cooling"
    },
    refrigeration: {
        mode: "range",
        minValue: 2,
        maxValue: 4,
        tolerance: 1,
        description: "Food refrigeration"
    }
}
```

## Humidity

### Relative Humidity (%RH)

| Application | Min | Max | Tolerance | Ideal Setpoint | Notes |
|-------------|-----|-----|-----------|----------------|-------|
| Office/Comfort | 30 | 60 | 10 | 45 | Human comfort range |
| Server Room | 40 | 60 | 5 | 50 | Prevent static, condensation |
| Museum/Archive | 45 | 55 | 3 | 50 | Preserve materials |
| Warehouse | 30 | 70 | 15 | 50 | Less critical |
| Clean Room | 30 | 50 | 5 | 40 | Manufacturing |
| Greenhouse | 60 | 80 | 10 | 70 | Plant growth |

**Pseudocode:**
```
DEFAULT_HUMIDITY = {
    comfort: {
        mode: "range",
        minValue: 30,
        maxValue: 60,
        tolerance: 10,
        description: "Comfort zone",
        ideal: 45
    },
    server_room: {
        mode: "range",
        minValue: 40,
        maxValue: 60,
        tolerance: 5,
        description: "Data center"
    },
    museum: {
        mode: "single",
        setpoint: 50,
        tolerance: 3,
        description: "Preservation"
    }
}
```

## Pressure

### Inches of Water Column ("H2O, "WC, inWC)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| Building Pressure | -0.02 | 0.005 | -0.03 | -0.01 | Slight negative |
| Duct Static | 1.0 | 0.1 | 0.9 | 1.1 | Low pressure |
| Filter DP | 0.5 | 0.2 | 0.3 | 0.7 | Clean filter baseline |
| Clean Room | 0.05 | 0.01 | 0.04 | 0.06 | Positive pressure |

**Pseudocode:**
```
DEFAULT_INCHES_WATER = {
    building_pressure: {
        mode: "single",
        setpoint: -0.02,
        tolerance: 0.005,
        description: "Building static pressure",
        unit_display: '"H2O'
    },
    duct_static: {
        mode: "single",
        setpoint: 1.0,
        tolerance: 0.1,
        description: "Duct static pressure"
    },
    filter_dp: {
        mode: "range",
        minValue: 0.3,
        maxValue: 0.7,
        tolerance: 0.2,
        description: "Filter differential pressure",
        alert_threshold: 1.0
    }
}
```

### Pounds per Square Inch (psi)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| Building Pressure | 0.01 | 0.002 | 0.008 | 0.012 | Very low |
| Water System | 50 | 5 | 45 | 55 | Domestic water |
| Chilled Water | 15 | 2 | 13 | 17 | HVAC system |
| Steam | 100 | 10 | 90 | 110 | Low pressure steam |
| Compressed Air | 90 | 5 | 85 | 95 | Shop air |

**Pseudocode:**
```
DEFAULT_PSI = {
    building_pressure: {
        mode: "single",
        setpoint: 0.01,
        tolerance: 0.002,
        description: "Building pressure"
    },
    water_system: {
        mode: "range",
        minValue: 45,
        maxValue: 55,
        tolerance: 5,
        description: "Domestic water pressure",
        alert_low: 40,
        alert_high: 60
    },
    chilled_water: {
        mode: "single",
        setpoint: 15,
        tolerance: 2,
        description: "Chilled water loop"
    }
}
```

### Pascals (Pa)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| Building Pressure | 5 | 2 | 3 | 7 | Slight positive |
| Room Pressure | 10 | 3 | 7 | 13 | Isolation room |
| Duct Static | 250 | 25 | 225 | 275 | Supply duct |
| Clean Room | 15 | 5 | 10 | 20 | Positive cascade |

**Pseudocode:**
```
DEFAULT_PASCALS = {
    building_pressure: {
        mode: "single",
        setpoint: 5,
        tolerance: 2,
        description: "Building pressure"
    },
    room_pressure: {
        mode: "single",
        setpoint: 10,
        tolerance: 3,
        description: "Isolation room pressure"
    },
    duct_static: {
        mode: "single",
        setpoint: 250,
        tolerance: 25,
        description: "Supply duct static"
    }
}
```

## Airflow

### Cubic Feet per Minute (CFM)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| VAV Box | 1000 | 100 | 900 | 1100 | Variable volume |
| Fume Hood | 500 | 50 | 450 | 550 | Safety critical |
| Exhaust Fan | 5000 | 500 | 4500 | 5500 | Constant volume |
| Supply Fan | 20000 | 2000 | 18000 | 22000 | Main AHU |

**Pseudocode:**
```
DEFAULT_CFM = {
    vav_box: {
        mode: "single",
        setpoint: 1000,
        tolerance: 100,
        description: "VAV box airflow",
        percent_tolerance: 10
    },
    fume_hood: {
        mode: "single",
        setpoint: 500,
        tolerance: 50,
        description: "Fume hood exhaust",
        safety_critical: true,
        alert_threshold: 450
    },
    supply_fan: {
        mode: "range",
        minValue: 18000,
        maxValue: 22000,
        tolerance: 2000,
        description: "Supply fan airflow"
    }
}
```

### Liters per Second (L/s)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| VAV Box | 500 | 50 | 450 | 550 | Variable volume |
| Exhaust | 250 | 25 | 225 | 275 | Room exhaust |
| Supply Fan | 10000 | 1000 | 9000 | 11000 | Main AHU |

## Energy & Power

### Kilowatts (kW)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| Chiller | 500 | 50 | 450 | 550 | Large chiller |
| AHU | 50 | 10 | 40 | 60 | Air handler |
| Lighting | 20 | 5 | 15 | 25 | Zone lighting |
| Plug Loads | 10 | 3 | 7 | 13 | Office equipment |

**Pseudocode:**
```
DEFAULT_KILOWATTS = {
    chiller: {
        mode: "range",
        minValue: 450,
        maxValue: 550,
        tolerance: 50,
        description: "Chiller power",
        efficiency_target: 0.6  // kW/ton
    },
    ahu: {
        mode: "single",
        setpoint: 50,
        tolerance: 10,
        description: "Air handler power"
    }
}
```

### Tons (Cooling)

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| Chiller | 300 | 30 | 270 | 330 | Large chiller |
| RTU | 20 | 5 | 15 | 25 | Rooftop unit |
| Zone | 5 | 1 | 4 | 6 | Small zone |

## Percentages (%)

### Generic Percentage

| Application | Setpoint | Tolerance | Min Range | Max Range | Notes |
|-------------|----------|-----------|-----------|-----------|-------|
| Valve Position | 50 | 10 | 40 | 60 | Modulating valve |
| Damper Position | 50 | 10 | 40 | 60 | Modulating damper |
| VFD Speed | 75 | 10 | 65 | 85 | Variable speed |
| Occupancy | 80 | 10 | 70 | 90 | Target occupancy |
| Efficiency | 85 | 5 | 80 | 90 | System efficiency |

**Pseudocode:**
```
DEFAULT_PERCENT = {
    valve_position: {
        mode: "single",
        setpoint: 50,
        tolerance: 10,
        description: "Modulating valve position",
        range: [0, 100]
    },
    vfd_speed: {
        mode: "single",
        setpoint: 75,
        tolerance: 10,
        description: "VFD speed",
        range: [20, 100],
        min_speed: 20
    },
    efficiency: {
        mode: "range",
        minValue: 80,
        maxValue: 90,
        tolerance: 5,
        description: "System efficiency"
    }
}
```

## Default Selection Algorithm

```
ALGORITHM: SelectSmartDefault
INPUT: unit (string), context (object)
OUTPUT: defaultConfig (object)

BEGIN
    // Normalize unit string
    normalizedUnit ← NormalizeUnit(unit)

    // Lookup base defaults
    IF DefaultsDatabase.has(normalizedUnit) THEN
        baseDefaults ← DefaultsDatabase.get(normalizedUnit)
    ELSE
        baseDefaults ← GenericDefaults
    END IF

    // Context-aware refinement
    IF context IS NOT NULL THEN
        // Check for application hints
        IF context.pointName IS DEFINED THEN
            application ← InferApplication(context.pointName)
            IF baseDefaults.has(application) THEN
                baseDefaults ← baseDefaults.get(application)
            END IF
        END IF

        // Check for system type
        IF context.systemType IS DEFINED THEN
            systemDefaults ← GetSystemDefaults(context.systemType, normalizedUnit)
            IF systemDefaults IS NOT NULL THEN
                baseDefaults ← MergeDefaults(baseDefaults, systemDefaults)
            END IF
        END IF

        // Check for location/climate
        IF context.location IS DEFINED THEN
            locationAdjustments ← GetLocationAdjustments(context.location, normalizedUnit)
            baseDefaults ← ApplyAdjustments(baseDefaults, locationAdjustments)
        END IF
    END IF

    RETURN baseDefaults
END

SUBROUTINE: InferApplication
INPUT: pointName (string)
OUTPUT: application (string)

BEGIN
    pointNameLower ← ToLowerCase(pointName)

    // Temperature application inference
    IF Contains(pointNameLower, ["room", "zone", "space"]) THEN
        RETURN "room_temp"
    ELSE IF Contains(pointNameLower, ["server", "data center"]) THEN
        RETURN "server_room"
    ELSE IF Contains(pointNameLower, ["refriger", "cooler"]) THEN
        RETURN "refrigeration"
    ELSE IF Contains(pointNameLower, ["freeze"]) THEN
        RETURN "freezer"
    END IF

    // Pressure application inference
    IF Contains(pointNameLower, ["building", "static"]) THEN
        RETURN "building_pressure"
    ELSE IF Contains(pointNameLower, ["filter", "differential", "dp"]) THEN
        RETURN "filter_dp"
    ELSE IF Contains(pointNameLower, ["clean room", "cleanroom"]) THEN
        RETURN "clean_room"
    END IF

    // Airflow application inference
    IF Contains(pointNameLower, ["vav", "variable"]) THEN
        RETURN "vav_box"
    ELSE IF Contains(pointNameLower, ["fume", "hood"]) THEN
        RETURN "fume_hood"
    ELSE IF Contains(pointNameLower, ["supply fan", "sf"]) THEN
        RETURN "supply_fan"
    END IF

    // Default
    RETURN "generic"
END

SUBROUTINE: NormalizeUnit
INPUT: unit (string)
OUTPUT: normalized (string)

DATA STRUCTURE: UnitAliases
    Type: Hash Map
    Purpose: Map unit variations to canonical form

    Entries:
        ["°F", "degF", "deg F", "Fahrenheit"] → "°F"
        ["°C", "degC", "deg C", "Celsius"] → "°C"
        ["%RH", "% RH", "RH", "%Humidity"] → "%RH"
        ['"H2O', '"WC', "inWC", "in WC", "inches water"] → '"H2O'
        ["psi", "PSI", "lb/in2"] → "psi"
        ["Pa", "pascal", "Pascals"] → "Pa"
        ["CFM", "cfm", "ft3/min"] → "CFM"
        ["L/s", "L/sec", "liters/sec"] → "L/s"
        ["kW", "kw", "kilowatt"] → "kW"
        ["%", "percent", "pct"] → "%"

BEGIN
    trimmed ← Trim(unit)

    FOR EACH alias, canonical IN UnitAliases DO
        IF trimmed IN alias THEN
            RETURN canonical
        END IF
    END FOR

    // Return as-is if no match
    RETURN trimmed
END
```

## Generic Fallback Defaults

```
GENERIC_DEFAULTS = {
    mode: "single",
    setpoint: 0,
    tolerance: 1,
    description: "Generic monitoring",
    notes: "Please configure appropriate values for your application",
    warning: "Using generic defaults. Customize for your specific use case."
}
```

## Complexity Analysis

**Lookup Performance:**
- Unit normalization: O(1) average with hash map
- Base defaults lookup: O(1) hash map access
- Application inference: O(n) where n = keywords, typically n < 20
- Context refinement: O(1) per refinement step
- Overall: O(1) amortized

**Storage:**
- Per unit: ~200 bytes (config object)
- Total units: ~30 common units
- Total storage: ~6 KB uncompressed
- Negligible memory footprint
