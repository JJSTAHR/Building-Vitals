# Point Cleaning Architecture - Visual Diagrams

This document contains visual representations of the system architecture.

---

## 1. System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Building Vitals Point Cleaning System                 │
└─────────────────────────────────────────────────────────────────────────┘

                                    INPUT
                    Raw BACnet Point Name (Cryptic)
                    "VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp"
                                      │
                                      ▼
         ┌────────────────────────────────────────────────────┐
         │           Point Cleaning Service                    │
         │  ┌──────────────────────────────────────────────┐  │
         │  │  Stage 1: Tokenization                       │  │
         │  │  ─────────────────────────────────────────── │  │
         │  │  Input:  "AHU-01.707-VAV.Disch-Temp"         │  │
         │  │  Output: [AHU, 01, VAV, 707, Disch, Temp]   │  │
         │  └──────────────────────────────────────────────┘  │
         │                      │                              │
         │                      ▼                              │
         │  ┌──────────────────────────────────────────────┐  │
         │  │  Stage 2: Equipment Extraction               │  │
         │  │  ─────────────────────────────────────────── │  │
         │  │  Tokens → Equipment Info                     │  │
         │  │  • Type: VAV                                 │  │
         │  │  • ID: 707                                   │  │
         │  │  • Hierarchy: [AHU-01, VAV-707]             │  │
         │  └──────────────────────────────────────────────┘  │
         │                      │                              │
         │                      ▼                              │
         │  ┌──────────────────────────────────────────────┐  │
         │  │  Stage 3: Point Extraction                   │  │
         │  │  ─────────────────────────────────────────── │  │
         │  │  Tokens + Equipment → Point Info             │  │
         │  │  • Type: Temperature                         │  │
         │  │  • Purpose: Discharge                        │  │
         │  │  • Data Type: Analog                         │  │
         │  └──────────────────────────────────────────────┘  │
         │                      │                              │
         │                      ▼                              │
         │  ┌──────────────────────────────────────────────┐  │
         │  │  Stage 4: Unit & Context Detection           │  │
         │  │  ─────────────────────────────────────────── │  │
         │  │  Point Info → Unit + Context                 │  │
         │  │  • Unit: °F (inferred from Temperature)      │  │
         │  │  • Location: Discharge                       │  │
         │  └──────────────────────────────────────────────┘  │
         │                      │                              │
         │                      ▼                              │
         │  ┌──────────────────────────────────────────────┐  │
         │  │  Stage 5: Display Name Generation            │  │
         │  │  ─────────────────────────────────────────── │  │
         │  │  Equipment + Point → Display Names           │  │
         │  │  • Full: "AHU-01 VAV-707 - Discharge Temp"  │  │
         │  │  • Short: "VAV-707 Disch Temp"              │  │
         │  └──────────────────────────────────────────────┘  │
         │                      │                              │
         │                      ▼                              │
         │  ┌──────────────────────────────────────────────┐  │
         │  │  Stage 6: Categorization & Indexing          │  │
         │  │  ─────────────────────────────────────────── │  │
         │  │  Enhanced Point → Categories + Search Index  │  │
         │  │  • Category: "Variable Air Volume Boxes"     │  │
         │  │  • Search: [vav, 707, discharge, temp, ...]  │  │
         │  └──────────────────────────────────────────────┘  │
         └────────────────────────────────────────────────────┘
                                      │
                                      ▼
                                   OUTPUT
                    Enhanced Point (Human-Readable)
         {
           displayName: "AHU-01 VAV-707 - Discharge Temperature",
           equipment: { type: "VAV", id: "707", ... },
           point: { type: "Temperature", purpose: "Discharge", ... },
           category: "Variable Air Volume Boxes",
           searchTerms: ["vav", "707", "discharge", "temperature"],
           confidence: 0.95
         }
