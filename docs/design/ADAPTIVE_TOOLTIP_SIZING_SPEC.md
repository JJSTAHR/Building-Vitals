# Adaptive Tooltip Sizing Specification

**Version**: 1.0.0
**Last Updated**: 2025-10-16
**Status**: Design Specification

## Executive Summary

This specification defines a content-driven, responsive tooltip sizing system that intelligently adapts to content length, device constraints, and viewport size without blocking important chart data. The system prioritizes readability while maintaining spatial efficiency.

---

## 1. Design Philosophy

### Core Principles

1. **Content-First**: Tooltips expand to fit content naturally, not forced into arbitrary widths
2. **Viewport-Aware**: Never exceed available screen space (90% viewport maximum)
3. **Readability-First**: Prioritize comfortable reading over space efficiency
4. **Non-Blocking**: Tooltips should not obscure critical chart data
5. **Progressive Enhancement**: Graceful degradation across device capabilities

### Design Goals

- Eliminate horizontal scrolling within tooltips
- Prevent tooltips from extending beyond viewport edges
- Ensure long API names and descriptions remain readable
- Maintain consistent padding and spacing across breakpoints
- Optimize for both touch and mouse interactions

---

## 2. Width Strategy

### Recommended Approach: Hybrid Content-Driven + Viewport-Aware

**Rationale**: Fixed breakpoints don't account for content variability. Viewport-relative sizing ensures tooltips never break layout but can lead to cramped content on small screens. A hybrid approach provides the best balance.

### Implementation Formula

```css
/* Base formula for all tooltips */
.tooltip-container {
  width: auto;
  min-width: clamp(200px, 30vw, 280px);
  max-width: clamp(300px, 90vw, 550px);
}
```

### Breakpoint-Specific Constraints

```css
/* Mobile (<600px) */
@media (max-width: 599px) {
  .tooltip-container {
    min-width: 200px;
    max-width: min(90vw, 350px);
    /* 90vw ensures narrow devices don't get cramped */
  }
}

/* Tablet (600-960px) */
@media (min-width: 600px) and (max-width: 959px) {
  .tooltip-container {
    min-width: 240px;
    max-width: min(80vw, 450px);
    /* Allow slightly more width on tablets */
  }
}

/* Desktop (>960px) */
@media (min-width: 960px) {
  .tooltip-container {
    min-width: 280px;
    max-width: min(70vw, 550px);
    /* Desktop can handle wider tooltips */
  }
}

/* Ultra-wide (>1920px) */
@media (min-width: 1920px) {
  .tooltip-container {
    max-width: 600px;
    /* Don't let tooltips get absurdly wide on large monitors */
  }
}
```

### Chart-Type-Specific Overrides

Different chart types have different content density needs:

```typescript
// Recommended max-width by chart type
const TOOLTIP_MAX_WIDTHS = {
  // Simple charts: shorter tooltips
  line: 450,
  bar: 450,
  pie: 400,
  scatter: 400,

  // Complex charts: wider tooltips for more data
  heatmap: 550,
  deviation: 550,
  spc: 500,
  economizer: 500,

  // 3D charts: medium width
  surface: 480,
  '3d-bar': 480,
} as const;
```

### Visual Comparison

```
┌─────────────────────────────────────────────┐
│  BEFORE (Fixed 500px)                       │
├─────────────────────────────────────────────┤
│  On mobile: Extends beyond viewport →→→→→   │
│  On desktop: Wastes space with short text  │
└─────────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  AFTER (Adaptive)                        │
├──────────────────────────────────────────┤
│  Mobile (350px):  ┌──────────────┐       │
│                   │  Fits screen │       │
│                   └──────────────┘       │
│                                          │
│  Desktop (550px): ┌─────────────────────┐│
│                   │  Expands for content││
│                   └─────────────────────┘│
└──────────────────────────────────────────┘
```

---

## 3. Text Wrapping & Overflow Strategy

