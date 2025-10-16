# KV Tag Display UI Specification

## Overview
This specification defines the UI/UX design for displaying KV (Key-Value) tag data alongside cleaned point names in the PointSelector component, optimized for Material-UI, react-window virtual scrolling, and large datasets (50K+ points).

---

## 1. Component Architecture

### 1.1 Component Hierarchy
```
PointSelector (Container)
├── VirtualList (react-window)
│   └── PointListItem (Row Renderer)
│       ├── PointName (Typography)
│       └── TagChipGroup (Flex Container)
│           ├── PrimaryTagChip (MUI Chip)
│           ├── SecondaryTagChips (MUI Chip[])
│           └── OverflowIndicator (+N Chip)
```

### 1.2 Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ [Icon] Point Name                    [Tag1] [Tag2] [+3]     │
└─────────────────────────────────────────────────────────────┘
```

**Desktop/Tablet (>768px):**
- Row height: 56px (comfortable touch target)
- Point name: flex-grow, min-width 200px
- Tags: flex-shrink-0, max-width 50% of row

**Mobile (<768px):**
- Row height: 64px (larger touch targets)
- Tags wrap to second line if needed
- Max 2 visible tags + overflow indicator

---

## 2. Material-UI Component Selection

### 2.1 Primary Component: MUI Chip
**Rationale:**
- Built-in delete/action handlers
- Consistent sizing and spacing
- Accessible by default (role="button")
- Supports icons and avatars
- Well-optimized for rendering

**Configuration:**
```typescript
<Chip
  size="small"              // Compact for list density
  variant="outlined"        // Less visual weight than filled
  label={tag.key}           // Or key:value format
  icon={<CategoryIcon />}   // Optional category indicator
  onDelete={onRemoveTag}    // Optional tag removal
  sx={{
    height: 24,             // Consistent height
    fontSize: '0.75rem',    // 12px readable size
    fontWeight: 500,
    borderRadius: '12px',   // Rounded pill shape
  }}
/>
```

### 2.2 Alternative: MUI Badge (For Count Indicators)
Used only for overflow indicator (+N more tags):
```typescript
<Chip
  size="small"
  variant="filled"
  label="+3"
  sx={{
    backgroundColor: 'grey.300',
    color: 'grey.700',
  }}
/>
```

### 2.3 Rejected Alternatives
- **Badge**: Too small for multi-character labels
- **Tooltip**: Hidden by default, not discoverable
- **IconButton**: Lacks text display area

---

## 3. Tag Display Strategy

### 3.1 Tag Prioritization Logic
Display tags in order of importance:

1. **Primary Tag** (Always visible):
   - Most semantically important (e.g., "Type: Temperature")
   - Determined by tag category priority

2. **Secondary Tags** (Space permitting):
   - Additional metadata (e.g., "Unit: °F", "Location: Floor3")
   - Max 2-3 visible on desktop, 1-2 on mobile

3. **Overflow Indicator** (When needed):
   - Shows "+N" for hidden tags
   - Clickable to expand/show tooltip

**Priority Order:**
```javascript
const TAG_PRIORITY = {
  type: 1,        // Equipment/point type
  unit: 2,        // Measurement unit
  location: 3,    // Physical location
  system: 4,      // System/subsystem
  status: 5,      // Operational status
  meta: 6,        // Additional metadata
};
```

### 3.2 Display Modes

**Compact Mode (Default):**
- Show 1-3 most important tags
- Use overflow indicator for hidden tags
- Optimize for list scanning

**Expanded Mode (Hover/Focus):**
- Show all tags in tooltip/popover
- Triggered by hover on overflow indicator
- Include full key:value pairs

**Dense Mode (Optional User Preference):**
- Row height: 40px
- Tags: size="small", height 20px
- Max 2 tags + overflow

---

## 4. Color Scheme & Categorization

### 4.1 Tag Category Colors
Based on Material Design 3 color system with semantic meaning:

```typescript
const TAG_COLORS = {
  // Equipment/Point Types - Blue family
  type: {
    temperature: { border: '#1976d2', bg: '#e3f2fd', text: '#0d47a1' },
    setpoint:    { border: '#0288d1', bg: '#e1f5fe', text: '#01579b' },
    sensor:      { border: '#0277bd', bg: '#b3e5fc', text: '#014a7f' },
    actuator:    { border: '#039be5', bg: '#81d4fa', text: '#01579b' },
  },

  // Units - Green family
  unit: {
    default:     { border: '#388e3c', bg: '#e8f5e9', text: '#1b5e20' },
  },

  // Location - Purple family
  location: {
    default:     { border: '#7b1fa2', bg: '#f3e5f5', text: '#4a148c' },
  },

  // System - Orange family
  system: {
    hvac:        { border: '#f57c00', bg: '#fff3e0', text: '#e65100' },
    lighting:    { border: '#fb8c00', bg: '#ffe0b2', text: '#e65100' },
    electrical:  { border: '#ff9800', bg: '#ffecb3', text: '#ff6f00' },
  },

  // Status - Semantic colors
  status: {
    active:      { border: '#2e7d32', bg: '#e8f5e9', text: '#1b5e20' },
    inactive:    { border: '#757575', bg: '#f5f5f5', text: '#424242' },
    error:       { border: '#d32f2f', bg: '#ffebee', text: '#c62828' },
    warning:     { border: '#f57c00', bg: '#fff3e0', text: '#e65100' },
  },

  // Metadata - Grey family (low emphasis)
  meta: {
    default:     { border: '#757575', bg: '#fafafa', text: '#424242' },
  },
};
```

### 4.2 Color Application
```typescript
<Chip
  sx={{
    borderColor: TAG_COLORS[category][type].border,
    backgroundColor: TAG_COLORS[category][type].bg,
    color: TAG_COLORS[category][type].text,
    '&:hover': {
      backgroundColor: alpha(TAG_COLORS[category][type].bg, 0.8),
    },
  }}