```

---

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Point Cleaning Service Layer                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────┐                                            │
│  │ PointCleaningService│                                            │
│  │  (Orchestrator)     │                                            │
│  └────────┬────────────┘                                            │
│           │                                                          │
│           ├─────────┬─────────┬────────────┬────────────┬──────────┤
│           ▼         ▼         ▼            ▼            ▼          │
│  ┌────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Tokenizer  │ │  Equipment   │ │   Point     │ │  Display    │  │
│  │            │ │  Extractor   │ │  Extractor  │ │  Generator  │  │
│  └─────┬──────┘ └──────┬───────┘ └──────┬──────┘ └──────┬──────┘  │
│        │               │                │               │          │
│        │               │                │               │          │
│        └───────────────┴────────────────┴───────────────┘          │
│                                │                                    │
│                                ▼                                    │
│                      ┌──────────────────┐                          │
│                      │  Categorizer     │                          │
│                      └──────────────────┘                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Pattern Library Layer                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Equipment      │  │     Point        │  │      Unit        │  │
│  │   Patterns       │  │   Patterns       │  │    Patterns      │  │
│  │                  │  │                  │  │                  │  │
│  │  • AHU (100)     │  │  • Temp (100)    │  │  • °F → Temp     │  │
│  │  • VAV (90)      │  │  • Press (95)    │  │  • PSI → Press   │  │
│  │  • Chiller (100) │  │  • Flow (95)     │  │  • CFM → Flow    │  │
│  │  • Boiler (100)  │  │  • Status (100)  │  │  • %RH → Humid   │  │
│  │  • Pump (80)     │  │  • Command (90)  │  │  • RPM → Speed   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        Optimization Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Cache          │  │  Search Index    │  │   Performance    │  │
│  │                  │  │                  │  │   Monitor        │  │
│  │  name → enhanced │  │  term → names    │  │                  │  │
│  │  (LRU, 10k max)  │  │  (inverted idx)  │  │  • Parse time    │  │
│  └──────────────────┘  └──────────────────┘  │  • Cache hits    │  │
│                                               │  • Search speed  │  │
│                                               └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Data Flow Through System                      │
└──────────────────────────────────────────────────────────────────────┘

BACnet Discovery
       │
       │ Discover points from devices
       ▼
┌────────────────┐
│  BACnet Point  │
│  ────────────  │
│  name: string  │
│  objectId: str │
│  objectType:   │
└───────┬────────┘
        │
        │ Parse request
        ▼
┌───────────────────────┐
│ PointCleaningService  │ ─────► [Cache Check]
└───────┬───────────────┘           │
        │                           ├─ Hit → Return cached
        │ ◄─────────────────────────┘
        │ Miss → Continue parsing
        ▼
┌───────────────┐
│   Tokenize    │
│   ─────────   │
│   Split       │
│   Classify    │
│   Clean       │
└───────┬───────┘
        │
        │ [AHU, 01, VAV, 707, Disch, Temp]
        ▼
┌────────────────────┐
│ Extract Equipment  │ ──► Match against equipment patterns
│ ────────────────── │     Priority: 100 → 70
│ • Find type        │     Context: Parent → Child
│ • Find ID          │
│ • Build hierarchy  │
└────────┬───────────┘
         │
         │ Equipment: { type: VAV, id: 707, hierarchy: [...] }
         ▼
┌──────────────────┐
│ Extract Point    │ ──► Match against point patterns
│ ──────────────── │     Priority: 100 → 70
│ • Find type      │     Context: Equipment type
│ • Find purpose   │     Purpose patterns: Supply/Return/Discharge
│ • Find location  │
└────────┬─────────┘
         │
         │ Point: { type: Temperature, purpose: Discharge }
         ▼
┌─────────────────────┐
│ Detect Unit/Context │ ──► Match against unit patterns
│ ─────────────────── │     Validate: Unit matches point type
│ • Extract unit      │     Infer: Default unit if missing
│ • Validate          │
│ • Infer defaults    │
└────────┬────────────┘
         │
         │ Unit: °F (inferred from Temperature)
         ▼
┌────────────────────┐
│ Generate Display   │ ──► Apply templates
│ ────────────────── │     Standard: "{equipment} - {point}"
│ • Select template  │     Short: "{equipment} {abbrev}"
│ • Apply variables  │
│ • Format name      │
└────────┬───────────┘
         │
         │ Display: "AHU-01 VAV-707 - Discharge Temperature"
         ▼
┌────────────────────┐
│ Categorize/Index   │ ──► Group by category
│ ────────────────── │     Build search index
│ • Assign category  │     Generate search terms
│ • Build search idx │
│ • Generate tags    │
└────────┬───────────┘
         │
         │ Category: "Variable Air Volume Boxes"
         │ Search: ["vav", "707", "discharge", "temperature"]
         ▼
┌────────────────────┐
│  Enhanced Point    │
│  ────────────────  │
│  displayName       │
│  equipment {...}   │
│  point {...}       │
│  category          │
│  searchTerms [...]  │
│  confidence: 0.95  │
└────────┬───────────┘
         │
         ├─► [Cache Store] ──► Store for future lookups
         │
         ├─► [Search Index] ──► Add to search index
         │
         └─► Return to caller
```