### Wrapping Rules

**Goal**: Allow natural text flow without horizontal scrolling or truncation.

```css
.tooltip-content {
  /* Allow wrapping for all text */
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;

  /* Prevent breaking of intentional nowrap elements */
  & [data-nowrap] {
    white-space: nowrap;
  }
}
```

### Element-Specific Handling

```css
/* API Point Names: Break at logical points */
.tooltip-api-name {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  word-break: break-word; /* Break long paths */
  line-height: 1.6; /* Improve multi-line readability */
  hyphens: none; /* Don't hyphenate code */
}

/* Display Names: Wrap naturally */
.tooltip-display-name {
  word-wrap: break-word;
  line-height: 1.5;
}

/* Value + Unit Pairs: Keep together */
.tooltip-value-unit {
  white-space: nowrap; /* "75.2 °F" stays together */
}

/* Long Descriptions: Comfortable wrapping */
.tooltip-description {
  line-height: 1.6;
  max-height: 8em; /* ~5 lines */
  overflow-y: auto;
}

/* Lists: Proper spacing */
.tooltip-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

### Truncation Strategy (Edge Cases Only)

**Use truncation ONLY when**:
1. Tooltip would exceed max-height (60vh)
2. Content is auxiliary (not primary info)
3. Full content available via expand/copy action

```css
/* Example: Long metadata that's not critical */
.tooltip-metadata {
  max-height: 6em;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
}

.tooltip-metadata::after {
  content: '... (click to expand)';
  position: absolute;
  bottom: 0;
  right: 0;
  background: linear-gradient(to right, transparent, var(--bg-color) 30%);
  padding-left: 40px;
  cursor: pointer;
}
```

---

## 4. Padding & Spacing System

### Responsive Padding Scale

```typescript
// Padding values by breakpoint
const TOOLTIP_PADDING = {
  mobile: {
    container: '10px 12px',
    section: '8px 0',
    inline: '4px',
  },
  tablet: {
    container: '12px 14px',
    section: '10px 0',
    inline: '6px',
  },
  desktop: {
    container: '12px 16px',
    section: '12px 0',
    inline: '8px',
  },
} as const;
```

### Implementation

```css
/* Base padding (mobile-first) */
.tooltip-container {
  padding: 10px 12px;
}

/* Tablet */
@media (min-width: 600px) {
  .tooltip-container {
    padding: 12px 14px;
  }
}

/* Desktop */
@media (min-width: 960px) {
  .tooltip-container {
    padding: 12px 16px;
  }
}
```

### Spacing Hierarchy

```css
/* Vertical spacing between sections */
.tooltip-section {
  margin-bottom: 12px; /* Desktop default */
}

.tooltip-section:last-child {
  margin-bottom: 0;
}

/* Tighter spacing on mobile */
@media (max-width: 599px) {
  .tooltip-section {
    margin-bottom: 8px;
  }
}

/* Between related elements */
.tooltip-label {
  margin-bottom: 4px;
}

.tooltip-value {
  margin-bottom: 8px;
}
```

### Line Height for Readability

```css
/* Line heights optimized for reading comfort */
.tooltip-content {
  /* Body text */
  line-height: 1.6;
}

.tooltip-api-name {
  /* Monospace needs more breathing room */
  line-height: 1.7;
}

