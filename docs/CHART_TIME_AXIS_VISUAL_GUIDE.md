# Chart Time Axis Visual Style Guide

**Version:** 1.0.0
**Last Updated:** 2025-10-16
**Status:** Standard Reference

---

## Table of Contents

1. [Visual Examples by Time Range](#visual-examples-by-time-range)
2. [Rotation Comparison](#rotation-comparison)
3. [Font Size Comparison](#font-size-comparison)
4. [Label Truncation Examples](#label-truncation-examples)
5. [Good vs Bad Examples](#good-vs-bad-examples)
6. [Before/After Comparison](#beforeafter-comparison)
7. [Responsive Behavior](#responsive-behavior)
8. [Color Variants](#color-variants)

---

## 1. Visual Examples by Time Range

### Full 12-Month View (Yearly)

```
Chart Area
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Data Points and Lines                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  │     │     │     │     │     │     │     │     │     │     │     │
  Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
  2024  2024  2024  2024  2024  2024  2024  2024  2024  2024  2024  2024

Font: 11px, Rotation: 45°, Color: #6c757d
```

**Format:** `MMM yyyy` (e.g., "Jan 2024")
**Spacing:** Even distribution across 12 months
**Max Length:** 8 characters

---

### Monthly View (30-31 Days)

```
Chart Area
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Data Points and Lines                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
  1   3   5   7   9  11  13  15  17  19  21  23  25  27  29  31
 Jan Jan Jan Jan Jan Jan Jan Jan Jan Jan Jan Jan Jan Jan Jan Jan

Font: 11px, Rotation: 45°, Color: #6c757d
```

**Format:** `d MMM` (e.g., "15 Jan")
**Spacing:** Every 2-3 days for readability
**Max Length:** 6 characters

---

### Weekly View (7 Days)

```
Chart Area
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Data Points and Lines                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  │       │       │       │       │       │       │
  Mon     Tue     Wed     Thu     Fri     Sat     Sun
  Jan 15  Jan 16  Jan 17  Jan 18  Jan 19  Jan 20  Jan 21

Font: 11px, Rotation: 45°, Color: #6c757d
```

**Format:** `EEE MMM d` (e.g., "Mon Jan 15")
**Spacing:** Each day shown
**Max Length:** 10 characters

---

### Daily View (24 Hours)

```
Chart Area
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Data Points and Lines                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  │    │    │    │    │    │    │    │    │    │    │    │
  12AM 2AM  4AM  6AM  8AM  10AM 12PM 2PM  4PM  6PM  8PM  10PM
  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan
  15   15   15   15   15   15   15   15   15   15   15   15

Font: 11px, Rotation: 45°, Color: #6c757d
```

**Format:** `ha MMM d` (e.g., "2PM Jan 15")
**Spacing:** Every 2 hours
**Max Length:** 11 characters

---

### Hourly View (60 Minutes)

```
Chart Area
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Data Points and Lines                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  │     │     │     │     │     │     │
  2:00  2:10  2:20  2:30  2:40  2:50  3:00
  PM    PM    PM    PM    PM    PM    PM

Font: 11px, Rotation: 45°, Color: #6c757d
```

**Format:** `h:mm a` (e.g., "2:30 PM")
**Spacing:** Every 10 minutes
**Max Length:** 8 characters

---

## 2. Rotation Comparison

### 0° Rotation (Horizontal) - ❌ BAD

```
┌─────────────────────────────────────────────┐
│                                             │
│        Chart Data Area                      │
│                                             │
└─────────────────────────────────────────────┘
Jan 2024 Feb 2024 Mar 2024 Apr 2024 May 2024 Jun 2024
         ↑ OVERLAPPING! Labels collide
```

**Issues:**
- Labels overlap and become unreadable
- Wastes horizontal space
- Poor for dense time data

---

### 30° Rotation - ⚠️ OK

```
┌─────────────────────────────────────────────┐
│                                             │
│        Chart Data Area                      │
│                                             │
└─────────────────────────────────────────────┘
  │      │      │      │      │      │
  Jan    Feb    Mar    Apr    May    Jun
  2024   2024   2024   2024   2024   2024
```

**Pros:** Less overlap than 0°
**Cons:** Still tight spacing, harder to read

---

### 45° Rotation - ✅ STANDARD

```
┌─────────────────────────────────────────────┐
│                                             │
│        Chart Data Area                      │
│                                             │
└─────────────────────────────────────────────┘
  │     │     │     │     │     │
  Jan   Feb   Mar   Apr   May   Jun
  2024  2024  2024  2024  2024  2024
```

**Pros:**
- Optimal readability
- Clean spacing
- Industry standard
- Works across all chart types

**RECOMMENDATION: USE 45° FOR ALL TIME AXES**

---

### 60° Rotation - ⚠️ NOT IDEAL

```
┌─────────────────────────────────────────────┐
│                                             │
│        Chart Data Area                      │
│                                             │
└─────────────────────────────────────────────┘
  │    │    │    │    │    │
  J    F    M    A    M    J
  a    e    a    p    a    u
  n    b    r    r    y    n

  2    2    2    2    2    2
  0    0    0    0    0    0
  2    2    2    2    2    2
  4    4    4    4    4    4
```

**Issues:**
- Too steep, harder to read
- Takes up more vertical space
- Less professional appearance

---

## 3. Font Size Comparison

### 9px Font - ❌ TOO SMALL

```
┌─────────────────────────────────────────────┐
│        Chart Data Area                      │
└─────────────────────────────────────────────┘
  │     │     │     │     │
  Jan   Feb   Mar   Apr   May
 2024  2024  2024  2024  2024
 ↑ Hard to read, accessibility issues
```

**Issues:** Fails WCAG accessibility standards, strains eyes

---

### 10px Font - ⚠️ SMALL

```
┌─────────────────────────────────────────────┐
│        Chart Data Area                      │
└─────────────────────────────────────────────┘
  │     │     │     │     │
  Jan   Feb   Mar   Apr   May
  2024  2024  2024  2024  2024
  ↑ Readable but small
```

**Use Case:** Very dense data with many labels

---

### 11px Font - ✅ STANDARD

```
┌─────────────────────────────────────────────┐
│        Chart Data Area                      │
└─────────────────────────────────────────────┘
  │     │     │     │     │
  Jan   Feb   Mar   Apr   May
  2024  2024  2024  2024  2024
  ↑ Optimal balance
```

**RECOMMENDATION: USE 11px FOR MOST CHARTS**

**Pros:**
- Meets accessibility standards
- Professional appearance
- Works for most data densities

---

### 12px Font - ✅ OPTIMAL (Less Dense)

```
┌─────────────────────────────────────────────┐
│        Chart Data Area                      │
└─────────────────────────────────────────────┘
  │      │      │      │      │
  Jan    Feb    Mar    Apr    May
  2024   2024   2024   2024   2024
  ↑ Very readable
```

**Use Case:** Weekly/daily views with fewer labels

---

### 14px Font - ❌ TOO LARGE

```
┌─────────────────────────────────────────────┐
│        Chart Data Area                      │
└─────────────────────────────────────────────┘
  │       │       │       │
  Jan     Feb     Mar     Apr
  2024    2024    2024    2024
  ↑ Takes too much space, may overlap
```

**Issues:** Wastes space, may cause overlapping on dense data

---

## 4. Label Truncation Examples

### Why Truncation is Needed

**Problem: Full Labels on Dense Charts**

```
┌───────────────────────────────────────────────────────┐
│              Chart Data Area                          │
└───────────────────────────────────────────────────────┘
  │                    │                    │
  January 15, 2024,    February 15, 2024,   March 15, 2024,
  2:30 PM              2:30 PM              2:30 PM
  ↑ OVERLAPPING! Unreadable!
```

---

### Solution: Smart Truncation

**Before Truncation (32 chars):**
```
Full Label: "January 15, 2024, 2:30 PM EDT"
```

**After Truncation (15 chars):**
```
Truncated: "January 15, 20..."
```

**Visual Result:**

```
┌───────────────────────────────────────────────────────┐
│              Chart Data Area                          │
└───────────────────────────────────────────────────────┘
  │          │          │          │
  Jan 15,    Feb 15,    Mar 15,    Apr 15,
  2024...    2024...    2024...    2024...
  ↑ Readable and clean!
```

---

### Truncation Rules

| Label Length | Action | Example |
|--------------|--------|---------|
| ≤ 15 chars | Show full | "Jan 15, 2024" |
| > 15 chars | Truncate + "..." | "January 15, 20..." |
| > 25 chars | Aggressive truncate | "Jan 15..." |

**Tooltip Always Shows Full Label on Hover**

---

## 5. Good vs Bad Examples

### ✅ GOOD: Properly Formatted Time Axis

```
Temperature Over Time
┌─────────────────────────────────────────────────────────────┐
│ 75°F ─                                    ●                 │
│         ●───●                       ●───●                   │
│ 70°F ─    ●   ●               ●───●                         │
│                 ●───●   ●───●                               │
│ 65°F ─                ●                                     │
└─────────────────────────────────────────────────────────────┘
  │     │     │     │     │     │     │     │     │     │
  Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct
  2024  2024  2024  2024  2024  2024  2024  2024  2024  2024

Font: 11px | Rotation: 45° | Color: #6c757d | Max: 15 chars
```

**Why It's Good:**
- Consistent spacing
- Readable 45° rotation
- Proper font size (11px)
- Consistent date format
- Professional color (#6c757d)
- No overlapping

---

### ❌ BAD: Poorly Formatted Time Axis

```
Temperature Over Time
┌─────────────────────────────────────────────────────────────┐
│ 75°F ─                                    ●                 │
│         ●───●                       ●───●                   │
│ 70°F ─    ●   ●               ●───●                         │
│                 ●───●   ●───●                               │
│ 65°F ─                ●                                     │
└─────────────────────────────────────────────────────────────┘
January 2024 2/24 Mar Apr-2024 05/2024 Jun 7/24 August Sept Oct
  ↑          ↑    ↑      ↑        ↑     ↑    ↑      ↑     ↑
  Different formats, overlapping, inconsistent spacing
```

**Problems:**
- Inconsistent date formats (January, 2/24, Apr-2024, 05/2024)
- Overlapping labels
- No rotation (0°)
- Mixed font sizes
- Unprofessional appearance

---

### ✅ GOOD: Dense Data with Smart Truncation

```
Hourly Temperature Readings
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     ●─●─●─●─●─●─●─●─●─●─●─●─●─●─●─●─●─●                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
  │    │    │    │    │    │    │    │    │    │    │    │
  12AM 2AM  4AM  6AM  8AM  10AM 12PM 2PM  4PM  6PM  8PM  10PM
  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan  Jan
  15   15   15   15   15   15   15   15   15   15   15   15

Font: 11px | Rotation: 45° | Color: #6c757d
```

---

### ❌ BAD: Dense Data Without Truncation

```
Hourly Temperature Readings
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     ●─●─●─●─●─●─●─●─●─●─●─●─●─●─●─●─●─●                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
January 15, 2024, 12:00 AM EST January 15, 2024, 2:00 AM EST
  ↑ OVERLAPPING! UNREADABLE!
```

---

## 6. Before/After Comparison

### Before Standardization

```
Chart 1: Monthly Sales
┌───────────────────────────────────────┐
│         Data                          │
└───────────────────────────────────────┘
1/1/24  2024-02-01  Mar  4-2024  05/24
  ↑ Mixed formats, horizontal, overlapping

Chart 2: Weekly Traffic
┌───────────────────────────────────────┐
│         Data                          │
└───────────────────────────────────────┘
  │        │        │        │
  Monday   Tue      Wednesday Thu
  1/15     1/16/24  17-Jan   1/18
  ↑ Inconsistent rotation, mixed formats

Chart 3: Daily Temperature
┌───────────────────────────────────────┐
│         Data                          │
└───────────────────────────────────────┘
12:00 AM  2 AM  4:00AM  6 a.m.  8AM  10:00
  ↑ Inconsistent format, poor spacing
```

---

### After Standardization

```
Chart 1: Monthly Sales
┌───────────────────────────────────────┐
│         Data                          │
└───────────────────────────────────────┘
  │     │     │     │     │
  Jan   Feb   Mar   Apr   May
  2024  2024  2024  2024  2024
  ✅ Consistent format, 45° rotation

Chart 2: Weekly Traffic
┌───────────────────────────────────────┐
│         Data                          │
└───────────────────────────────────────┘
  │       │       │       │
  Mon     Tue     Wed     Thu
  Jan 15  Jan 16  Jan 17  Jan 18
  ✅ Consistent format, 45° rotation

Chart 3: Daily Temperature
┌───────────────────────────────────────┐
│         Data                          │
└───────────────────────────────────────┘
  │    │    │    │    │    │
  12AM 2AM  4AM  6AM  8AM  10AM
  Jan  Jan  Jan  Jan  Jan  Jan
  15   15   15   15   15   15
  ✅ Consistent format, 45° rotation
```

---

## 7. Responsive Behavior

### Desktop View (Wide - 1200px+)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                      Full Chart Data Area                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  │     │     │     │     │     │     │     │     │     │     │     │
  Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
  2024  2024  2024  2024  2024  2024  2024  2024  2024  2024  2024  2024

Font: 11px | All labels shown | Rotation: 45° | Full spacing
```

**Features:**
- Show all time points
- 11px font
- Comfortable spacing
- Full date format

---

### Tablet View (Medium - 768px-1199px)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│           Chart Data Area                       │
│                                                 │
└─────────────────────────────────────────────────┘
  │       │       │       │       │       │
  Jan     Mar     May     Jul     Sep     Nov
  2024    2024    2024    2024    2024    2024

Font: 11px | Every 2nd label | Rotation: 45° | Wider spacing
```

**Adaptations:**
- Show every 2nd time point
- Maintain 11px font
- Increase spacing between labels
- Same rotation (45°)

---

### Mobile View (Narrow - <768px)

```
┌─────────────────────────────┐
│                             │
│      Chart Data             │
│                             │
└─────────────────────────────┘
  │         │         │
  Jan       May       Sep
  2024      2024      2024

Font: 10px | Every 4th label | Rotation: 45° | Maximum spacing
```

**Adaptations:**
- Show every 4th time point
- Reduce to 10px font (still readable)
- Maximum spacing
- Same rotation (45°)
- Consider horizontal scroll for dense data

---

### Responsive Breakpoints

| Screen Width | Font Size | Label Frequency | Rotation |
|--------------|-----------|-----------------|----------|
| 1200px+ | 11px | All labels | 45° |
| 768-1199px | 11px | Every 2nd | 45° |
| 480-767px | 10px | Every 3rd | 45° |
| <480px | 10px | Every 4th | 45° |

---

## 8. Color Variants

### Light Theme (Default)

```
┌─────────────────────────────────────────────┐
│ Background: #ffffff                         │
│ Grid lines: #dee2e6 (light gray)            │
│ Data line: #0d6efd (blue)                   │
└─────────────────────────────────────────────┘
  │     │     │     │     │     │
  Jan   Feb   Mar   Apr   May   Jun
  2024  2024  2024  2024  2024  2024

  Color: #6c757d (medium gray)
  Background: #ffffff (white)
  Contrast Ratio: 4.6:1 ✅ WCAG AA Compliant
```

**Specifications:**
- **Label Color:** `#6c757d` (Bootstrap gray-600)
- **Background:** `#ffffff` (white)
- **Grid Lines:** `#dee2e6` (Bootstrap gray-300)
- **Font Weight:** 400 (normal)
- **Contrast Ratio:** 4.6:1 (WCAG AA ✅)

---

### Dark Theme

```
┌─────────────────────────────────────────────┐
│ Background: #1a1a1a                         │
│ Grid lines: #404040 (dark gray)             │
│ Data line: #4dabf7 (light blue)             │
└─────────────────────────────────────────────┘
  │     │     │     │     │     │
  Jan   Feb   Mar   Apr   May   Jun
  2024  2024  2024  2024  2024  2024

  Color: #adb5bd (light gray)
  Background: #1a1a1a (dark)
  Contrast Ratio: 5.2:1 ✅ WCAG AA Compliant
```

**Specifications:**
- **Label Color:** `#adb5bd` (Bootstrap gray-500)
- **Background:** `#1a1a1a` (dark gray)
- **Grid Lines:** `#404040` (medium dark gray)
- **Font Weight:** 400 (normal)
- **Contrast Ratio:** 5.2:1 (WCAG AA ✅)

---

### High Contrast Theme (Accessibility)

```
┌─────────────────────────────────────────────┐
│ Background: #000000                         │
│ Grid lines: #ffffff (white)                 │
│ Data line: #ffff00 (yellow)                 │
└─────────────────────────────────────────────┘
  │     │     │     │     │     │
  Jan   Feb   Mar   Apr   May   Jun
  2024  2024  2024  2024  2024  2024

  Color: #ffffff (white)
  Background: #000000 (black)
  Contrast Ratio: 21:1 ✅ WCAG AAA Compliant
```

**Specifications:**
- **Label Color:** `#ffffff` (white)
- **Background:** `#000000` (black)
- **Grid Lines:** `#ffffff` (white)
- **Font Weight:** 600 (semi-bold for clarity)
- **Contrast Ratio:** 21:1 (WCAG AAA ✅)

---

### Color-Blind Friendly Palette

```
┌─────────────────────────────────────────────┐
│ Uses distinct shapes and patterns           │
│ Data line: #0077bb (blue, safe)             │
└─────────────────────────────────────────────┘
  │     │     │     │     │     │
  Jan   Feb   Mar   Apr   May   Jun
  2024  2024  2024  2024  2024  2024

  Color: #555555 (neutral gray)
  Optimized for:
  - Deuteranopia (red-green color blindness)
  - Protanopia (red-green color blindness)
  - Tritanopia (blue-yellow color blindness)
```

**Specifications:**
- **Label Color:** `#555555` (neutral medium gray)
- **Safe Colors:** Blues (#0077bb), Oranges (#ee7733)
- **Avoid:** Red/green combinations
- **Alternative:** Use patterns/shapes instead of color alone

---

### Accessibility Guidelines

| Theme | Label Color | Background | Contrast | WCAG Level |
|-------|-------------|------------|----------|------------|
| Light | #6c757d | #ffffff | 4.6:1 | AA ✅ |
| Dark | #adb5bd | #1a1a1a | 5.2:1 | AA ✅ |
| High Contrast | #ffffff | #000000 | 21:1 | AAA ✅ |
| Color-Blind | #555555 | #ffffff | 7.4:1 | AAA ✅ |

**Minimum Requirements:**
- **Normal Text:** 4.5:1 contrast ratio (WCAG AA)
- **Large Text (14px+):** 3:1 contrast ratio (WCAG AA)
- **Enhanced:** 7:1 contrast ratio (WCAG AAA)

---

## Quick Reference Card

```
╔═══════════════════════════════════════════════════════════╗
║         TIME AXIS STANDARDIZATION QUICK REF               ║
╠═══════════════════════════════════════════════════════════╣
║ Font Size:      11px (standard), 10px (mobile)            ║
║ Rotation:       45° (always)                              ║
║ Color (Light):  #6c757d                                   ║
║ Color (Dark):   #adb5bd                                   ║
║ Max Length:     15 characters (truncate with "...")       ║
║ Font Weight:    400 (normal)                              ║
║ Font Family:    -apple-system, system-ui, sans-serif     ║
╠═══════════════════════════════════════════════════════════╣
║ FORMATS BY TIME RANGE:                                    ║
║   Yearly:  MMM yyyy        → "Jan 2024"                   ║
║   Monthly: d MMM           → "15 Jan"                     ║
║   Weekly:  EEE MMM d       → "Mon Jan 15"                 ║
║   Daily:   ha MMM d        → "2PM Jan 15"                 ║
║   Hourly:  h:mm a          → "2:30 PM"                    ║
╠═══════════════════════════════════════════════════════════╣
║ RESPONSIVE:                                               ║
║   Desktop (1200px+):  All labels, 11px                    ║
║   Tablet (768-1199):  Every 2nd, 11px                     ║
║   Mobile (<768px):    Every 4th, 10px                     ║
╠═══════════════════════════════════════════════════════════╣
║ ACCESSIBILITY:                                            ║
║   Contrast Ratio: ≥ 4.5:1 (WCAG AA)                       ║
║   Touch Target:   ≥ 44x44px for interactive               ║
║   Fallback:       Always provide tooltips                 ║
╚═══════════════════════════════════════════════════════════╝
```

---

## Implementation Checklist

```
┌─────────────────────────────────────────────────────┐
│ ✅ BEFORE COMMITTING ANY CHART, VERIFY:             │
├─────────────────────────────────────────────────────┤
│ □ Font size is 11px (or 10px for mobile)            │
│ □ Rotation is exactly 45°                           │
│ □ Color matches theme (#6c757d or #adb5bd)          │
│ □ Date format matches time range specification      │
│ □ Labels truncated to ≤15 characters                │
│ □ Tooltips show full date/time on hover             │
│ □ No overlapping labels                             │
│ □ Contrast ratio ≥ 4.5:1                            │
│ □ Responsive behavior implemented                   │
│ □ Consistent with other charts in dashboard         │
└─────────────────────────────────────────────────────┘
```

---

## Related Documentation

- **Implementation Guide:** `C:\Users\jstahr\Desktop\Building Vitals\docs\TIME_AXIS_STANDARDIZATION.md`
- **Code Examples:** `C:\Users\jstahr\Desktop\Building Vitals\src\utils\chartHelpers.js`
- **Design System:** Bootstrap 5.3+ (official documentation)
- **Accessibility:** WCAG 2.1 Level AA Guidelines

---

**END OF VISUAL STYLE GUIDE**

*For questions or updates, refer to the implementation guide or contact the development team.*
