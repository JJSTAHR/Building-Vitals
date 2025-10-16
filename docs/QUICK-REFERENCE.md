# Token Management UI - Quick Reference

## Import and Setup

```typescript
// 1. Import animations CSS (once in App.tsx)
import './styles/animations.css';

// 2. Import components
import {
  NoTokensEmptyState,
  TokenCardSkeleton,
  TokenSuccessSnackbar,
  tokenNotifications,
} from '@/components/common';

// 3. Import theme
import { TOKEN_STATUS_COLORS, TOKEN_UI_SPACING } from '@/theme/tokenTheme';

// 4. Import enhanced components
import { TokenStatusBadge } from '@/components/settings/TokenStatusBadge';
import { AddTokenDialog } from '@/components/settings/AddTokenDialog';
```

---

## Common Patterns

### Loading State
```tsx
{loading ? (
  <TokenCardSkeleton count={3} />
) : (
  tokens.map(token => <TokenCard {...token} />)
)}
```

### Empty State
```tsx
{tokens.length === 0 && (
  <NoTokensEmptyState onAddToken={() => setDialogOpen(true)} />
)}
```

### Notification
```tsx
const [notification, setNotification] = useState(null);

// Show notification
setNotification(tokenNotifications.added('Falls City Hospital'));

// Render
<TokenSuccessSnackbar
  open={!!notification}
  onClose={() => setNotification(null)}
  {...notification}
/>
```

### Status Badge
```tsx
<TokenStatusBadge
  status="urgent"
  daysRemaining={2}
  size="medium"
  showAnimation={true}
/>
```

### Animated Card
```tsx
<Card className="token-fade-in token-card-hover">
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

---

## Animation Classes

```tsx
className="token-fade-in"           // Fade in entrance
className="token-slide-in-top"      // Slide from top
className="token-scale-in"          // Scale entrance
className="token-pulse"             // Pulsing animation
className="token-card-hover"        // Card hover effect
className="token-button-hover"      // Button hover effect
className="token-icon-hover"        // Icon hover effect
className="token-transition"        // Smooth transitions
```

---

## Theme Constants

```typescript
// Colors
TOKEN_STATUS_COLORS.active.main     // #4caf50
TOKEN_STATUS_COLORS.warning.main    // #ff9800
TOKEN_STATUS_COLORS.urgent.main     // #f44336
TOKEN_STATUS_COLORS.expired.main    // #9e9e9e

// Spacing
TOKEN_UI_SPACING.cardGap           // 3 (24px)
TOKEN_UI_SPACING.sectionMargin     // 4 (32px)
TOKEN_UI_SPACING.itemPadding       // 2 (16px)
TOKEN_UI_SPACING.iconGap           // 1 (8px)

// Animations
TOKEN_ANIMATIONS.fast              // 150ms
TOKEN_ANIMATIONS.standard          // 300ms
TOKEN_ANIMATIONS.slow              // 500ms
TOKEN_ANIMATIONS.pulse             // 2000ms
```

---

## Notification Presets

```typescript
tokenNotifications.added(siteName)
tokenNotifications.updated(siteName)
tokenNotifications.deleted(siteName)
tokenNotifications.error(errorMessage)
tokenNotifications.expiring(siteName, days, onUpdate)
tokenNotifications.migrationSuccess(count)
tokenNotifications.validated()
tokenNotifications.batchOperation(operation, success, total)
```

---

## Responsive Pattern

```tsx
import { useTheme, useMediaQuery } from '@mui/material';

const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

<Button
  fullWidth={isMobile}
  size={isMobile ? 'large' : 'medium'}
>
```

---

## Color Usage

```tsx
// Using theme colors
sx={{
  color: TOKEN_STATUS_COLORS.active.main,
  bgcolor: TOKEN_STATUS_COLORS.active.bg,
  borderColor: TOKEN_STATUS_COLORS.urgent.main,
}}
```

---

## Hover Effects

```tsx
// Card hover
sx={{
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: 3,
  },
}}

// Button hover
sx={{
  '&:not(:disabled):hover': {
    transform: 'scale(1.05)',
    boxShadow: 4,
  },
}}

// Icon hover
sx={{
  '&:hover': {
    transform: 'rotate(180deg)',
    transition: 'transform 0.3s ease',
  },
}}
```

---

## Typography Patterns

```tsx
// Section header
<Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>

// Subsection header
<Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>

// Body text
<Typography variant="body2" color="text.secondary">

// Label
<Typography variant="caption" textTransform="uppercase">
```

---

## Complete Example

```tsx
function TokenCard({ token }) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateToken(token.id);
      setNotification(
        tokenNotifications.updated(token.siteName)
      );
    } catch (error) {
      setNotification(
        tokenNotifications.error(error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <TokenCardSkeleton />;
  }

  return (
    <>
      <Card
        elevation={token.needsAttention ? 6 : 1}
        className="token-fade-in token-card-hover"
      >
        <CardContent>
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mb: TOKEN_UI_SPACING.itemPadding
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {token.siteName}
            </Typography>
            <TokenStatusBadge
              status={token.status}
              daysRemaining={token.daysRemaining}
            />
          </Box>

          <Button
            variant="outlined"
            onClick={handleUpdate}
            className="token-button-hover"
          >
            Update Token
          </Button>
        </CardContent>
      </Card>

      <TokenSuccessSnackbar
        open={!!notification}
        onClose={() => setNotification(null)}
        {...notification}
      />
    </>
  );
}
```

---

## Files Reference

| Component | Import From |
|-----------|-------------|
| EmptyStates | `@/components/common` |
| Skeletons | `@/components/common` |
| Snackbar | `@/components/common` |
| StatusBadge | `@/components/settings/TokenStatusBadge` |
| AddDialog | `@/components/settings/AddTokenDialog` |
| Theme | `@/theme/tokenTheme` |
| Animations | `@/styles/animations.css` |

---

## Testing Checklist

- [ ] Import animations.css in App.tsx
- [ ] Test loading skeletons
- [ ] Test empty states
- [ ] Test notifications
- [ ] Test mobile responsive
- [ ] Test keyboard navigation
- [ ] Test screen reader
- [ ] Test reduced motion

---

**For detailed documentation, see:**
- `docs/UI-DESIGN-GUIDE.md` - Complete design guide
- `docs/VISUAL-POLISH-SUMMARY.md` - Implementation summary
