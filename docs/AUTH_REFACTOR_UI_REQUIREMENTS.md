# Authentication Refactor - UI/UX Requirements
## Token Entry and Management Interface Specifications

**Project:** Building Vitals Application
**Version:** 1.0
**Date:** 2025-01-31

---

## 🎯 Core Requirement

**Users MUST be able to enter tokens through the UI/UX** - not just have them hardcoded. The system should support:

1. **Default tokens** (hardcoded) for zero-friction onboarding
2. **User-entered tokens** through Settings page interface
3. **Multi-site token management** UI for advanced users

---

## 📍 Current Token Entry UI (Settings Page)

### Existing Implementation

**File:** `src/pages/Settings.tsx` (lines 403-496)

The Settings page already has a token input interface:

```tsx
<TextField
  fullWidth
  label="ACE IoT API Token"
  placeholder="Enter your JWT token here"
  type="password"
  value={tokenInput}
  onChange={(e) => handleTokenInputChange(e.target.value)}
  error={!!tokenError}
  helperText={tokenError || 'JWT token format: xxx.yyy.zzz'}
/>

<Button onClick={handleTestToken}>Test Token</Button>
<Button onClick={handleSaveToken}>Save Token</Button>
```

**Current Features:**
- ✅ Password field for token entry
- ✅ Real-time validation
- ✅ "Test Token" button (live API verification)
- ✅ "Save Token" button
- ✅ Success/error feedback via Snackbar
- ✅ Mobile-responsive design
- ✅ Clear button to reset input

**Current Limitations:**
- ❌ Only supports single token (no multi-site)
- ❌ No visual indicator of token status
- ❌ No expiration warnings
- ❌ No way to manage multiple sites

---

## 🔄 Enhanced Token Entry UI (Proposed)

### 1. Settings Page Enhancement

**Location:** `src/pages/Settings.tsx`

#### 1.1 Current Token Section (Single Site)

Keep existing UI for primary site token, enhance with:

```tsx
<Paper sx={{ p: 3, mb: 3 }}>
  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
    <Typography variant="h6" sx={{ flexGrow: 1 }}>
      Primary Site Token
    </Typography>
    {/* NEW: Token status indicator */}
    <TokenStatusBadge status="active" daysRemaining={45} />
  </Box>

  {/* Existing token input field */}
  <TextField
    fullWidth
    label="ACE IoT API Token"
    placeholder="Enter your JWT token here"
    type={showToken ? 'text' : 'password'}  // NEW: toggle visibility
    value={tokenInput}
    onChange={(e) => handleTokenInputChange(e.target.value)}
    InputProps={{
      endAdornment: (
        <InputAdornment position="end">
          {/* NEW: Show/hide toggle */}
          <IconButton onClick={() => setShowToken(!showToken)}>
            {showToken ? <VisibilityOff /> : <Visibility />}
          </IconButton>
          {/* NEW: Validation indicator */}
          {isValidating && <CircularProgress size={20} />}
          {validation?.valid && <CheckCircle color="success" />}
          {validation && !validation.valid && <Error color="error" />}
        </InputAdornment>
      ),
    }}
  />

  {/* NEW: Show token expiration after validation */}
  {validation?.valid && validation.expiresAt && (
    <Alert severity={validation.shouldWarn ? 'warning' : 'info'} sx={{ mt: 2 }}>
      Token expires: {formatDate(validation.expiresAt)}
      ({validation.daysUntilExpiry} days remaining)
    </Alert>
  )}

  {/* Existing Test/Save buttons */}
  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
    <Button variant="outlined" onClick={handleTestToken}>
      Test Token
    </Button>
    <Button variant="contained" onClick={handleSaveToken}>
      Save Token
    </Button>
  </Box>
</Paper>
```

**Key Enhancements:**
1. **Show/hide toggle** - Users can verify they pasted correctly
2. **Real-time validation indicator** - ✓/✗ icon as they type
3. **Token expiration display** - Shows expiry date and days remaining
4. **Status badge** - Visual indicator (green/yellow/red)

---

#### 1.2 Multi-Site Token Management Section (New)

**Add below the primary token section:**

