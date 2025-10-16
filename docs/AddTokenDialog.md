# AddTokenDialog Component

A comprehensive React component for adding and validating authentication tokens in multi-site token management systems.

## Overview

The `AddTokenDialog` component provides a user-friendly interface for adding new site tokens to the Building Vitals application. It features real-time JWT validation, expiration warnings, duplicate site prevention, and optional API testing.

## Features

- **Real-time JWT Validation**: Validates token format as user types
- **Visual Feedback**: Color-coded icons showing validation status
- **Expiration Detection**: Displays token expiry date and days remaining
- **Warning System**: Alerts for tokens expiring soon
- **Duplicate Prevention**: Checks for existing site IDs
- **API Testing**: Optional test before saving
- **Mobile Responsive**: Full-screen dialog on mobile devices
- **Secure Input**: Password field with show/hide toggle
- **Accessibility**: WCAG compliant with proper ARIA labels

## Installation

The component is located at:
```
src/components/AddTokenDialog.tsx
```

## Basic Usage

```tsx
import React, { useState } from 'react';
import { Button } from '@mui/material';
import { AddTokenDialog } from './components/AddTokenDialog';

function Settings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingSites, setExistingSites] = useState(['ses_site_1', 'ses_site_2']);

  const handleTokenAdded = (siteId: string) => {
    console.log(`Token added for: ${siteId}`);
    setExistingSites(prev => [...prev, siteId]);
  };

  return (
    <div>
      <Button onClick={() => setDialogOpen(true)}>
        Add Site Token
      </Button>

      <AddTokenDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onTokenAdded={handleTokenAdded}
        existingSites={existingSites}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls dialog visibility |
| `onClose` | `() => void` | Yes | Called when dialog should close |
| `onTokenAdded` | `(siteId: string) => void` | Yes | Called when token successfully added |
| `existingSites` | `string[]` | Yes | Array of existing site IDs to prevent duplicates |

## Component Structure

### Sections

1. **Site Information**
   - Site Name (optional): Friendly display name
   - Site ID (required): Unique identifier (lowercase, alphanumeric with underscores)

2. **Authentication Token**
   - JWT Token input (multiline, password by default)
   - Show/hide toggle
   - Real-time validation with visual feedback

3. **Validation Display**
   - Issued date
   - Expiration date
   - Days until expiry
   - Status indicator (Active/Warning/Urgent/Expired)

4. **Actions**
   - Test Token: Optional API verification
   - Cancel: Close without saving
   - Add Token: Save token (disabled until valid)

## Validation Rules

### Site ID Validation
- **Required**: Cannot be empty
- **Format**: Must be lowercase alphanumeric with underscores only
- **Unique**: Cannot match existing site IDs
- **Pattern**: `/^[a-z0-9_]+$/`

### Token Validation
- **Format**: Must have 3 parts separated by dots (JWT format)
- **Base64**: Each part must be valid base64 encoding
- **Expiration**: Must not be expired
- **Minimum Length**: At least 10 characters

### Token Status Levels

| Status | Days Remaining | Color | Icon |
|--------|---------------|-------|------|
| Active | > 7 days | Green | ✓ CheckCircle |
| Warning | 1-7 days | Yellow | ⚠ Warning |
| Urgent | < 1 day | Orange | ⚠ Warning |
| Expired | ≤ 0 days | Red | ✗ Error |

## User Flow

```
1. User clicks "Add Token for New Site"
   ↓
2. Dialog opens with empty form
   ↓
3. User enters Site Name (optional) and Site ID
   ↓
4. User pastes JWT token
   ↓
5. Component validates token in real-time
   - Shows loading spinner during validation
   - Displays ✓ for valid, ✗ for invalid
   - Shows expiration info if valid
   ↓
6. User optionally tests token with API
   - Shows loading state
   - Displays success/error result
   ↓
7. User clicks "Add Token"
   - Validates all fields
   - Checks for duplicates
   - Saves to storage
   - Calls onTokenAdded callback
   - Closes dialog
```

## Token Validation Details

### JWT Structure Validation

The component validates that tokens follow the standard JWT format:

```
header.payload.signature
```

Each part must be:
- Valid base64 encoding
- Properly formatted JSON (for header and payload)

### Expiration Calculation

```typescript
// Extract expiration from payload
const payload = JSON.parse(atob(token.split('.')[1]));
const expiresAt = new Date(payload.exp * 1000);