.tooltip-heading {
  /* Headings can be tighter */
  line-height: 1.4;
}
```

### Visual Spacing Guide

```
┌─────────────────────────────────────┐
│ ← 12px padding                      │
│                                     │
│  [Section 1]                        │
│  Line height: 1.6                   │
│  Multiple lines have comfortable    │
│  breathing room                     │
│     ↕ 12px gap                      │
│  [Section 2]                        │
│  Another section with proper        │
│  separation                         │
│     ↕ 12px gap                      │
│  [Section 3]                        │
│                                     │
│                       12px padding →│
└─────────────────────────────────────┘
```

---

## 5. Height Management

### Maximum Height Strategy

**Rationale**: Different chart types and interaction contexts require different height limits.

```typescript
// Maximum heights by context
const TOOLTIP_MAX_HEIGHT = {
  // Standard tooltips (hover)
  default: '60vh',

  // Rich content tooltips (heatmap, deviation)
  rich: '70vh',

  // Mobile (preserve more screen space)
  mobile: '50vh',

  // Click/pin tooltips (can be taller)
  pinned: '80vh',
} as const;
```

### Scrolling Behavior

```css
.tooltip-container {
  max-height: 60vh;
  overflow-y: auto;
  overflow-x: hidden;

  /* Smooth scrolling */
  scroll-behavior: smooth;

  /* Custom scrollbar styling */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

/* Webkit scrollbar styling */
.tooltip-container::-webkit-scrollbar {
  width: 6px;
}

.tooltip-container::-webkit-scrollbar-track {
  background: transparent;
}

.tooltip-container::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.tooltip-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.5);
}
```

### Scroll Indicators

```css
/* Fade indicator when content scrollable */
.tooltip-container[data-scrollable="true"]::after {
  content: '';
  position: sticky;
  bottom: 0;
  display: block;
  height: 20px;
  background: linear-gradient(to bottom, transparent, var(--bg-color));
  pointer-events: none;
}
```

### Height Threshold Decision Tree

```
Is content > 60vh?
  ├─ NO → Use natural height
  └─ YES → Is it critical data?
      ├─ YES → Allow scrolling up to max-height
      └─ NO → Consider truncation with expand button
```

---

## 6. Responsive Breakpoint System

### Breakpoint Definitions

```typescript
// Breakpoint values aligned with Material-UI
export const TOOLTIP_BREAKPOINTS = {
  xs: 0,     // Mobile portrait
  sm: 600,   // Mobile landscape / small tablet
  md: 960,   // Tablet
  lg: 1280,  // Desktop
  xl: 1920,  // Large desktop
} as const;

// Breakpoint-specific configs
export const TOOLTIP_CONFIGS = {
  xs: {
    maxWidth: '90vw',
    minWidth: '200px',
    padding: '10px 12px',
    maxHeight: '50vh',
    fontSize: '13px',
  },
  sm: {
    maxWidth: 'min(85vw, 400px)',
    minWidth: '240px',
    padding: '11px 13px',
    maxHeight: '55vh',
    fontSize: '13px',
  },
  md: {
    maxWidth: 'min(80vw, 500px)',
    minWidth: '280px',
    padding: '12px 14px',
    maxHeight: '60vh',
    fontSize: '13px',
  },
  lg: {
    maxWidth: 'min(70vw, 550px)',
    minWidth: '300px',
    padding: '12px 16px',
    maxHeight: '60vh',
    fontSize: '13px',
  },
  xl: {
    maxWidth: '600px',
    minWidth: '320px',
    padding: '14px 18px',
    maxHeight: '65vh',
    fontSize: '14px',
  },
} as const;
```

### CSS Media Query Implementation

```css
/* Mobile Portrait (xs: 0-599px) */
.tooltip-container {
  max-width: 90vw;
  min-width: 200px;
  padding: 10px 12px;
  max-height: 50vh;
  font-size: 13px;
}

/* Mobile Landscape / Small Tablet (sm: 600-959px) */
@media (min-width: 600px) {
  .tooltip-container {
    max-width: min(85vw, 400px);
    min-width: 240px;
    padding: 11px 13px;
    max-height: 55vh;
  }
}

/* Tablet (md: 960-1279px) */
@media (min-width: 960px) {
  .tooltip-container {
    max-width: min(80vw, 500px);
    min-width: 280px;
    padding: 12px 14px;
    max-height: 60vh;
  }
}