```tsx
<Paper sx={{ p: 3, mb: 3 }}>
  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
    <Typography variant="h6" sx={{ flexGrow: 1 }}>
      Multi-Site Token Management
    </Typography>
    <Tooltip title="Add token for additional site">
      <IconButton size="small">
        <HelpOutline />
      </IconButton>
    </Tooltip>
  </Box>

  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
    Manage tokens for multiple buildings or sites. Each site can have its own token.
  </Typography>

  {/* Button to open Add Token dialog */}
  <Button
    variant="outlined"
    startIcon={<Add />}
    onClick={() => setAddTokenDialogOpen(true)}
    sx={{ mb: 2 }}
  >
    Add Token for New Site
  </Button>

  {/* List of configured sites */}
  {siteTokens.length > 0 && (
    <List>
      {siteTokens.map((siteToken) => (
        <ListItem
          key={siteToken.siteId}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            mb: 1,
          }}
        >
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1">
                  {siteToken.siteName}
                </Typography>
                {siteToken.isDefault && (
                  <Chip label="Default" size="small" color="primary" />
                )}
              </Box>
            }
            secondary={
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Site ID: {siteToken.siteId}
                </Typography>
                <TokenStatusBadge
                  status={getTokenStatus(siteToken)}
                  daysRemaining={getDaysRemaining(siteToken)}
                  size="small"
                />
              </Box>
            }
          />
          <ListItemSecondaryAction>
            <Tooltip title="Refresh token">
              <IconButton onClick={() => handleRefreshToken(siteToken.siteId)}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove token">
              <IconButton
                onClick={() => handleRemoveToken(siteToken.siteId)}
                disabled={siteToken.isDefault}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </ListItemSecondaryAction>
        </ListItem>
      ))}
    </List>
  )}

  {/* Empty state */}
  {siteTokens.length === 0 && (
    <Alert severity="info">
      No additional sites configured. Click "Add Token for New Site" to add one.
    </Alert>
  )}
</Paper>

{/* Add Token Dialog */}
<AddTokenDialog
  open={addTokenDialogOpen}
  onClose={() => setAddTokenDialogOpen(false)}
  onSuccess={handleTokenAdded}
/>
```