/>
```

### 4.3 Accessibility Compliance
- All color combinations meet WCAG 2.1 AA contrast ratio (4.5:1)
- Color is not the sole indicator (text labels always present)
- High contrast mode supported via theme

---

## 5. UI Mockups

### 5.1 Desktop List View
```
┌────────────────────────────────────────────────────────────────┐
│ Search: [___________________________] [Filter▼] [Sort▼]         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🌡️  AHU-1 Supply Air Temperature                               │
│     [Type: Sensor] [Unit: °F] [Location: Floor 3] [+2]         │
│                                                                 │
│ ⚙️  VAV-205 Damper Position Setpoint                           │
│     [Type: Setpoint] [Unit: %] [System: HVAC] [+1]             │
│                                                                 │
│ 💡  Room 301 Occupancy Status                                   │
│     [Type: Sensor] [Status: Active] [System: Lighting]         │
│                                                                 │
│ 🔌  Panel A-3 Power Consumption                                │
│     [Type: Sensor] [Unit: kW] [System: Electrical] [+3]        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Mobile List View
```
┌──────────────────────────────┐
│ Search: [___________] [≡]    │
├──────────────────────────────┤
│                              │
│ 🌡️  AHU-1 Supply Air Temp   │
│     [Sensor] [°F]            │
│     [+3 more]                │
│                              │
│ ⚙️  VAV-205 Damper Position  │
│     [Setpoint] [%]           │
│     [+2 more]                │
│                              │
│ 💡  Room 301 Occupancy       │
│     [Sensor] [Active]        │
│                              │
└──────────────────────────────┘
```

### 5.3 Expanded Tag View (Tooltip)
```
Hover on "+3" chip:
┌──────────────────────────────────┐
│ Additional Tags:                 │
│                                  │
│ • Building: North Wing           │
│ • Floor: 3                       │
│ • Equipment ID: AHU-001          │
│ • Last Calibrated: 2024-01-15    │
│                                  │
└──────────────────────────────────┘
```

---

## 6. Performance Optimization

### 6.1 Virtual Scrolling Considerations
React-window requires consistent row heights for optimal performance.

**Strategy:**
- Use fixed row heights (56px/64px)
- Pre-calculate visible tags during data processing
- Store processed tag display data in item cache

**Implementation:**
```typescript
interface ProcessedPointItem {
  id: string;
  displayName: string;
  visibleTags: TagData[];      // Pre-filtered to max 3
  hiddenTagCount: number;      // For overflow indicator
  allTags: TagData[];          // For expanded view
}

// Pre-process during data fetch/filter
const processedItems = rawPoints.map(point => ({
  ...point,
  visibleTags: prioritizeTags(point.tags).slice(0, 3),
  hiddenTagCount: Math.max(0, point.tags.length - 3),
  allTags: point.tags,
}));
```

