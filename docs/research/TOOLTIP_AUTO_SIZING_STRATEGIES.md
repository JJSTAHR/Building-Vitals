# ECharts Tooltip Auto-Sizing Strategies

## Research Summary

Comprehensive guide on implementing responsive, auto-sizing tooltips for ECharts with optimal text wrapping, spacing, and cross-device compatibility.

---

## 1. ECharts Native Tooltip Sizing Options

### Built-in Properties

ECharts provides several native options for tooltip sizing control:

#### `tooltip.confine`
**Purpose**: Keeps tooltip within chart container boundaries
```javascript
tooltip: {
  confine: true  // Prevents tooltip from extending beyond chart bounds
}
```
**Best Practice**: Always enable for small screens or containers with `overflow: hidden`

#### `tooltip.extraCssText`
**Purpose**: Apply custom CSS directly to tooltip element
```javascript
tooltip: {
  extraCssText: 'max-width: 400px; white-space: pre-wrap; word-wrap: break-word;'
}
```

**Critical Finding**: `tooltip.textStyle.width` has **known bugs** (as of v5.0.2+) and should NOT be relied upon.

#### `tooltip.position`
**Purpose**: Custom positioning function for dynamic placement
```javascript
tooltip: {
  position: function (point, params, dom, rect, size) {
    // point: mouse position
    // size: {contentSize: [width, height], viewSize: [width, height]}

    var x = point[0]; // x position
    var y = point[1]; // y position

    // Keep tooltip on-screen
    if (x + size.contentSize[0] > size.viewSize[0]) {
      x = size.viewSize[0] - size.contentSize[0];
    }

    return [x, y];
  }
}
```

---

## 2. CSS Text Wrapping Strategies

### Core Properties Comparison

| Property | Purpose | Best Use Case | Browser Support |
|----------|---------|---------------|-----------------|
| `word-wrap: break-word` | Legacy property for text wrapping | Legacy browser support | All browsers |
| `overflow-wrap: break-word` | Modern standard for text wrapping | Long words without natural breaks | Modern browsers |
| `overflow-wrap: anywhere` | More aggressive breaking | Numbers, long URLs, no spaces | Modern browsers |
| `white-space: normal` | Allow natural text wrapping | Standard multi-line text | All browsers |
| `white-space: pre-wrap` | Preserve whitespace but wrap | Formatted text with line breaks | All browsers |
| `white-space: nowrap` | Single line, no wrapping | Short labels, headers | All browsers |
| `text-overflow: ellipsis` | Add "..." for overflow | Single-line truncation | All browsers |
| `hyphens: auto` | Add hyphens at break points | Long English words | Inconsistent |

### Recommended CSS for Auto-Sizing Tooltips

```css
.echarts-tooltip {
  /* Width Strategy */
  width: max-content;           /* Size to content */
  min-width: 100px;             /* Minimum readable width */
  max-width: min(400px, 80vw);  /* Responsive maximum */

  /* Text Wrapping */
  word-wrap: break-word;        /* Legacy support */
  overflow-wrap: break-word;    /* Modern standard */
  white-space: normal;          /* Allow wrapping */

  /* Padding and Spacing */
  padding: 12px 16px;           /* Comfortable reading space */
  line-height: 1.5;             /* Optimal readability */

  /* Additional */
  box-sizing: border-box;       /* Include padding in width */
  overflow: hidden;             /* Prevent content overflow */
}
```

### Advanced Text Handling

#### Multi-line Text with Line Clamping

For very long text, limit lines and show ellipsis:

```css
.echarts-tooltip-long-text {
  display: -webkit-box;
  -webkit-line-clamp: 4;        /* Show only 4 lines */
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 400px;

  /* Fallback for non-webkit browsers */
  max-height: 6em;              /* ~4 lines at line-height 1.5 */
  overflow: hidden;
}
```

**Browser Support**: Works in all modern browsers including Firefox (with -webkit- prefix)

#### Handling Different Text Lengths

```css
/* Short text (1-2 words) */
.tooltip-short {
  min-width: 80px;
  white-space: nowrap;
}

/* Medium text (1-2 lines) */
.tooltip-medium {
  min-width: 120px;
  max-width: 300px;
  white-space: normal;
}

/* Long text (3+ lines) */
.tooltip-long {
  min-width: 200px;
  max-width: 400px;
  white-space: normal;
  -webkit-line-clamp: 5;
}
```

---

## 3. Responsive Width Strategies

### Width Property Options

