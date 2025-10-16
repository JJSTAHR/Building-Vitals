# Dual-Name Display Visual Examples

## Visual Reference for All Chart Types

---

## 1. Time Series Chart

### Y-Axis Label (Single Series)
```
┌─────────────────────────────────┐
│                                 │
│ 85°F ─                          │
│      │                          │
│ 80°F ─                          │
│      │         /\               │
│ 75°F ─        /  \              │
│      │       /    \             │
│ 70°F ─      /      \            │
│      │     /        \           │
│ 65°F ─────┴──────────┴─────     │
│                                 │
│      8AM  10AM  12PM  2PM       │
│                                 │
└─────────────────────────────────┘
     ↑
     │
     VAV Rm 200 Discharge Air Temp
     (r:campus_1 r:building_4 VAV:vav_rm_200 dis...)
```

### Legend (Multiple Series)
```
Legend:
  ● VAV Rm 200 Discharge Temp
  ● VAV Rm 201 Discharge Temp
  ● VAV Rm 202 Discharge Temp
```

### Tooltip (Hover)
```
┌─────────────────────────────────────┐
│ October 16, 2025 10:30 AM          │
├─────────────────────────────────────┤
│ ● VAV Rm 200 Discharge Air Temp    │
│   Value: 72.5°F                     │
│   API: r:campus_1 r:building_4...   │
│                                     │
│ ● VAV Rm 201 Discharge Air Temp    │
│   Value: 71.8°F                     │
│   API: r:campus_1 r:building_4...   │
└─────────────────────────────────────┘
```

---

## 2. Bar Chart

### X-Axis Labels (Horizontal Bars)
```
          0    20    40    60    80   100

VAV Rm 200 Temp          ████████████
(r:campus_1...)

VAV Rm 201 Temp             ███████████████
(r:campus_1...)

VAV Rm 202 Temp       ██████████
(r:campus_1...)
```

### X-Axis Labels (Vertical Bars)
```
          ┌───┐
     80°F │   │
          │ █ │
          │ █ │
     60°F │ █ │
          │ █ │    ┌───┐
          │ █ │    │ █ │
     40°F │ █ │    │ █ │
          │ █ │    │ █ │
          │ █ │    │ █ │    ┌───┐
     20°F │ █ │    │ █ │    │ █ │
          └───┘    └───┘    └───┘
           VAV      VAV      VAV
          Rm 200   Rm 201   Rm 202
          Temp     Temp     Temp
        (r:camp..)(r:camp..)(r:camp..)
```

### Tooltip
```
┌─────────────────────────────────────┐
│ VAV Rm 200 Discharge Air Temp      │
│ (r:campus_1 r:building_4...)       │
│                                     │
│ Value: 72.5°F                       │
│ Time: October 16, 2025 10:30 AM    │
└─────────────────────────────────────┘
```

---

## 3. Scatter Plot

### Axes
```
        │
   80°F │                        ○
        │              ○    ○
        │         ○        ○
   60°F │    ○         ○
        │ ○      ○
        │
   40°F │
        └────────────────────────────
         40%    60%    80%   100%

         X: Outdoor Air Humidity
         Y: VAV Discharge Temp
```

### Tooltip
```
┌─────────────────────────────────────┐
│ X-Axis Point:                       │
│ Outdoor Air Humidity                │
│ (r:campus_1 r:building_4 oa...)    │
│ Value: 65.2%                        │
│                                     │
│ Y-Axis Point:                       │
│ VAV Rm 200 Discharge Air Temp      │
│ (r:campus_1 r:building_4 VAV...)   │
│ Value: 72.5°F                       │
│                                     │
│ Time: October 16, 2025 10:30 AM    │
└─────────────────────────────────────┘
```

---

## 4. Heatmap