### 6.2 Rendering Optimization
```typescript
// Memoize row renderer
const PointRow = memo(({ index, style, data }) => {
  const item = data[index];

  return (
    <ListItem style={style}>
      <PointName>{item.displayName}</PointName>
      <TagChipGroup>
        {item.visibleTags.map(tag => (
          <TagChip key={tag.key} tag={tag} />
        ))}
        {item.hiddenTagCount > 0 && (
          <OverflowChip count={item.hiddenTagCount} />
        )}
      </TagChipGroup>
    </ListItem>
  );
});
```

### 6.3 Tag Data Loading Strategy
- Load tags with initial point data (single query)
- Cache tag configurations (colors, priorities) in memory
- Use React Query for automatic caching and stale data handling

**Performance Targets:**
- Initial render: <200ms for 50K points
- Scroll performance: 60fps (16.6ms per frame)
- Tag hover/expand: <100ms response time

---

## 7. Accessibility Requirements

### 7.1 ARIA Attributes
```tsx
<Chip
  role="button"
  aria-label={`${tag.key}: ${tag.value}`}
  tabIndex={0}
  onKeyDown={handleKeyDown}
  sx={chipStyles}
>
  {tag.key}
</Chip>

<Chip
  role="button"
  aria-label={`Show ${hiddenTagCount} more tags`}
  aria-haspopup="true"
  aria-expanded={isExpanded}
  tabIndex={0}
>
  +{hiddenTagCount}
</Chip>
```

### 7.2 Keyboard Navigation
- **Tab**: Navigate between list items
- **Arrow Keys**: Move between tags within item
- **Enter/Space**: Activate tag (show details/remove)
- **Escape**: Close expanded tag view

### 7.3 Screen Reader Support
```tsx
<ListItem aria-label={`
  Point: ${pointName},
  Tags: ${visibleTags.map(t => `${t.key} ${t.value}`).join(', ')},
  ${hiddenTagCount} additional tags
`}>
```

### 7.4 Focus Management
- Visible focus indicators (2px outline)
- Focus trap in expanded tag modal/tooltip
- Restore focus after tag removal

### 7.5 Color Blindness Considerations
- Use icons alongside colors (e.g., thermometer for temperature)
- Patterns/textures for critical distinctions
- Test with color blindness simulators

---

## 8. Responsive Design Breakpoints

### 8.1 Desktop (≥1200px)
- Row height: 56px
- Max visible tags: 4
- Tag font size: 12px
- Show full key:value format

### 8.2 Tablet (768px - 1199px)
- Row height: 56px
- Max visible tags: 3
- Tag font size: 11px
- Abbreviated labels where possible

### 8.3 Mobile (≤767px)
- Row height: 64px
- Max visible tags: 2
- Tag font size: 11px
- Stack tags if space constrained
- Always show overflow indicator

---

## 9. Interaction Patterns

### 9.1 Tag Click Behavior
**Default**: Show tooltip with full tag details
```
Click on [Type: Sensor] →
Tooltip: "Point Type: Temperature Sensor
          Category: HVAC
          Data Type: Analog"
```

**Alternative**: Filter list by clicked tag
```
Click on [Location: Floor 3] →
Filter applied: Show only Floor 3 points
```

### 9.2 Tag Removal (Optional Feature)
```tsx
<Chip
  onDelete={handleDelete}
  deleteIcon={<CloseIcon />}
  sx={{ '& .MuiChip-deleteIcon': { fontSize: 16 } }}
/>
```

### 9.3 Overflow Indicator Interaction
**Hover**: Show tooltip with all hidden tags
**Click**: Expand inline or open modal with full tag list
**Mobile**: Always use click (no hover)

---

## 10. Dark Mode Support

### 10.1 Color Adjustments
```typescript
const TAG_COLORS_DARK = {
  type: {
    temperature: {
      border: '#64b5f6',
      bg: alpha('#1976d2', 0.15),
      text: '#90caf9'
    },
    // ... other types
  },
  // Increase contrast for dark backgrounds
  // Use lighter borders and text
  // Reduce background opacity
};
```

### 10.2 Theme Integration
```typescript
const chipStyles = {
  borderColor: theme.palette.mode === 'dark'
    ? TAG_COLORS_DARK[category][type].border
    : TAG_COLORS[category][type].border,
  // ...
};
```

---

## 11. User Preferences (Optional)

### 11.1 Customization Options
- **Tag Visibility**: Show/hide specific tag categories
- **Color Scheme**: Standard/High Contrast/Colorblind-friendly
- **Density**: Comfortable/Compact/Dense
- **Tag Format**: Key only / Key:Value / Value only