/* Desktop (lg: 1280-1919px) */
@media (min-width: 1280px) {
  .tooltip-container {
    max-width: min(70vw, 550px);
    min-width: 300px;
    padding: 12px 16px;
  }
}

/* Large Desktop (xl: 1920px+) */
@media (min-width: 1920px) {
  .tooltip-container {
    max-width: 600px;
    min-width: 320px;
    padding: 14px 18px;
    max-height: 65vh;
    font-size: 14px;
  }
}
```

### Touch vs Mouse Optimizations

```css
/* Touch devices: larger tap targets, more spacing */
@media (hover: none) and (pointer: coarse) {
  .tooltip-container {
    padding: 12px 16px;
    font-size: 14px; /* Larger for easier reading on mobile */
  }

  .tooltip-button {
    min-height: 44px; /* iOS/Android touch target */
    min-width: 44px;
  }

  .tooltip-section {
    margin-bottom: 12px; /* More space for touch scrolling */
  }
}

/* Mouse devices: precise interactions, tighter spacing */
@media (hover: hover) and (pointer: fine) {
  .tooltip-button {
    min-height: 32px;
    min-width: 32px;
  }
}
```

---

## 7. Implementation Code Examples

### React Component (MUI Tooltip)

```typescript
import { Tooltip, Box, useTheme, useMediaQuery } from '@mui/material';
import { useMemo } from 'react';

interface AdaptiveTooltipProps {
  point: Point;
  children: React.ReactElement;
  chartType?: 'line' | 'bar' | 'heatmap' | 'deviation';
}

export const AdaptiveTooltip: React.FC<AdaptiveTooltipProps> = ({
  point,
  children,
  chartType = 'line',
}) => {
  const theme = useTheme();

  // Detect breakpoint
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Calculate max width based on chart type and viewport
  const maxWidth = useMemo(() => {
    const baseWidths = {
      line: 450,
      bar: 450,
      heatmap: 550,
      deviation: 550,
    };

    const baseWidth = baseWidths[chartType] || 450;

    if (isMobile) {
      return Math.min(baseWidth * 0.7, window.innerWidth * 0.9);
    }
    if (isTablet) {
      return Math.min(baseWidth * 0.85, window.innerWidth * 0.8);
    }
    return Math.min(baseWidth, window.innerWidth * 0.7);
  }, [chartType, isMobile, isTablet, isDesktop]);

  return (
    <Tooltip
      title={
        <Box
          sx={{
            padding: {
              xs: '10px 12px',
              sm: '11px 13px',
              md: '12px 14px',
              lg: '12px 16px',
            },
            maxHeight: {
              xs: '50vh',
              sm: '55vh',
              md: '60vh',
            },
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '3px',
            },
          }}
        >
          {/* API Name Section */}
          <Box sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}
            >
              API Point Name:
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                bgcolor: 'action.hover',
                p: 1,
                borderRadius: 1,
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"Monaco", "Courier New", monospace',
                  fontSize: { xs: '0.8rem', md: '0.875rem' },
                  fontWeight: 600,
                  wordBreak: 'break-word',
                  lineHeight: 1.7,
                  flex: 1,
                }}
              >
                {point.name}
              </Typography>
              {/* Copy button */}
            </Box>
          </Box>

          {/* Other sections... */}
        </Box>
      }
      componentsProps={{
        tooltip: {
          sx: {
            maxWidth: maxWidth,
            minWidth: {
              xs: 200,
              sm: 240,
              md: 280,
              lg: 300,
            },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            boxShadow: 3,
          },
        },
      }}
    >
      {children}
    </Tooltip>
  );
};
```

### ECharts Tooltip Configuration

```typescript
import { TooltipComponentOption } from 'echarts';