### Y-Axis (Point Names)
```
┌──────────────────────────────────────────────┐
│                                              │
│ VAV Rm 200 Discharge Temp  █████████████    │
│ (r:campus_1 r:building...)                  │
│                                              │
│ VAV Rm 201 Discharge Temp  ████████████████ │
│ (r:campus_1 r:building...)                  │
│                                              │
│ VAV Rm 202 Discharge Temp  ███████████      │
│ (r:campus_1 r:building...)                  │
│                                              │
│ VAV Rm 203 Discharge Temp  ██████████████   │
│ (r:campus_1 r:building...)                  │
│                                              │
└──────────────────────────────────────────────┘
       8AM   10AM   12PM    2PM    4PM
```

### Tooltip
```
┌─────────────────────────────────────┐
│ Point:                              │
│ VAV Rm 200 Discharge Air Temp      │
│ (r:campus_1 r:building_4...)       │
│                                     │
│ Time: October 16, 2025 10:30 AM    │
│ Value: 72.5°F                       │
│ Color: Hot (>75°F)                  │
└─────────────────────────────────────┘
```

---

## 5. Device Deviation Heatmap

### Y-Axis (Equipment Names)
```
┌──────────────────────────────────────────────┐
│                                              │
│ VAV Rm 200                  ████████████████ │
│ (VAV:vav_rm_200)           [+2.5°F over]    │
│                                              │
│ VAV Rm 201                  █████████████    │
│ (VAV:vav_rm_201)           [+1.2°F over]    │
│                                              │
│ VAV Rm 202                  ███████████      │
│ (VAV:vav_rm_202)           [Optimal]        │
│                                              │
│ VAV Rm 203                  ████████         │
│ (VAV:vav_rm_203)           [-0.8°F under]   │
│                                              │
└──────────────────────────────────────────────┘
  -6σ  -4σ  -2σ   0    +2σ  +4σ  +6σ
  BLUE         GREEN        RED
```

---

## 6. Perfect Economizer Chart

### Axes
```
        │
   100% │        ●      Optimal Zone
        │       ● ●    (Free Cooling)
        │      ●   ●
        │     ●     ●
   50%  │    ●  ○  ○    ○ = Mechanical Cooling
        │   ●   ○   ○   ● = Free Cooling
        │  ●     ○    ○
        │ ●
    0%  │●________________
         0°F  20°F 40°F 60°F 80°F 100°F

         X: Outside Air Temp (OAT)
            (r:campus_1 r:building_4 oa temp sensor)

         Y: Economizer Damper Position
            (r:campus_1 r:building_4 ahu-1 damper)
```

---

## 7. SPC Chart

### Axes with Control Limits
```
        │
   UCL ─┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  (75.5°F)
        │
        │           ●
   X̄  ─┼─ ─ ● ─ ● ─ ● ─ ● ─ ─ ─ ─ ─  (72.0°F)
        │   ●   ●       ●
        │ ●                   ●
   LCL ─┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  (68.5°F)
        │
        └────────────────────────────
         1   5   10   15   20   25
         Sample Number

         Process: VAV Rm 200 Discharge Air Temp
                  (r:campus_1 r:building_4...)
```

---

## 8. Candlestick Chart

### Y-Axis
```
        │
   85°F │          ┃
        │      ┃   ┃   ┃
   80°F │  ┃   ┃   ║   ┃
        │  ┃   ║   ║   ┃   ┃
   75°F │  ║   ║   ┃   ┃   ┃
        │  ║   ║   ┃   ║   ┃
   70°F │  ║   ┃   ┃   ║   ║
        │  ┃   ┃       ║   ║
   65°F │  ┃           ┃   ┃
        │
        └────────────────────────────
         Mon  Tue  Wed  Thu  Fri

         Point: VAV Rm 200 Discharge Air Temp
                (r:campus_1 r:building_4...)
```

---

## 9. Calendar Heatmap

### Month View
```
   October 2025

   Mon  Tue  Wed  Thu  Fri  Sat  Sun
        1    2    3    4    5    6
   ██   ███  ███  ██   ███  ██   █

   7    8    9    10   11   12   13
   ██   ███  ████ ███  ██   ███  █

   14   15   16   17   18   19   20
   ███  ████ ███  ██   ███  ██   ██

   Point: VAV Rm 200 Daily Avg Temp
          (r:campus_1 r:building_4 VAV:vav_rm_200...)

   Color Scale:
   █ = 68-70°F (Cool)
   ██ = 70-72°F (Normal)
   ███ = 72-74°F (Warm)
   ████ = 74-76°F (Hot)
```