| Property | Behavior | Best For |
|----------|----------|----------|
| `width: auto` | Shrinks to minimum content | Not recommended for tooltips |
| `width: max-content` | Expands to full content width | Flexible tooltips, can cause horizontal scroll |
| `width: fit-content` | Similar to max-content but respects max-width | Good balance |
| `width: min-content` | Shrinks to narrowest word | Not recommended |

### Recommended Approach: Hybrid Width Strategy

```css
.echarts-tooltip-responsive {
  /* Mobile-first approach */
  width: max-content;
  min-width: 100px;
  max-width: 90vw;  /* Never exceed 90% of viewport */

  /* Tablet and up */
  @media (min-width: 768px) {
    max-width: 400px;
  }

  /* Desktop */
  @media (min-width: 1200px) {
    max-width: 500px;
  }
}
```

### Viewport Units for Mobile

```css
.echarts-tooltip-mobile {
  /* For very small screens */
  @media (max-width: 480px) {
    position: fixed !important;
    left: 5vw !important;
    right: 5vw !important;
    width: 90vw;
    max-width: none;
    transform: none !important;
  }
}
```

---

## 4. Padding and Buffer Guidelines

### Optimal Spacing Recommendations

Based on vertical rhythm principles and mobile touch standards:

```css
.echarts-tooltip-spacing {
  /* Padding */
  padding-top: 12px;       /* 1.5x base unit (8px) */
  padding-bottom: 12px;
  padding-left: 16px;      /* 2x base unit */
  padding-right: 16px;

  /* Line Height */
  line-height: 1.5;        /* Optimal for readability */

  /* Vertical Rhythm */
  margin-bottom: 8px;      /* Base rhythm unit */
}

/* Touch-friendly spacing for mobile */
@media (max-width: 768px) {
  .echarts-tooltip-spacing {
    padding: 16px 20px;    /* Larger touch targets */
    line-height: 1.6;      /* More breathing room */
  }
}
```

### Padding Size Guide

| Context | Padding | Line Height | Use Case |
|---------|---------|-------------|----------|
| Compact | 8px 12px | 1.4 | Dense dashboards, desktop-only |
| Standard | 12px 16px | 1.5 | General purpose, balanced |
| Comfortable | 16px 20px | 1.6 | Mobile, accessibility focus |
| Spacious | 20px 24px | 1.75 | Large screens, executive dashboards |

### Vertical Rhythm System

```css
:root {
  --tooltip-rhythm-unit: 8px;
  --tooltip-spacing-1x: calc(1 * var(--tooltip-rhythm-unit));  /* 8px */
  --tooltip-spacing-2x: calc(2 * var(--tooltip-rhythm-unit));  /* 16px */
  --tooltip-spacing-3x: calc(3 * var(--tooltip-rhythm-unit));  /* 24px */
}

.echarts-tooltip {
  padding: var(--tooltip-spacing-2x);
  line-height: 1.5;
  margin-bottom: var(--tooltip-spacing-1x);
}

.echarts-tooltip-header {
  margin-bottom: var(--tooltip-spacing-1x);
  font-weight: 600;
}

.echarts-tooltip-item {
  padding: var(--tooltip-spacing-1x) 0;
}
```

---

## 5. Real-World Examples

### Grafana Tooltip Strategy

**Key Insights**:
- Maximum height: 600px (default)
- Maximum width: Configurable in display settings
- Sort order: Decreasing (shows highest values first)
- Concise content: Non-critical, contextual information only

**Implementation Pattern**:
```javascript
tooltip: {
  confine: true,
  extraCssText: `
    max-width: 400px;
    max-height: 600px;
    overflow-y: auto;
    white-space: normal;
    word-wrap: break-word;
  `,
  formatter: function(params) {
    // Sort by value (descending)
    const sorted = Array.isArray(params)
      ? params.sort((a, b) => b.value - a.value)
      : [params];

    // Limit to top 10 entries
    const limited = sorted.slice(0, 10);

    return limited.map(p =>
      `${p.seriesName}: ${p.value}`
    ).join('<br/>');
  }
}
```

### Material-UI Tooltip Pattern

**Key Features**:
- Default max-width: 300px
- Wraps long text automatically
- Responsive viewport units for mobile

```css
.mui-tooltip {
  max-width: 300px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;

  /* Mobile responsive */
  @media (max-width: 600px) {
    max-width: 95vw;
    min-width: 200px;
  }
}
```

### Building Analytics Dashboard Pattern

For building management systems (HVAC, energy, occupancy):