**Features:**
- **"Add Token" button** prominently displayed
- **List of all configured sites** with status indicators
- **Actions for each site**: Refresh, Remove
- **Default site indicator** (can't be removed)
- **Empty state** with helpful message

---

### 2. Add Token Dialog Component

**New File:** `src/components/settings/AddTokenDialog.tsx`

```tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box,
  InputAdornment,
  IconButton,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle, Error } from '@mui/icons-material';

interface AddTokenDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (siteId: string) => void;
}

export const AddTokenDialog: React.FC<AddTokenDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [siteName, setSiteName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTokenChange = async (value: string) => {
    setToken(value);
    setError(null);
    setTestResult(null);

    if (value.length < 10) {
      setValidation(null);
      return;
    }

    setIsValidating(true);
    try {
      const result = await TokenValidator.validate(value);
      setValidation(result);
    } catch (err) {
      setValidation({ valid: false, errors: ['Invalid token format'] });
    } finally {
      setIsValidating(false);
    }
  };

  const handleTestToken = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const isValid = await TokenValidator.testWithAPI(token);
      setTestResult(isValid ? 'success' : 'error');
    } catch (err) {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!siteName || !siteId || !token) {
      setError('All fields are required');
      return;
    }

    if (!validation?.valid) {
      setError('Token is invalid');
      return;
    }

    try {
      await multiTokenManager.addToken(siteId, token);
      onSuccess(siteId);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save token');
    }
  };

  const handleClose = () => {
    setSiteName('');
    setSiteId('');
    setToken('');
    setShowToken(false);
    setValidation(null);
    setError(null);
    setTestResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Token for New Site</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Site Name"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="e.g., Falls City Hospital"
          sx={{ mt: 2, mb: 2 }}
        />

        <TextField
          fullWidth
          label="Site ID"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          placeholder="e.g., ses_falls_city"
          helperText="Unique identifier for this site (lowercase, no spaces)"
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="ACE IoT API Token"
          type={showToken ? 'text' : 'password'}
          value={token}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          helperText="JWT token for this site"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {isValidating && <CircularProgress size={20} />}
                {!isValidating && validation?.valid && (
                  <CheckCircle color="success" />
                )}
                {!isValidating && validation && !validation.valid && (
                  <Error color="error" />
                )}
                <IconButton onClick={() => setShowToken(!showToken)} edge="end">
                  {showToken ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {validation?.valid && validation.expiresAt && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Token expires: {new Date(validation.expiresAt).toLocaleDateString()}
              {validation.daysUntilExpiry !== null && (
                <> ({validation.daysUntilExpiry} days remaining)</>
              )}
            </Typography>
          </Alert>
        )}

        {validation && !validation.valid && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {validation.errors.join(', ')}
            </Typography>
          </Alert>
        )}

        {testResult === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Token successfully verified with API!
          </Alert>
        )}

        {testResult === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Token verification failed. Please check the token.
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            onClick={handleTestToken}
            disabled={!validation?.valid || isTesting}
            startIcon={isTesting && <CircularProgress size={16} />}
          >
            Test Token with API
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!validation?.valid || !siteName || !siteId}
        >
          Save Token
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

**Key Features:**
1. **Three input fields**: Site Name, Site ID, Token
2. **Real-time validation**: Shows ✓/✗ as user types token
3. **Show/hide toggle**: Users can verify token is correct
4. **Token expiration display**: Shows when token will expire
5. **Test Token button**: Makes live API call to verify
6. **Success/Error feedback**: Clear messaging
7. **Mobile-responsive**: Works on all screen sizes

---

### 3. Token Status Badge Component

**New File:** `src/components/settings/TokenStatusBadge.tsx`

```tsx
import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';

interface TokenStatusBadgeProps {
  status: 'active' | 'warning' | 'urgent' | 'expired';
  daysRemaining: number | null;
  size?: 'small' | 'medium';
}

export const TokenStatusBadge: React.FC<TokenStatusBadgeProps> = ({
  status,
  daysRemaining,
  size = 'medium',
}) => {
  const getConfig = () => {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          color: 'success' as const,
          icon: <CheckCircle />,
          tooltip: `Token active (${daysRemaining} days remaining)`,
        };
      case 'warning':
        return {
          label: `Expires in ${daysRemaining}d`,
          color: 'warning' as const,
          icon: <Warning />,
          tooltip: `Token expires soon (${daysRemaining} days remaining)`,
        };
      case 'urgent':
        return {
          label: `Expires in ${daysRemaining}d`,
          color: 'error' as const,
          icon: <Warning />,
          tooltip: `Token expires very soon (${daysRemaining} days remaining)`,
        };
      case 'expired':
        return {
          label: 'Expired',
          color: 'error' as const,
          icon: <ErrorIcon />,
          tooltip: 'Token has expired and needs to be replaced',
        };
    }
  };

  const config = getConfig();

  return (
    <Tooltip title={config.tooltip}>
      <Chip
        label={config.label}
        color={config.color}
        icon={config.icon}
        size={size}
        sx={{ fontWeight: 600 }}
      />
    </Tooltip>
  );
};
```

**Visual Indicators:**
- 🟢 **Active** (green): > 7 days remaining
- 🟡 **Warning** (yellow): 1-7 days remaining
- 🟠 **Urgent** (orange): < 1 day remaining
- 🔴 **Expired** (red): Already expired

---

### 4. Token Expiry Warning Banner

**New File:** `src/components/common/TokenExpiryWarning.tsx`

```tsx
import React from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { Warning as WarningIcon, Error as ErrorIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface TokenExpiryWarningProps {
  daysRemaining: number;
  siteName: string;
  siteId: string;
  onRefresh: () => void;
  onDismiss?: () => void;
}

export const TokenExpiryWarning: React.FC<TokenExpiryWarningProps> = ({
  daysRemaining,
  siteName,
  siteId,
  onRefresh,
  onDismiss,
}) => {
  const navigate = useNavigate();

  const getSeverity = () => {
    if (daysRemaining <= 0) return 'error';
    if (daysRemaining <= 1) return 'error';
    if (daysRemaining <= 3) return 'warning';
    return 'info';
  };

  const getIcon = () => {
    if (daysRemaining <= 1) return <ErrorIcon />;
    return <WarningIcon />;
  };

  const getMessage = () => {
    if (daysRemaining <= 0) {
      return `Token for ${siteName} has expired!`;
    }
    if (daysRemaining === 1) {
      return `Token for ${siteName} expires in 1 day!`;
    }
    return `Token for ${siteName} expires in ${daysRemaining} days`;
  };

  const isDismissible = daysRemaining > 1;

  return (
    <Alert
      severity={getSeverity()}
      icon={getIcon()}
      sx={{
        mb: 2,
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        boxShadow: 2,
      }}
      action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button color="inherit" size="small" onClick={onRefresh}>
            Refresh Token
          </Button>
          {isDismissible && onDismiss && (
            <Button color="inherit" size="small" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </Box>
      }
    >
      <AlertTitle>{getMessage()}</AlertTitle>
      {daysRemaining <= 0
        ? 'Your token has expired and needs to be replaced immediately to continue accessing data.'
        : 'Please refresh your token before it expires to avoid service interruption.'}
    </Alert>
  );
};
```

**Usage in Dashboard:**
```tsx
// In DashboardContainer.tsx or App.tsx
{expiringTokens.map((token) => (
  <TokenExpiryWarning
    key={token.siteId}
    daysRemaining={token.daysRemaining}
    siteName={token.siteName}
    siteId={token.siteId}
    onRefresh={() => handleRefreshToken(token.siteId)}
    onDismiss={() => handleDismissWarning(token.siteId)}
  />
))}
```

---

### 5. Site Selector Enhancement

**File:** `src/components/common/SiteSelector.tsx` (update)

Add token status indicators to site dropdown:

```tsx
<MenuItem value={site.id}>
  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
    <Typography sx={{ flexGrow: 1 }}>
      {site.name}
    </Typography>

    {/* Token status indicator */}
    {getTokenStatus(site.id) === 'active' && (
      <CheckCircle color="success" fontSize="small" />
    )}
    {getTokenStatus(site.id) === 'warning' && (
      <Warning color="warning" fontSize="small" />
    )}
    {getTokenStatus(site.id) === 'expired' && (
      <ErrorIcon color="error" fontSize="small" />
    )}
    {!hasToken(site.id) && (
      <Chip
        label="Add Token"
        size="small"
        color="primary"
        variant="outlined"
        onClick={(e) => {
          e.stopPropagation();
          handleAddToken(site.id);
        }}
      />
    )}
  </Box>
</MenuItem>
```

---

## 📱 Mobile Responsiveness

All components must be mobile-friendly:

1. **Settings Page**
   - Stack input fields vertically on mobile
   - Full-width buttons on mobile
   - Sticky save button at bottom (already implemented)

2. **Add Token Dialog**
   - Full-screen dialog on mobile (`fullScreen={isMobile}`)
   - Large tap targets (min 44px height)
   - Proper keyboard handling

3. **Token List**
   - Cards instead of list items on mobile
   - Actions in overflow menu on mobile
   - Swipe-to-delete gesture (optional)

4. **Warning Banner**
   - Sticky at top of page
   - Dismissible on mobile
   - Compact action buttons

---

## 🔐 Security Considerations

1. **Password Field by Default**
   - Token input uses `type="password"` by default
   - Show/hide toggle allows verification
   - Auto-hide after 30 seconds of inactivity

2. **Validation Before Save**
   - JWT format validation
   - Expiration check
   - Optional API test before save

3. **No Plain Text Display**
   - Tokens always masked in lists
   - Only show last 4 characters (e.g., "****...abc1")
   - Full token only visible during entry/edit

4. **Secure Storage**
   - All tokens encrypted before storage
   - Device-specific encryption keys
   - No tokens in localStorage plain text

---

## ✅ Implementation Checklist

### Phase 3: UI/UX Enhancement

- [ ] **Task 3.1**: Enhance existing Settings token input
  - [ ] Add show/hide toggle
  - [ ] Add real-time validation indicator
  - [ ] Show token expiration after validation
  - [ ] Add TokenStatusBadge component

- [ ] **Task 3.2**: Add Multi-Site Token Management section
  - [ ] "Add Token" button
  - [ ] List of configured sites
  - [ ] Status indicators for each site
  - [ ] Refresh/Remove actions

- [ ] **Task 3.3**: Create AddTokenDialog component
  - [ ] Site Name input
  - [ ] Site ID input
  - [ ] Token input with validation
  - [ ] Test Token button
  - [ ] Save/Cancel actions

- [ ] **Task 3.4**: Create TokenStatusBadge component
  - [ ] Active status (green)
  - [ ] Warning status (yellow)
  - [ ] Urgent status (orange)
  - [ ] Expired status (red)

- [ ] **Task 3.5**: Create TokenExpiryWarning component
  - [ ] Sticky banner at top
  - [ ] Different severity levels
  - [ ] Refresh Token action
  - [ ] Dismiss action (conditional)

- [ ] **Task 3.6**: Enhance SiteSelector component
  - [ ] Show token status icons
  - [ ] "Add Token" chip for sites without tokens
  - [ ] Disable sites without valid tokens

- [ ] **Task 3.7**: Mobile responsiveness
  - [ ] Test all components on mobile
  - [ ] Ensure proper touch targets
  - [ ] Test sticky elements

- [ ] **Task 3.8**: Integration testing
  - [ ] Test add token flow
  - [ ] Test remove token flow
  - [ ] Test refresh token flow
  - [ ] Test expiry warnings

---

## 🎨 UI/UX Mockups

### Settings Page Layout

```
┌───────────────────────────────────────────────────┐
│ Settings                                          │
├───────────────────────────────────────────────────┤
│                                                   │
│ ┌─────────────────────────────────────────────┐  │
│ │ Primary Site Token              [Active ✓]  │  │
│ ├─────────────────────────────────────────────┤  │
│ │ ACE IoT API Token                           │  │
│ │ [●●●●●●●●●●●●●●●●●] [👁] [✓]                │  │
│ │                                              │  │
│ │ ℹ Token expires: 2025-03-15 (45 days)       │  │
│ │                                              │  │
│ │ [Test Token]  [Save Token]                  │  │
│ └─────────────────────────────────────────────┘  │
│                                                   │
│ ┌─────────────────────────────────────────────┐  │
│ │ Multi-Site Token Management                 │  │
│ ├─────────────────────────────────────────────┤  │
│ │ [+ Add Token for New Site]                  │  │
│ │                                              │  │
│ │ ┌───────────────────────────────────────┐   │  │
│ │ │ ✓ Falls City Hospital  [Default]      │   │  │
│ │ │   Site ID: ses_falls_city             │   │  │
│ │ │   [Active - 45 days] [🔄] [🗑]        │   │  │
│ │ └───────────────────────────────────────┘   │  │
│ │                                              │  │
│ │ ┌───────────────────────────────────────┐   │  │
│ │ │ ✓ Site 2                              │   │  │
│ │ │   Site ID: site_2                     │   │  │
│ │ │   [Warning - 5 days] [🔄] [🗑]        │   │  │
│ │ └───────────────────────────────────────┘   │  │
│ └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### Add Token Dialog

```
┌─────────────────────────────────────┐
│ Add Token for New Site         [✕] │
├─────────────────────────────────────┤
│                                     │
│ Site Name *                         │
│ [Falls City Hospital        ]       │
│                                     │
│ Site ID *                           │
│ [ses_falls_city             ]       │
│ Unique identifier (lowercase)       │
│                                     │
│ ACE IoT API Token *                 │
│ [●●●●●●●●●●●●●] [👁] [✓]            │
│ JWT token format: xxx.yyy.zzz       │
│                                     │
│ ℹ Token expires: 2025-03-15         │
│   (45 days remaining)               │
│                                     │
│                 [Test Token] ←      │
│                                     │
│ ✓ Token successfully verified!      │
│                                     │
├─────────────────────────────────────┤
│           [Cancel]  [Save Token]    │
└─────────────────────────────────────┘
```

### Warning Banner (Dashboard)

```
┌───────────────────────────────────────────────────┐
│ ⚠ Token for Falls City expires in 5 days         │
│ Please refresh your token before it expires       │
│                    [Refresh Token]  [Dismiss]     │
└───────────────────────────────────────────────────┘
```

---

## 📚 Summary

**Key UI/UX Points:**

1. ✅ **Settings page already has token input** - just needs enhancement
2. ✅ **Users CAN enter tokens through UI** - not just hardcoded
3. ✅ **Multi-site support** requires new UI components
4. ✅ **Visual feedback** throughout (status badges, warnings)
5. ✅ **Mobile-responsive** design for all components
6. ✅ **Security-first** approach (password fields, validation)

**What Users Can Do:**

1. **Enter primary site token** via existing Settings page input
2. **Add tokens for additional sites** via "Add Token" button
3. **See token status** via color-coded badges
4. **Refresh expiring tokens** via dedicated action
5. **Remove site tokens** via delete action
6. **Test tokens** before saving via "Test Token" button
7. **Receive warnings** via banner when tokens expire soon

The refactored system maintains the existing UI for entering tokens while adding powerful multi-site management capabilities on top.

---

**Document Status:** ✅ Complete
**Next Steps:** Begin Phase 3 implementation (UI/UX Enhancement)