export function createAdaptiveTooltip(
  chartType: 'line' | 'bar' | 'heatmap' | 'deviation'
): TooltipComponentOption {
  // Detect viewport size
  const isMobile = window.innerWidth < 600;
  const isTablet = window.innerWidth >= 600 && window.innerWidth < 960;

  // Calculate max width
  const baseWidths = {
    line: 450,
    bar: 450,
    heatmap: 550,
    deviation: 550,
  };

  let maxWidth = baseWidths[chartType];

  if (isMobile) {
    maxWidth = Math.min(350, window.innerWidth * 0.9);
  } else if (isTablet) {
    maxWidth = Math.min(450, window.innerWidth * 0.8);
  } else {
    maxWidth = Math.min(maxWidth, window.innerWidth * 0.7);
  }

  return {
    trigger: 'axis',
    backgroundColor: 'rgba(50, 50, 50, 0.95)',
    borderColor: '#444',
    borderWidth: 1,
    padding: isMobile ? [10, 12] : [12, 16],
    textStyle: {
      color: '#fff',
      fontSize: isMobile ? 12 : 13,
    },
    extraCssText: `
      max-width: ${maxWidth}px;
      min-width: ${isMobile ? 200 : 280}px;
      max-height: ${isMobile ? '50vh' : '60vh'};
      overflow-y: auto;
      overflow-x: hidden;
      word-wrap: break-word;
      line-height: 1.6;
      scrollbar-width: thin;
    `,
    formatter: (params: any) => {
      // Custom formatter with proper wrapping
      let html = '<div style="word-wrap: break-word;">';

      // Header with date
      html += `<div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">
        ${formatDate(params[0].axisValue)}
      </div>`;

      // Series data
      params.forEach((param: any) => {
        html += `
          <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px;">
            <span style="flex: 1; word-wrap: break-word;">
              <span style="display: inline-block; width: 12px; height: 12px;
                     background-color: ${param.color}; border-radius: 2px;
                     margin-right: 8px; vertical-align: middle;"></span>
              ${param.seriesName}
            </span>
            <span style="font-weight: 600; white-space: nowrap;">
              ${formatValue(param.value)} ${param.unit || ''}
            </span>
          </div>
        `;
      });

      html += '</div>';
      return html;
    },
  };
}
```

---

## 8. Edge Cases & Solutions

### Very Long API Names

**Problem**: API names like `ses_falls_city.Main_System.AHU_101.Supply_Air_Temperature.Sensor` can be 80+ characters.

**Solution**:
```css
.tooltip-api-name {
  word-break: break-word; /* Break at any point if needed */
  hyphens: none; /* Don't add hyphens to code */
  line-height: 1.7; /* Extra space for readability */
  max-width: 100%; /* Prevent overflow */
}
```

### Multi-Series Tooltips with 10+ Series

**Problem**: Tooltips with many series can become very tall.

**Solutions**:
1. **Scrolling** (preferred for <15 series):
   ```css
   .tooltip-series-list {
     max-height: 40vh;
     overflow-y: auto;
   }
   ```

2. **Compact Mode** (for 15+ series):
   ```typescript
   // Use smaller font, tighter spacing
   fontSize: series.length > 15 ? '11px' : '13px',
   gap: series.length > 15 ? '2px' : '4px',
   ```

3. **Grouping** (for related series):
   ```typescript
   // Group by equipment or location
   const grouped = groupBy(series, s => s.equipment);
   ```

### Mobile Landscape Orientation

**Problem**: Landscape mode on mobile has limited vertical space.

**Solution**:
```css
@media (max-width: 960px) and (orientation: landscape) {
  .tooltip-container {
    max-height: 40vh; /* Reduce height in landscape */
    max-width: min(400px, 60vw); /* Allow wider tooltip */
  }
}
```

### Very Short Content

**Problem**: Single-line tooltips look awkward with large padding.

**Solution**: Use dynamic padding based on content.

```typescript
const contentLines = content.split('\n').length;
const padding = contentLines === 1
  ? '8px 12px'  // Compact padding for single line
  : '12px 16px'; // Normal padding for multi-line