```javascript
tooltip: {
  confine: true,
  extraCssText: `
    max-width: min(450px, 85vw);
    min-width: 200px;
    padding: 16px;
    line-height: 1.6;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: break-word;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `,
  formatter: function(params) {
    const data = params.data || params;

    // Handle long point names (e.g., "AHU-01-Zone-3-Temperature-Sensor-Return-Air")
    const pointName = data.name || params.name;
    const wrappedName = pointName.length > 40
      ? pointName.replace(/(.{40})/g, '$1<wbr/>') // Word break opportunities
      : pointName;

    return `
      <div style="font-weight: 600; margin-bottom: 8px; max-width: 100%;">
        ${wrappedName}
      </div>
      <div style="color: #666; font-size: 0.9em;">
        Value: ${data.value}<br/>
        Time: ${data.timestamp}<br/>
        Unit: ${data.unit || 'N/A'}
      </div>
    `;
  }
}
```

---

## 6. Complete Implementation Guide

### Recommended CSS Configuration

```css
/* Base Tooltip Styles */
.echarts-tooltip {
  /* Width Strategy */
  width: max-content;
  min-width: 120px;
  max-width: min(400px, 80vw);

  /* Text Handling */
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;

  /* Spacing */
  padding: 12px 16px;
  line-height: 1.5;

  /* Visual */
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  /* Font */
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Mobile Optimizations */
@media (max-width: 768px) {
  .echarts-tooltip {
    max-width: 90vw;
    padding: 16px 20px;
    line-height: 1.6;
    font-size: 15px;  /* Slightly larger for mobile */
  }
}

/* Very small screens */
@media (max-width: 480px) {
  .echarts-tooltip {
    position: fixed !important;
    left: 5vw !important;
    width: 90vw !important;
    max-width: none !important;
    transform: none !important;
  }
}

/* Large screens */
@media (min-width: 1600px) {
  .echarts-tooltip {
    max-width: 500px;
    padding: 16px 20px;
    font-size: 15px;
  }
}
```

### ECharts Configuration