---

## 4. Equipment Hierarchy Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Equipment Hierarchy Model                       │
└──────────────────────────────────────────────────────────────────────┘

Priority 100: System-Level Equipment (Standalone)
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  ┌──────┐   ┌──────┐   ┌─────────┐   ┌────────┐   ┌────────────┐   │
│  │ AHU  │   │ RTU  │   │ Chiller │   │ Boiler │   │  Cooling   │   │
│  │      │   │      │   │         │   │        │   │   Tower    │   │
│  └───┬──┘   └───┬──┘   └────┬────┘   └───┬────┘   └─────┬──────┘   │
│      │          │           │            │              │           │
└──────┼──────────┼───────────┼────────────┼──────────────┼───────────┘
       │          │           │            │              │
       │          │           │            │              │
Priority 90: Subsystem-Level Equipment (Belongs to parent)
┌──────┼──────────┼───────────┼────────────┼──────────────┼───────────┐
│      │          │           │            │              │           │
│      ▼          ▼           ▼            ▼              ▼           │
│  ┌──────┐   ┌──────┐   ┌────────┐   ┌────────┐   ┌─────────┐      │
│  │ VAV  │   │ FCU  │   │ Pump   │   │ Pump   │   │  Pump   │      │
│  │ Box  │   │      │   │ (CWP)  │   │ (HWP)  │   │  (CWP)  │      │
│  └───┬──┘   └───┬──┘   └────┬───┘   └───┬────┘   └────┬────┘      │
│      │          │           │           │             │            │
└──────┼──────────┼───────────┼───────────┼─────────────┼────────────┘
       │          │           │           │             │
       │          │           │           │             │
Priority 70-80: Component-Level (Part of subsystem/system)
┌──────┼──────────┼───────────┼───────────┼─────────────┼────────────┐
│      │          │           │           │             │            │
│      ▼          ▼           ▼           ▼             ▼            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐          │
│  │ Supply │ │ Return │ │  VFD   │ │ Damper │ │  Valve  │          │
│  │  Fan   │ │  Fan   │ │        │ │        │ │         │          │
│  └────────┘ └────────┘ └────────┘ └────────┘ └─────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Example Hierarchies:
─────────────────────
1. AHU-01 → VAV-707 → Supply Fan
   (System → Subsystem → Component)

2. Chiller-02 → CWP-01 → VFD
   (System → Subsystem → Component)

3. AHU-03 → Return Fan
   (System → Component)

4. VAV-101 → Damper
   (Subsystem → Component)