// Calculate days remaining
const msUntilExpiry = expiresAt.getTime() - Date.now();
const daysUntilExpiry = Math.floor(msUntilExpiry / (24 * 60 * 60 * 1000));
```

### Warning Thresholds

```typescript
if (daysUntilExpiry <= 0) {
  status = 'expired';  // Red alert
} else if (daysUntilExpiry <= 1) {
  status = 'urgent';   // Orange warning
} else if (daysUntilExpiry <= 7) {
  status = 'warning';  // Yellow caution
} else {
  status = 'active';   // Green all clear
}
```

## Error Handling

The component handles various error scenarios:

### User Input Errors
- Empty site ID: "Site ID is required"
- Duplicate site ID: "A token for site 'xxx' already exists"
- Invalid site ID format: "Site ID must be lowercase alphanumeric with underscores only"
- Invalid token: "Token is invalid or expired"

### Token Validation Errors
- Wrong format: "Invalid JWT format. Token must have 3 parts separated by dots."
- Decode failure: "Failed to decode token. Ensure it is a valid base64-encoded JWT."
- Expired: "Token has expired"

### API Test Errors
- Network failure: "Test failed"
- Invalid response: "Token verification failed. Please check the token and try again."

## Accessibility

The component follows WCAG 2.1 AA standards:

- **Keyboard Navigation**: Full support for tab, enter, escape keys
- **Screen Readers**: Proper ARIA labels and roles
- **Focus Management**: Logical focus order
- **Color Contrast**: Meets 4.5:1 ratio for text
- **Error Messages**: Associated with input fields
- **Loading States**: Announced to screen readers

## Mobile Responsiveness

The component adapts to different screen sizes:

### Mobile (< 600px)
- Full-screen dialog
- Stacked form layout
- Large touch targets (min 44px)
- Full-width buttons

### Tablet (600px - 960px)
- Standard dialog (maxWidth="md")
- Responsive padding
- Optimized button sizes

### Desktop (> 960px)
- Standard dialog
- Multi-column layout where appropriate
- Hover states and tooltips

## Performance Considerations

### Debounced Validation
Token validation is debounced by 300ms to avoid excessive processing:

```typescript
useEffect(() => {
  const validateTokenAsync = async () => {
    // Small delay to debounce
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = validateToken(token);
    setValidation(result);
  };
  validateTokenAsync();
}, [token]);
```

### Optimized Re-renders
- State updates are batched
- Validation runs only when token changes
- No unnecessary re-renders on dialog open/close

## Testing

Comprehensive test suite covers:

- ✅ Component rendering
- ✅ Form input and validation
- ✅ Real-time token validation
- ✅ Duplicate site prevention
- ✅ Token expiration display
- ✅ API testing
- ✅ Save functionality
- ✅ Error handling
- ✅ Mobile responsiveness

Run tests:
```bash
npm test -- AddTokenDialog.test.tsx
```

## Integration Examples

### Example 1: Basic Settings Page

```tsx
export const SettingsPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sites, setSites] = useState<string[]>([]);

  return (
    <Paper>
      <Button onClick={() => setDialogOpen(true)}>
        Add Token
      </Button>

      <AddTokenDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onTokenAdded={(siteId) => setSites([...sites, siteId])}
        existingSites={sites}
      />
    </Paper>
  );
};
```

### Example 2: With Site List

```tsx
export const TokenManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tokens, setTokens] = useState<SiteToken[]>([]);

  const handleTokenAdded = (siteId: string) => {
    // Reload tokens from storage
    const data = localStorage.getItem(`token_${siteId}`);
    if (data) {
      setTokens([...tokens, JSON.parse(data)]);
    }
  };

  return (
    <Box>
      <List>
        {tokens.map(token => (
          <ListItem key={token.siteId}>
            <ListItemText
              primary={token.siteName}
              secondary={token.siteId}
            />
          </ListItem>
        ))}
      </List>

      <AddTokenDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onTokenAdded={handleTokenAdded}
        existingSites={tokens.map(t => t.siteId)}
      />
    </Box>
  );
};
```

### Example 3: With Custom Hook

```tsx
const useTokenDialog = () => {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<string[]>([]);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleAdded = (siteId: string) => {
    setSites([...sites, siteId]);
  };

  return { open, sites, handleOpen, handleClose, handleAdded };
};

export const App = () => {
  const dialog = useTokenDialog();

  return (
    <>
      <Button onClick={dialog.handleOpen}>Add Token</Button>
      <AddTokenDialog
        open={dialog.open}
        onClose={dialog.handleClose}
        onTokenAdded={dialog.handleAdded}
        existingSites={dialog.sites}
      />
    </>
  );
};
```

## Styling

The component uses Material-UI's theming system:

```tsx
// Custom theme colors
const theme = createTheme({
  palette: {
    success: { main: '#4caf50' },  // Valid tokens
    warning: { main: '#ff9800' },  // Expiring soon
    error: { main: '#f44336' },    // Invalid/expired
  },
});
```

### Customization

You can customize the dialog appearance:

```tsx
<AddTokenDialog
  // ... props
  PaperProps={{
    sx: {
      borderRadius: 2,
      boxShadow: 3,
    }
  }}
/>
```

## Best Practices

1. **Always Provide Existing Sites**: Pass accurate list to prevent duplicates
2. **Handle Callbacks**: Implement onTokenAdded to update app state
3. **Reset on Close**: Component handles form reset automatically
4. **Error Handling**: Display user-friendly error messages
5. **Loading States**: Show feedback during async operations
6. **Accessibility**: Test with keyboard and screen readers
7. **Mobile Testing**: Verify on actual mobile devices

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- React 18+
- Material-UI 5+
- TypeScript 4.5+

## Future Enhancements

Potential improvements:

- [ ] Token encryption before storage
- [ ] Batch token import from CSV
- [ ] Token rotation scheduling
- [ ] Usage analytics per token
- [ ] Token permissions management
- [ ] Multi-language support
- [ ] Dark mode optimization
- [ ] Offline support with service workers

## Troubleshooting

### Issue: Token validation fails for valid JWT

**Solution**: Check that token has exactly 3 parts separated by dots. Some tokens may have extra padding or newlines that need trimming.

### Issue: Duplicate site error when site doesn't exist

**Solution**: Ensure `existingSites` prop is up-to-date. Check localStorage for stale entries.

### Issue: Dialog doesn't close after saving

**Solution**: Verify `onClose` callback is properly connected. Component calls it automatically after successful save.

### Issue: Mobile dialog cuts off content

**Solution**: Component uses `fullScreen` prop on mobile automatically. Ensure parent container allows full height.

## Related Components

- `TokenExpiryWarning`: Banner for expiring tokens
- `TokenStatusBadge`: Status indicator chip
- `SiteSelector`: Dropdown with token status icons

## License

MIT License - Building Vitals Application

## Support

For issues or questions:
- GitHub Issues: [link]
- Documentation: [link]
- Email: support@buildingvitals.com

---

**Last Updated**: 2025-01-31
**Version**: 1.0.0
**Component**: AddTokenDialog