```

### Tooltips Near Viewport Edges

**Problem**: Tooltips get cut off near screen edges.

**Solution**: Already handled by MUI Popper modifiers, but ensure proper config:

```typescript
slotProps={{
  popper: {
    modifiers: [
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          boundary: 'viewport',
          padding: 8, // Keep 8px from edge
        },
      },
      {
        name: 'flip',
        enabled: true,
        options: {
          fallbackPlacements: ['top', 'bottom', 'left', 'right'],
          boundary: 'viewport',
        },
      },
    ],
  },
}}
```

---

## 9. Before/After Comparison

### Scenario 1: Long API Name on Mobile

```
BEFORE (Fixed 500px):
┌───────────────────────────────────────────────────┐
│ API Name:                                         │
│ ses_falls_city.Main_System.AHU_101.Supply_Air_→→→→│
│                                    (scrolls off)  │
└───────────────────────────────────────────────────┘
     ↑ Extends beyond 360px mobile screen

AFTER (Adaptive 90vw max):
┌──────────────────────────────┐
│ API Name:                    │
│ ses_falls_city.Main_System.  │
│ AHU_101.Supply_Air_          │
│ Temperature.Sensor           │
│     [Copy Button]            │
└──────────────────────────────┘
     ↑ Wraps naturally within screen
```

### Scenario 2: Simple Tooltip on Desktop

```
BEFORE (Fixed 500px):
┌──────────────────────────────────────────────────┐
│ Value: 72.5 °F                  (wasted space) │
└──────────────────────────────────────────────────┘
     ↑ Unnecessarily wide for short content

AFTER (Adaptive min 280px):
┌─────────────────────────┐
│ Value: 72.5 °F          │
└─────────────────────────┘
     ↑ Compact but readable
```

### Scenario 3: Heatmap with Rich Content

```
BEFORE (Same as line chart, 450px):
┌─────────────────────────────────────────────────┐
│ Point: AHU_101                                  │
│ Time: 2:30 PM                                   │
│ Deviation: -5.2°F                               │
│ Control Point: Supply Air Temp                  │
│ Expected Range: 55-65°F                        │
│ Actual: 49.8°F                                 │
│ Duration: 45 minutes                           │
│ Impact: High                                   │
│                            (feels cramped)     │
└─────────────────────────────────────────────────┘

AFTER (Chart-specific 550px):
┌────────────────────────────────────────────────────┐
│ Point: AHU_101                                     │
│ Time: 2:30 PM                                      │
│ Deviation: -5.2°F                                  │
│                                                    │
│ Control Point: Supply Air Temp                     │
│ Expected Range: 55-65°F                            │
│ Actual: 49.8°F                                     │
│                                                    │
│ Duration: 45 minutes                               │
│ Impact: High                                       │
│                    (comfortable reading)          │
└────────────────────────────────────────────────────┘
```

---

## 10. Testing Checklist

### Device Testing
- [ ] iPhone SE (375px width) - portrait
- [ ] iPhone SE (667px width) - landscape
- [ ] iPad (768px width) - portrait
- [ ] iPad (1024px width) - landscape
- [ ] Desktop 1920x1080
- [ ] Desktop 2560x1440 (4K)

### Content Testing
- [ ] Single-line tooltip (e.g., "Value: 75 °F")
- [ ] API name with 100+ characters
- [ ] Multi-series tooltip with 20+ series
- [ ] Heatmap tooltip with all metadata
- [ ] Tooltip with long description paragraph

### Viewport Edge Testing
- [ ] Tooltip near top edge
- [ ] Tooltip near bottom edge
- [ ] Tooltip near left edge
- [ ] Tooltip near right edge
- [ ] Tooltip in corner

### Interaction Testing
- [ ] Hover tooltip (mouse)
- [ ] Touch tooltip (mobile)
- [ ] Pinned/clicked tooltip
- [ ] Tooltip with scrollable content
- [ ] Copy button within tooltip

---

## 11. Implementation Priority

### Phase 1: Core Responsive System (High Priority)
1. Implement breakpoint-based max-width constraints
2. Add viewport-aware sizing (90vw, 80vw, 70vw)
3. Update padding for mobile/tablet/desktop
4. Test on real devices

### Phase 2: Content Handling (Medium Priority)
1. Implement word-break for API names
2. Add scroll indicators for tall tooltips
3. Create chart-type-specific width overrides
4. Add line-height improvements

### Phase 3: Polish (Low Priority)
1. Add touch/mouse-specific optimizations
2. Implement compact mode for many series
3. Add expand/collapse for long content
4. Create tooltip preview in chart settings

---

## 12. Performance Considerations

### Render Performance

```typescript
// Use React.memo to prevent unnecessary re-renders
export const AdaptiveTooltip = React.memo<AdaptiveTooltipProps>(
  ({ point, children, chartType }) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    // Custom comparison to avoid re-render on chart data changes
    return (
      prevProps.point.name === nextProps.point.name &&
      prevProps.chartType === nextProps.chartType
    );
  }
);
```

### CSS Performance

```css
/* Use GPU-accelerated properties */
.tooltip-container {
  will-change: transform, opacity;
  transform: translateZ(0); /* Force GPU acceleration */
}