```javascript
const chartOptions = {
  tooltip: {
    // Enable and position
    show: true,
    trigger: 'item',  // or 'axis' depending on chart type
    confine: true,    // Keep within bounds

    // Positioning
    position: function(point, params, dom, rect, size) {
      const [x, y] = point;
      const {contentSize, viewSize} = size;

      // Default position
      let posX = x + 10;
      let posY = y + 10;

      // Keep on screen horizontally
      if (posX + contentSize[0] > viewSize[0]) {
        posX = x - contentSize[0] - 10;
      }

      // Keep on screen vertically
      if (posY + contentSize[1] > viewSize[1]) {
        posY = y - contentSize[1] - 10;
      }

      return [posX, posY];
    },

    // Styling
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: '#ddd',
    borderWidth: 1,
    textStyle: {
      color: '#333',
      fontSize: 14
    },

    // Custom CSS
    extraCssText: `
      max-width: min(400px, 80vw);
      min-width: 120px;
      padding: 12px 16px;
      line-height: 1.5;
      white-space: normal;
      word-wrap: break-word;
      overflow-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      border-radius: 4px;
    `,

    // Formatter
    formatter: function(params) {
      // Handle array of data (multiple series)
      const dataArray = Array.isArray(params) ? params : [params];

      // Build tooltip HTML
      let html = '';

      dataArray.forEach((item, index) => {
        const name = item.name || item.seriesName;
        const value = item.value;

        // Add line break after first item
        if (index > 0) html += '<br/>';

        // Format name (handle long names)
        const displayName = name.length > 50
          ? name.substring(0, 47) + '...'
          : name;

        // Color marker
        const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};margin-right:8px;"></span>`;

        // Build line
        html += `${marker}${displayName}: <strong>${value}</strong>`;
      });

      return html;
    }
  }
};
```

---

## 7. Edge Case Handling

### Very Short Text (1-10 characters)

```css
.tooltip-short-text {
  min-width: 80px;       /* Prevent tiny tooltips */
  padding: 8px 12px;     /* Less padding for short content */
  white-space: nowrap;   /* Keep on one line */
}
```

### Very Long Text (100+ characters)

```css
.tooltip-long-text {
  max-width: min(500px, 90vw);
  max-height: 400px;
  overflow-y: auto;       /* Allow scrolling if too long */
  -webkit-line-clamp: 8;  /* Limit to 8 lines */
  display: -webkit-box;
  -webkit-box-orient: vertical;
}
```

### Multiple Lines with Different Lengths

```javascript
formatter: function(params) {
  return `
    <div style="max-width: 400px;">
      <div style="font-weight: 600; margin-bottom: 8px; word-wrap: break-word;">
        ${params.name}
      </div>
      <div style="font-size: 0.9em; color: #666;">
        ${params.data.description}
      </div>
      <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px;">
        Value: <strong>${params.value}</strong>
      </div>
    </div>
  `;
}
```

### Numbers and Long URLs

```css
.tooltip-numbers {
  overflow-wrap: anywhere;  /* Break numbers at any point */
  word-break: break-all;    /* Alternative: break-all */
}
```

### Mixed Content (Icons, Images, Text)

```javascript
formatter: function(params) {
  return `
    <div style="display: flex; align-items: start; max-width: 400px;">
      <img src="${params.data.icon}" style="width: 24px; height: 24px; margin-right: 12px; flex-shrink: 0;" />
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 600; overflow-wrap: break-word;">
          ${params.name}
        </div>
        <div style="font-size: 0.9em; color: #666; margin-top: 4px;">
          ${params.value}
        </div>
      </div>
    </div>
  `;
}
```

---

## 8. Performance Considerations

### Optimization Tips

1. **Avoid Recalculating Width**: Use CSS instead of JavaScript for sizing
2. **Debounce Position Updates**: Throttle tooltip position calculations
3. **Limit Content**: Truncate very long lists or text
4. **Use CSS Transforms**: For positioning instead of top/left when possible
5. **Virtual Scrolling**: For tooltips with many items

```javascript
// Example: Debounced tooltip positioning
let positionTimeout;
const debouncedPosition = function(point, params, dom, rect, size) {
  clearTimeout(positionTimeout);
  positionTimeout = setTimeout(() => {
    // Calculate position
  }, 16); // ~60fps
};
```

---

## 9. Accessibility Considerations

### WCAG Compliance

```css
.echarts-tooltip-accessible {
  /* Minimum font size */
  font-size: 14px;

  /* Adequate contrast */
  background: #fff;
  color: #333;

  /* Readable line length */
  max-width: 65ch;  /* ~65 characters per line */

  /* Adequate line height */
  line-height: 1.5;

  /* Touch-friendly padding */
  padding: 16px;

  /* Focus visible */
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.echarts-tooltip-accessible:focus {
  outline-color: #0066cc;
}
```

### Keyboard Navigation Support

```javascript
// Allow keyboard users to access tooltip content
tooltip: {
  triggerOn: 'mousemove|click',  // Enable click for keyboard users
  alwaysShowContent: false,      // Don't auto-show
  // ... other options
}
```

---

## 10. Testing Checklist

### Device Testing

- [ ] iPhone SE (375px width)
- [ ] iPhone 14 Pro (393px width)
- [ ] iPad Mini (768px width)
- [ ] iPad Pro (1024px width)
- [ ] Desktop 1920px
- [ ] Desktop 2560px (4K)

### Content Testing

- [ ] Short text (5-10 chars)
- [ ] Medium text (20-50 chars)
- [ ] Long text (100+ chars)
- [ ] Very long text (500+ chars)
- [ ] Text with numbers only
- [ ] Text with special characters
- [ ] Multiple lines (2-5 lines)
- [ ] Many lines (10+ lines)

### Edge Cases

- [ ] Tooltip near screen edge (right)
- [ ] Tooltip near screen edge (bottom)
- [ ] Tooltip near screen edge (top-left corner)
- [ ] Tooltip with HTML content
- [ ] Tooltip with images
- [ ] Tooltip on rotated chart
- [ ] Tooltip on zoomed chart

---

## Summary: The RIGHT Combination

### For Most Use Cases (Recommended)

```javascript
tooltip: {
  confine: true,
  extraCssText: `
    width: max-content;
    min-width: 120px;
    max-width: min(400px, 80vw);
    padding: 12px 16px;
    line-height: 1.5;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: break-word;
    box-sizing: border-box;
  `,
  position: function(point, params, dom, rect, size) {
    const [x, y] = point;
    const {contentSize, viewSize} = size;

    let posX = x + 10;
    let posY = y + 10;

    if (posX + contentSize[0] > viewSize[0]) {
      posX = x - contentSize[0] - 10;
    }

    if (posY + contentSize[1] > viewSize[1]) {
      posY = y - contentSize[1] - 10;
    }

    return [posX, posY];
  }
}
```

### Key Principles

1. **Always use `confine: true`** to prevent off-screen tooltips
2. **Use `max-content` width** with responsive max-width constraint
3. **Combine `word-wrap` and `overflow-wrap`** for maximum compatibility
4. **Use `min()` function** for responsive max-width: `min(400px, 80vw)`
5. **Implement custom position function** to handle screen edges
6. **Set adequate padding** (12-16px) for comfortable reading
7. **Use line-height 1.5** for optimal readability
8. **Test on real devices** with varying content lengths

This combination ensures tooltips automatically size to content while remaining fully responsive and accessible across all devices and content types.