```

---

## 5. Point Classification Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Point Classification Model                     │
└──────────────────────────────────────────────────────────────────────┘

Point Attributes:
┌────────────┬──────────────┬─────────────┬──────────────────────────┐
│ Point Type │ Purpose      │ Location    │ Example                  │
├────────────┼──────────────┼─────────────┼──────────────────────────┤
│            │ Supply       │ Supply      │ Supply Air Temperature   │
│Temperature │ Return       │ Return      │ Return Air Temperature   │
│            │ Mixed        │ Mixed       │ Mixed Air Temperature    │
│            │ Discharge    │ Discharge   │ Discharge Air Temp       │
│            │ Outdoor      │ Outdoor     │ Outdoor Air Temperature  │
│            │ Setpoint     │ N/A         │ Temperature Setpoint     │
├────────────┼──────────────┼─────────────┼──────────────────────────┤
│            │ Static       │ Supply      │ Supply Static Pressure   │
│ Pressure   │ Differential │ Filter      │ Filter Differential      │
│            │ Setpoint     │ N/A         │ Pressure Setpoint        │
├────────────┼──────────────┼─────────────┼──────────────────────────┤
│ Flow       │ Air          │ Supply      │ Supply Air Flow (CFM)    │
│            │ Water        │ Primary     │ Primary Water Flow (GPM) │
├────────────┼──────────────┼─────────────┼──────────────────────────┤
│ Status     │ Run          │ N/A         │ Run Status (On/Off)      │
│            │ Alarm        │ N/A         │ Alarm Status             │
│            │ Fault        │ N/A         │ Fault Status             │
├────────────┼──────────────┼─────────────┼──────────────────────────┤
│ Command    │ Enable       │ N/A         │ Enable Command           │
│            │ Start/Stop   │ N/A         │ Start/Stop Command       │
├────────────┼──────────────┼─────────────┼──────────────────────────┤
│ Position   │ Damper       │ Supply      │ Supply Damper Position   │
│            │ Valve        │ Hot Water   │ Hot Water Valve Position │
├────────────┼──────────────┼─────────────┼──────────────────────────┤
│ Speed      │ Fan          │ Supply      │ Supply Fan Speed (%)     │
│            │ Pump         │ N/A         │ Pump Speed (RPM)         │
└────────────┴──────────────┴─────────────┴──────────────────────────┘

Classification Priority:
────────────────────────
Priority 100: Exact match
  • "Supply-Air-Temp" → Supply Air Temperature

Priority 90: Partial match
  • "SA-Temp" → Supply Air Temperature (SA abbreviation)

Priority 80: Context match
  • "Temp" + "Supply" tokens → Supply Temperature

Priority 70: Abbreviation
  • "SAT" → Supply Air Temperature

Priority 60: Default/Generic
  • "Temp" → Temperature (no purpose/location)
```

---

## 6. UI Component Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Point Selector UI Component                     │
└──────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ Search: [_____Search points by name or equipment_____]  🔍  │   │
│ │                                                              │   │
│ │ Filters: [Equipment ▼] [Point Type ▼] [Location ▼]          │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ ▼ Air Handling Units (23 points)                            │   │
│ │   ┌────────────────────────────────────────────────────┐    │   │
│ │   │ ▼ AHU-01 (8 points)                                │    │   │
│ │   │   ┌──────────────────────────────────────────────┐ │    │   │
│ │   │   │ ☐ AHU-01 - Supply Air Temperature           │ │    │   │
│ │   │   │ ☐ AHU-01 - Return Air Temperature           │ │    │   │
│ │   │   │ ☐ AHU-01 - Mixed Air Temperature            │ │    │   │
│ │   │   │ ☐ AHU-01 - Supply Fan Status                │ │    │   │
│ │   │   │ ☐ AHU-01 - Supply Fan Speed (%)             │ │    │   │
│ │   │   │ ☐ AHU-01 - Damper Position (%)              │ │    │   │
│ │   │   │ ☐ AHU-01 - Static Pressure (inWC)           │ │    │   │
│ │   │   │ ☐ AHU-01 - Filter Differential Pressure     │ │    │   │
│ │   │   └──────────────────────────────────────────────┘ │    │   │
│ │   └────────────────────────────────────────────────────┘    │   │
│ │   ┌────────────────────────────────────────────────────┐    │   │
│ │   │ ▶ AHU-02 (7 points)                                │    │   │
│ │   └────────────────────────────────────────────────────┘    │   │
│ │   ┌────────────────────────────────────────────────────┐    │   │
│ │   │ ▶ AHU-03 (8 points)                                │    │   │
│ │   └────────────────────────────────────────────────────┘    │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ ▶ Variable Air Volume Boxes (47 points)                     │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ ▶ Chillers (12 points)                                       │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ [Selected: 3 points]                    [Cancel]  [Add Points]     │
└────────────────────────────────────────────────────────────────────┘