/* Avoid expensive properties during scroll */
.tooltip-container {
  /* ❌ Avoid during scroll: */
  /* filter: blur(2px); */
  /* box-shadow: 0 10px 50px rgba(0,0,0,0.5); */

  /* ✅ Use lightweight alternatives: */
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
```

### Viewport Resize Debouncing

```typescript
import { useDebounce } from '@/hooks/useDebounce';

// Debounce resize events to avoid excessive recalculations
const [windowWidth, setWindowWidth] = useState(window.innerWidth);

useEffect(() => {
  const handleResize = () => {
    setWindowWidth(window.innerWidth);
  };

  const debouncedResize = debounce(handleResize, 150);
  window.addEventListener('resize', debouncedResize);

  return () => {
    window.removeEventListener('resize', debouncedResize);
  };
}, []);
```

---

## 13. Accessibility Considerations

### Screen Reader Support

```typescript
<Tooltip
  title={tooltipContent}
  aria-label={`Point details for ${point.name}`}
  role="tooltip"
  // Ensure keyboard users can access tooltip
  enterDelay={300}
  leaveDelay={200}
>
  {children}
</Tooltip>
```

### Keyboard Navigation

```typescript
// Allow keyboard users to open/close tooltips
const [open, setOpen] = useState(false);

<Tooltip
  open={open}
  onOpen={() => setOpen(true)}
  onClose={() => setOpen(false)}
  // Support Enter/Space to open
  componentsProps={{
    tooltip: {
      onKeyDown: (e) => {
        if (e.key === 'Escape') {
          setOpen(false);
        }
      },
    },
  }}
>
  <div
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        setOpen(!open);
      }
    }}
  >
    {children}
  </div>
</Tooltip>
```

### Color Contrast

```css
/* Ensure WCAG AA compliance (4.5:1 ratio) */
.tooltip-container {
  background-color: rgba(50, 50, 50, 0.95); /* Dark background */
  color: #ffffff; /* White text = 10.9:1 ratio ✓ */
}