---

## 10. Psychrometric Chart

### Axes
```
        │
   100% │ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
        │╱       Comfort     ╱
        │╱       Zone       ╱
   50%  │╱    ●           ╱
        │     ●  ●       ╱
        │    ●    ●     ╱
        │   ●      ●   ╱
    0%  │──────────────
         40°F  60°F  80°F  100°F

         X: Dry Bulb Temperature
            (r:campus_1 r:building_4 oa temp sensor)

         Y: Relative Humidity
            (r:campus_1 r:building_4 oa humidity sensor)

         ● Current Conditions
         ╱╱ ASHRAE Comfort Zone
```

---

## 11. Sankey Diagram

### Flow Labels
```
                    ┌──────────────┐
    Boiler 1   ────►│   AHU-1      │────► VAV Rm 200
    (r:boiler-1)    │   (r:ahu-1)  │      (r:vav_rm_200)
    3500 BTU/hr     └──────────────┘      1200 BTU/hr
                           │
                           ├────► VAV Rm 201
                           │      (r:vav_rm_201)
                           │      1100 BTU/hr
                           │
                           └────► VAV Rm 202
                                  (r:vav_rm_202)
                                  1200 BTU/hr
```

---

## 12. Gauge Chart

### Single Point Display
```
        ┌─────────────────────────────┐
        │                             │
        │         ╱─────╲             │
        │       ╱         ╲           │
        │     ╱             ╲         │
        │    ╱       72.5°F  ╲        │
        │   ╱          ↑      ╲       │
        │  ╱           │       ╲      │
        │ ╱────────────┴────────╲     │
        │ 60°F               85°F     │
        │                             │
        │ VAV Rm 200 Discharge Temp   │
        │ (r:campus_1 r:building_4    │
        │  VAV:vav_rm_200 dis...)     │
        └─────────────────────────────┘
```

---

## 13. Tooltip HTML Structure

### Full Detail Format
```html
<div style="padding: 8px; max-width: 350px;">
  <!-- Timestamp -->
  <div style="color: rgba(255,255,255,0.7); font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
    October 16, 2025 10:30:45 AM
  </div>

  <!-- Point 1 -->
  <div style="margin-top: 8px;">
    <span style="color: #1976d2;">●</span>
    <div style="margin-left: 24px;">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">
        VAV Rm 200 Discharge Air Temp
      </div>
      <div style="color: rgba(255,255,255,0.5); font-size: 10px; margin-bottom: 4px;">
        r:campus_1 r:building_4 VAV:vav_rm_200 discharge-air-temp sensor
      </div>
      <div style="font-size: 14px;">
        <strong>72.5°F</strong>
      </div>
      <!-- Optional: Tags -->
      <div style="margin-top: 4px; font-size: 10px; color: rgba(255,255,255,0.6);">
        Tags: temp, setpoint, sensor
      </div>
    </div>
  </div>

  <!-- Point 2 -->
  <div style="margin-top: 12px;">
    <span style="color: #d32f2f;">●</span>
    <div style="margin-left: 24px;">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">
        VAV Rm 201 Discharge Air Temp
      </div>
      <div style="color: rgba(255,255,255,0.5); font-size: 10px; margin-bottom: 4px;">
        r:campus_1 r:building_4 VAV:vav_rm_201 discharge-air-temp sensor
      </div>
      <div style="font-size: 14px;">
        <strong>71.8°F</strong>
      </div>
    </div>
  </div>
</div>
```

---

## 14. Truncation Examples

### Display Name Truncation (35 chars)
```
Original:  "Variable Air Volume Room 200 Discharge Air Temperature Sensor"
Display:   "VAV Room 200 Discharge Air Temperature Sensor"
Truncated: "VAV Room 200 Discharge...ature Sensor" (35 chars)
```