State Management:
─────────────────
• Grouped by category (from categorizer)
• Search filters by searchTerms
• Display uses displayName
• Hover shows originalName
• Multi-select with checkboxes
```

---

## 7. Performance Optimization Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Performance Optimization Stack                   │
└──────────────────────────────────────────────────────────────────────┘

Request: Parse 10,000 points
           │
           ▼
┌─────────────────────┐
│   Cache Layer       │ ◄──── Check cache first
│   ───────────────   │       • LRU eviction
│   10,000 max        │       • 95%+ hit rate after warmup
│   name → enhanced   │
└──────┬──────────────┘
       │
       │ Cache Miss (5%)
       ▼
┌─────────────────────┐
│  Batch Processing   │ ◄──── Process in chunks
│  ───────────────    │       • 1,000 points/chunk
│  Parallel parse     │       • Parallel tokenization
│  Chunk size: 1k     │
└──────┬──────────────┘
       │
       │ Parsed points
       ▼
┌─────────────────────┐
│  Pattern Matching   │ ◄──── Optimized regex
│  ───────────────    │       • Priority-based matching
│  Priority first     │       • Early exit on match
│  Compiled regex     │       • Compiled patterns
└──────┬──────────────┘
       │
       │ Enhanced points
       ▼
┌─────────────────────┐
│  Search Index       │ ◄──── Build inverted index
│  ───────────────    │       • term → point names
│  Inverted index     │       • O(1) term lookup
│  term → names       │       • <50ms search time
└──────┬──────────────┘
       │
       │ Indexed points
       ▼
┌─────────────────────┐
│  Category Groups    │ ◄──── Pre-build groupings
│  ───────────────    │       • category → points
│  Pre-grouped        │       • Instant UI rendering
│  category → points  │
└──────┬──────────────┘
       │
       │ Grouped results
       ▼
Return to caller

Performance Metrics:
────────────────────
• 10,000 points parsed in <500ms
• 95%+ cache hit rate after warmup
• <50ms search time
• <100ms grouping time
• Memory: ~1MB per 1,000 enhanced points

Optimization Techniques:
────────────────────────
1. LRU Cache: Avoid re-parsing same points
2. Compiled Regex: Pre-compile all patterns
3. Priority Matching: Exit early on high-priority match
4. Batch Processing: Process in chunks for parallelism
5. Inverted Index: Fast term-based search
6. Pre-grouping: Build category groups once
```

---

## 8. Pattern Matching Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Pattern Matching Process                       │
└──────────────────────────────────────────────────────────────────────┘

Token: "AHU"
   │
   ▼
┌───────────────────────┐
│ Equipment Patterns    │
│ (sorted by priority)  │
└───────────────────────┘
   │
   ├─► Priority 100: Standalone Systems
   │   ├─ Pattern: /\bAHU[-_]?(\d+)?\b/i
   │   │  Match: ✅ "AHU" matches!
   │   │  Extract ID: Check next token
   │   │  Result: { type: "AHU", priority: 100 }
   │   │
   │   └─► MATCH FOUND → Exit (no need to check lower priority)
   │
   └─► Priority 90: Subsystems (skipped due to early exit)