### 11.2 Persistence
Store preferences in:
- LocalStorage (client-side)
- User profile (server-side)
- URL parameters (shareable filters)

---

## 12. Implementation Phases

### Phase 1: Core Display (MVP)
- Basic chip rendering with fixed colors
- Top 3 tags + overflow indicator
- Desktop layout only

### Phase 2: Enhanced Features
- Dynamic color coding by category
- Responsive mobile layout
- Hover tooltips

### Phase 3: Advanced Interactions
- Tag filtering/search
- User preferences
- Tag removal (if needed)

### Phase 4: Optimization
- Performance tuning for 50K+ points
- A11y audit and fixes
- Dark mode polish

---

## 13. Design Rationale

### 13.1 Why Chips?
- **Visual Hierarchy**: Clear separation from point names
- **Scannability**: Colored pills are easy to scan in lists
- **Flexibility**: Can show key, value, or both
- **Familiarity**: Common pattern in modern UIs

### 13.2 Why Outlined Variant?
- Less visual weight than filled
- Better for dense lists
- Maintains clear boundaries
- Works well in light/dark modes

### 13.3 Why Limit Visible Tags?
- Prevents information overload
- Maintains consistent row heights (virtual scrolling)
- Encourages prioritization of important metadata
- Improves scan speed

---

## 14. Success Metrics

### 14.1 Usability
- Users can identify point type within 2 seconds
- 90%+ users understand tag meaning without training
- <5% users report tag clutter

### 14.2 Performance
- List renders in <200ms with 50K points
- Smooth 60fps scrolling
- No perceptible lag on tag hover

### 14.3 Accessibility
- WCAG 2.1 AA compliance (100%)
- Keyboard navigation success rate >95%
- Screen reader compatibility verified

---

## 15. References & Resources

### Material-UI Documentation
- [Chip Component](https://mui.com/material-ui/react-chip/)
- [Color System](https://mui.com/material-ui/customization/color/)
- [Accessibility Guide](https://mui.com/material-ui/guides/accessibility/)

### Design Systems
- Material Design 3: Tags & Chips
- Apple HIG: Tags
- Microsoft Fluent UI: Tags

### Performance
- React-window: [Variable Size Lists](https://react-window.vercel.app/)
- React.memo: [Optimization](https://react.dev/reference/react/memo)

---

## Appendix A: Code Examples

### A.1 TagChip Component
```typescript
import { Chip, Tooltip } from '@mui/material';
import { memo } from 'react';

interface TagChipProps {
  tag: {
    key: string;
    value: string;
    category: string;
    type: string;
  };
  onRemove?: (key: string) => void;
}

export const TagChip = memo<TagChipProps>(({ tag, onRemove }) => {
  const colors = TAG_COLORS[tag.category]?.[tag.type] ?? TAG_COLORS.meta.default;

  return (
    <Tooltip title={`${tag.key}: ${tag.value}`}>
      <Chip
        size="small"
        variant="outlined"
        label={tag.key}
        onDelete={onRemove ? () => onRemove(tag.key) : undefined}
        sx={{
          height: 24,
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: '12px',
          borderColor: colors.border,
          backgroundColor: colors.bg,
          color: colors.text,
          '& .MuiChip-deleteIcon': {
            fontSize: 16,
            color: colors.text,
          },
        }}
      />
    </Tooltip>
  );
});
```

### A.2 OverflowChip Component
```typescript
import { Chip, Popover, List, ListItem, Typography } from '@mui/material';
import { memo, useState } from 'react';

interface OverflowChipProps {
  count: number;
  allTags: TagData[];
}

export const OverflowChip = memo<OverflowChipProps>(({ count, allTags }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Chip
        size="small"
        variant="filled"
        label={`+${count}`}
        onClick={handleClick}
        aria-label={`Show ${count} more tags`}
        aria-haspopup="true"
        aria-expanded={open}
        sx={{
          height: 24,
          fontSize: '0.75rem',
          backgroundColor: 'grey.300',
          color: 'grey.700',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'grey.400',
          },
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <List sx={{ p: 1, minWidth: 200 }}>
          {allTags.map(tag => (
            <ListItem key={tag.key} dense>
              <Typography variant="body2">
                <strong>{tag.key}:</strong> {tag.value}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Popover>
    </>
  );
});
```

---

## Document Version
- **Version**: 1.0
- **Date**: 2025-10-16
- **Author**: UX Design Team
- **Status**: Ready for Development