.tooltip-secondary-text {
  color: #cccccc; /* Light gray = 7.1:1 ratio ✓ */
}
```

---

## 14. Future Enhancements

### Adaptive Content Truncation

Intelligently truncate less-important content based on available space:

```typescript
const adaptiveFormatter = (point: Point, availableHeight: number) => {
  const sections = [
    { priority: 1, content: point.name, label: 'API Name' },
    { priority: 2, content: point.value, label: 'Value' },
    { priority: 3, content: point.displayName, label: 'Display Name' },
    { priority: 4, content: point.equipment, label: 'Equipment' },
    { priority: 5, content: point.metadata, label: 'Metadata' },
  ];

  // Render sections in priority order until height limit reached
  return renderSectionsWithLimit(sections, availableHeight);
};
```

### Smart Width Calculation

Use canvas to measure actual text width:

```typescript
const calculateOptimalWidth = (content: string, font: string): number => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 400;

  context.font = font;
  const metrics = context.measureText(content);

  // Add padding and constraints
  const width = Math.max(280, Math.min(550, metrics.width + 40));
  return width;
};
```

### Tooltip Positioning Intelligence

Prefer positions that don't block important chart data:

```typescript
const intelligentPlacement = (
  tooltipRect: DOMRect,
  chartRect: DOMRect,
  dataPoint: { x: number; y: number }
): TooltipPlacement => {
  // Avoid blocking area around data point
  const avoidZone = {
    x: dataPoint.x - 50,
    y: dataPoint.y - 50,
    width: 100,
    height: 100,
  };

  // Calculate best placement that avoids zone
  return calculateOptimalPlacement(tooltipRect, chartRect, avoidZone);
};
```

---

## 15. Migration Guide

### From Current Implementation

**Step 1**: Update EnhancedPointTooltip component:

```typescript
// Replace fixed maxWidth: 500 with adaptive calculation
componentsProps={{
  tooltip: {
    sx: {
      maxWidth: {
        xs: 'min(90vw, 350px)',
        sm: 'min(85vw, 450px)',
        md: 'min(80vw, 550px)',
      },
      minWidth: {
        xs: 200,
        sm: 240,
        md: 280,
      },
      padding: {
        xs: '10px 12px',
        sm: '11px 13px',
        md: '12px 16px',
      },
      // ... rest of styles
    },
  },
}}
```

**Step 2**: Update tooltipEnhancements.ts for ECharts:

```typescript
export function createEnhancedTooltip(options?: {
  chartType?: 'line' | 'bar' | 'heatmap' | 'deviation';
  // ... other options
}): TooltipComponentOption {
  const { chartType = 'line', ...rest } = options || {};

  // Calculate adaptive max width
  const maxWidth = calculateMaxWidth(chartType);

  return {
    // ... existing config
    extraCssText: `
      max-width: ${maxWidth}px;
      min-width: ${window.innerWidth < 600 ? '200px' : '280px'};
      word-wrap: break-word;
      line-height: 1.6;
    `,
  };
}
```

**Step 3**: Add responsive listener:

```typescript
// In chart component
useEffect(() => {
  const handleResize = debounce(() => {
    // Recalculate tooltip configuration
    chart.setOption(createEnhancedTooltip({ chartType }));
  }, 150);

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, [chartType]);
```

---

## 16. Conclusion

This adaptive tooltip sizing system provides:

1. **Automatic adaptation** to content length without manual configuration
2. **Viewport awareness** that prevents layout breaking on any device
3. **Chart-type optimization** for different data density needs
4. **Responsive design** with proper breakpoints and touch/mouse optimization
5. **Accessibility compliance** with keyboard support and screen reader compatibility
6. **Performance optimization** through memoization and debouncing

### Key Takeaways

- **Use hybrid approach**: Content-driven with viewport constraints
- **Prioritize readability**: Line-height 1.6-1.7, comfortable padding
- **Allow wrapping**: Never truncate critical information
- **Optimize by chart type**: Different charts need different widths
- **Test on real devices**: Emulators don't show real-world edge cases

### Implementation Timeline

- **Week 1**: Phase 1 (Core responsive system)
- **Week 2**: Phase 2 (Content handling)
- **Week 3**: Phase 3 (Polish and optimization)
- **Week 4**: Testing and refinement

---

**Document Status**: Ready for Implementation
**Review Required**: UX Team, Frontend Team
**Next Steps**: Create implementation tickets, assign to sprint