Token: "707"
   │
   ▼
┌───────────────────────┐
│ Equipment ID Pattern  │
└───────────────────────┘
   │
   └─► Pattern: /^\d+$/
       Match: ✅ "707" is numeric
       Result: { id: "707" }

Token: "VAV"
   │
   ▼
┌───────────────────────┐
│ Equipment Patterns    │
│ (sorted by priority)  │
└───────────────────────┘
   │
   ├─► Priority 100: Standalone Systems
   │   └─ No match
   │
   └─► Priority 90: Subsystems
       ├─ Pattern: /\bVAV[-_]?(\d+)?\b/i
       │  Match: ✅ "VAV" matches!
       │  Extract ID: Use "707" from previous token
       │  Context: Child of AHU (hierarchy)
       │  Result: { type: "VAV", id: "707", parent: "AHU" }
       │
       └─► MATCH FOUND → Exit

Token: "Disch"
   │
   ▼
┌───────────────────────┐
│ Point Purpose Patterns│
└───────────────────────┘
   │
   └─► Pattern: /\b(Discharge|Disch|DA)\b/i
       Match: ✅ "Disch" matches!
       Result: { purpose: "Discharge" }

Token: "Temp"
   │
   ▼
┌───────────────────────┐
│ Point Type Patterns   │
│ (sorted by priority)  │
└───────────────────────┘
   │
   └─► Priority 100: Temperature
       ├─ Pattern: /\bTemp(erature)?\b/i
       │  Match: ✅ "Temp" matches!
       │  Check purpose patterns:
       │    • Discharge pattern: Already found "Disch"
       │  Infer unit: °F (default for Temperature)
       │  Result: { type: "Temperature", purpose: "Discharge", unit: "°F" }
       │
       └─► MATCH FOUND → Exit

Final Result:
─────────────
Equipment: { type: "VAV", id: "707", hierarchy: ["AHU", "VAV-707"] }
Point: { type: "Temperature", purpose: "Discharge", unit: "°F" }
Display: "AHU VAV-707 - Discharge Temperature"
```

---

## 9. Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Deployment Architecture                        │
└──────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │ Point        │  │ Point        │  │ Chart Display        │     │
│  │ Selector     │  │ Search       │  │ (uses displayName)   │     │
│  │ Component    │  │ Component    │  │                      │     │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬────────────┘     │
│         │                 │                     │                  │
│         └─────────────────┴─────────────────────┘                  │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            │ Uses Point Cleaning Service
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Point Cleaning Service (Client)                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Runs in browser (no server required)                            │
│  • Lightweight (~50KB gzipped)                                     │
│  • No external API calls                                           │
│  • Fast parsing (client-side)                                      │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │ Tokenizer    │  │ Equipment    │  │ Point Extractor     │     │
│  │              │  │ Extractor    │  │                      │     │
│  └──────────────┘  └──────────────┘  └──────────────────────┘     │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │ Cache        │  │ Search Index │  │ Pattern Library      │     │
│  │              │  │              │  │ (embedded)           │     │
│  └──────────────┘  └──────────────┘  └──────────────────────┘     │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                            │
                            │ Parses points from
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│                      BACnet Service (Existing)                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Discovers BACnet devices and points                             │
│  • Returns raw point data                                          │
│  • No changes required                                             │
│                                                                     │
│  Returns: { name, objectId, objectType, ... }                      │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘

Deployment Benefits:
────────────────────
✅ Client-side only (no server infrastructure)
✅ Fast performance (no network latency)
✅ Works offline (after initial load)
✅ Scalable (runs on each client)
✅ Simple deployment (just import module)
```

---

## Questions?

For more details, see:
- `point-cleaning-architecture.md` - Complete architecture
- `ADR-001-point-cleaning-system.md` - Decision rationale
- `point-cleaning-implementation-guide.md` - Implementation details
- `ARCHITECTURE-SUMMARY.md` - Quick overview