### Original Name Truncation (45 chars)
```
Original:  "r:campus_1 r:building_4 r:floor_2 r:zone_west VAV:vav_rm_200 discharge-air-temp sensor"
Truncated: "r:campus_1 r:building_4 r:floor_2...temp sensor" (45 chars)
```

### Intelligent Truncation Strategy
```
Keep Start (60%): "r:campus_1 r:building_4 r:floor_2..."
Keep End (40%):   "...discharge-air-temp sensor"
Result:           "r:campus_1 r:building_4 r:floor_2...temp sensor"
```

---

## 15. Color Coding (Optional Enhancement)

### Different Name Types
```
┌─────────────────────────────────────┐
│ Display Name (Black/White)          │
│ VAV Rm 200 Discharge Air Temp      │
│                                     │
│ Original API Name (Gray, 60% opacity)│
│ r:campus_1 r:building_4...         │
└─────────────────────────────────────┘
```

### Syntax Highlighting (Future)
```
r:campus_1 r:building_4 VAV:vav_rm_200 discharge-air-temp sensor
^~~~~~~~~  ^~~~~~~~~~~ ^~~^~~~~~~~~~~ ^~~~~~~~~~~~~~~~~~~^ ^~~~~
  Ref      Ref          Type:ID        Property            Type
 (Blue)    (Blue)      (Green)        (Purple)           (Yellow)
```

---

## 16. Responsive Behavior

### Desktop (Wide)
```
Y-Axis: "VAV Rm 200 Discharge Air Temp\n(r:campus_1 r:building_4 VAV:vav_rm_200...)"
```

### Tablet (Medium)
```
Y-Axis: "VAV Rm 200 Discharge Temp\n(r:campus_1 r:building_4...)"
```

### Mobile (Narrow)
```
Y-Axis: "VAV Rm 200 Temp\n(r:campus_1...)"
```

---

## 17. Accessibility Considerations

### Screen Reader Announcement
```
"Chart showing VAV Room 200 Discharge Air Temperature,
 API point name: r colon campus underscore 1, r colon building underscore 4,
 VAV colon vav underscore rm underscore 200, discharge hyphen air hyphen temp sensor.
 Current value: 72.5 degrees Fahrenheit."
```

### High Contrast Mode
```
┌─────────────────────────────────────┐
│ Display Name (High Contrast)        │
│ VAV Rm 200 Discharge Air Temp      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         │
│                                     │
│ Original Name (Sufficient Contrast) │
│ r:campus_1 r:building_4...         │
│ ░░░░░░░░░░░░░░░░░░░░░░░░           │
└─────────────────────────────────────┘
```

---

## 18. Print Output

### Printed Chart Legend
```
Legend:
  ● VAV Rm 200 Discharge Air Temp
    (API: r:campus_1 r:building_4 VAV:vav_rm_200 discharge-air-temp sensor)

  ● VAV Rm 201 Discharge Air Temp
    (API: r:campus_1 r:building_4 VAV:vav_rm_201 discharge-air-temp sensor)
```

---

## 19. Export Formats

### CSV Export
```csv
Timestamp,Point Name,API Name,Value,Unit
2025-10-16 10:30:00,VAV Rm 200 Discharge Air Temp,r:campus_1 r:building_4 VAV:vav_rm_200 discharge-air-temp sensor,72.5,°F
2025-10-16 10:31:00,VAV Rm 200 Discharge Air Temp,r:campus_1 r:building_4 VAV:vav_rm_200 discharge-air-temp sensor,72.6,°F
```

### PNG Export (Chart Image)
```
┌─────────────────────────────────────┐
│ Chart Title                          │
│ VAV Rm 200 Discharge Air Temp       │
│ (r:campus_1 r:building_4...)        │
│                                     │
│ [Chart visualization here]          │
│                                     │
│ Generated: Oct 16, 2025 10:30 AM    │
└─────────────────────────────────────┘
```

---

**Visual Examples Version:** 1.0
**Last Updated:** 2025-10-16
**Status:** Reference Guide
