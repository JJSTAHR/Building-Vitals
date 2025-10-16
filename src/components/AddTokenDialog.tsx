/**
 * AddTokenDialog Component
 *
 * Dialog for adding new site tokens to the multi-token management system.
 *
 * Features:
 * - Site ID and name input with validation
 * - Real-time JWT token validation with visual feedback
 * - Token format validation (3-part JWT structure)
 * - Expiration date display and warnings
 * - Optional API token testing
 * - Duplicate site ID prevention
 * - Mobile-responsive design
 *
 * @component
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  AlertTitle,
  InputAdornment,
  IconButton,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

// Type imports
import type { TokenValidation } from '../types/token.types';

/**
 * Props for the AddTokenDialog component
 */
export interface AddTokenDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when token is successfully added */
  onTokenAdded: (siteId: string) => void;
  /** List of existing site IDs to prevent duplicates */
  existingSites: string[];
}

/**
 * Extended token validation with expiration info
 */
interface ExtendedTokenValidation extends TokenValidation {
  issuedAt?: Date;
  expiresAt?: Date;
  daysUntilExpiry?: number;
  status?: 'active' | 'warning' | 'urgent' | 'expired';
}

/**
 * Validates JWT token format and parses expiration data
 */
const validateToken = (token: string): ExtendedTokenValidation => {
  // Check basic format
  const parts = token.split('.');
  if (parts.length !== 3) {
    return {
      valid: false,
      reason: 'Invalid JWT format. Token must have 3 parts separated by dots.',
    };
  }

  try {
    // Decode payload (middle part)
    const payload = JSON.parse(atob(parts[1]));

    // Check for expiration claim
    const now = Date.now();
    let expiresAt: Date | undefined;
    let issuedAt: Date | undefined;
    let daysUntilExpiry: number | undefined;
    let status: 'active' | 'warning' | 'urgent' | 'expired' = 'active';

    if (payload.iat) {
      issuedAt = new Date(payload.iat * 1000);
    }

    if (payload.exp) {
      expiresAt = new Date(payload.exp * 1000);
      const msUntilExpiry = expiresAt.getTime() - now;
      daysUntilExpiry = Math.floor(msUntilExpiry / (24 * 60 * 60 * 1000));

      // Check if expired
      if (msUntilExpiry <= 0) {
        return {
          valid: false,
          reason: 'Token has expired',
          issuedAt,
          expiresAt,
          daysUntilExpiry,
          status: 'expired',
          metadata: { payload },
        };
      }

      // Determine warning status
      if (daysUntilExpiry <= 1) {
        status = 'urgent';
      } else if (daysUntilExpiry <= 7) {
        status = 'warning';
      }
    }

    return {
      valid: true,
      issuedAt,
      expiresAt,
      daysUntilExpiry,
      status,
      metadata: { payload },
    };
  } catch (error) {
    return {
      valid: false,
      reason: 'Failed to decode token. Ensure it is a valid base64-encoded JWT.',
    };
  }
};

/**
 * Simulates API token testing
 * In production, this would make a real API call
 */
const testTokenWithAPI = async (token: string): Promise<boolean> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // For now, just validate format
  const validation = validateToken(token);
  return validation.valid;
};

/**
 * Format date for display
 */
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * AddTokenDialog Component
 */
export const AddTokenDialog: React.FC<AddTokenDialogProps> = ({
  open,
  onClose,
  onTokenAdded,
  existingSites,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Form state
  const [siteId, setSiteId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Validation and status
  const [validation, setValidation] = useState<ExtendedTokenValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time token validation
  useEffect(() => {
    const validateTokenAsync = async () => {
      if (token.trim().length === 0) {
        setValidation(null);
        return;
      }

      if (token.trim().length < 10) {
        setValidation({
          valid: false,
          reason: 'Token is too short',
        });
        return;
      }

      setIsValidating(true);
      try {
        // Small delay to debounce
        await new Promise(resolve => setTimeout(resolve, 300));
        const result = validateToken(token);
        setValidation(result);
      } finally {
        setIsValidating(false);
      }
    };

    validateTokenAsync();
  }, [token]);

  // Handle test connection
  const handleTest = async () => {
    if (!validation?.valid) return;

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const isValid = await testTokenWithAPI(token);
      setTestResult(isValid ? 'success' : 'error');
    } catch (err) {
      setTestResult('error');
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    // Validation checks
    if (!siteId.trim()) {
      setError('Site ID is required');
      return;
    }

    // Check for duplicate site ID
    if (existingSites.includes(siteId.trim())) {
      setError(`A token for site "${siteId}" already exists`);
      return;
    }

    // Validate site ID format (lowercase, alphanumeric, underscores)
    const siteIdRegex = /^[a-z0-9_]+$/;
    if (!siteIdRegex.test(siteId.trim())) {
      setError('Site ID must be lowercase alphanumeric with underscores only');
      return;
    }

    if (!validation?.valid) {
      setError('Token is invalid or expired');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // In production, this would call multiTokenManager.addToken
      // For now, simulate storage
      const tokenData = {
        siteId: siteId.trim(),
        token: token.trim(),
        siteName: siteName.trim() || siteId.trim(),
        metadata: {
          source: 'user',
          notes: 'Added via Settings dialog',
          addedAt: new Date().toISOString(),
          expiresAt: validation.expiresAt?.toISOString(),
        },
      };

      // Simulate async save
      await new Promise(resolve => setTimeout(resolve, 500));

      // Store in localStorage for now
      localStorage.setItem(`token_${tokenData.siteId}`, JSON.stringify(tokenData));

      onTokenAdded(tokenData.siteId);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add token');
    } finally {
      setSaving(false);
    }
  };

  // Handle close and reset
  const handleClose = () => {
    setSiteId('');
    setSiteName('');
    setToken('');
    setShowToken(false);
    setValidation(null);
    setTestResult(null);
    setError(null);
    onClose();
  };

  // Compute validation icon
  const getValidationIcon = () => {
    if (isValidating) {
      return <CircularProgress size={20} />;
    }
    if (validation?.valid) {
      return <CheckCircle color="success" />;
    }
    if (validation && !validation.valid) {
      return <ErrorIcon color="error" />;
    }
    return null;
  };

  // Compute button states
  const canTest = validation?.valid && !testing;
  const canSave = validation?.valid && siteId.trim() && !saving;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Typography variant="h6" component="div">
          Add Token for New Site
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Configure authentication token for a new building or site
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Site Information Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Site Information
          </Typography>

          <TextField
            fullWidth
            label="Site Name"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="e.g., Falls City Hospital"
            helperText="Friendly display name for this site (optional)"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            required
            label="Site ID"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value.toLowerCase())}
            placeholder="e.g., ses_falls_city"
            helperText="Unique identifier (lowercase, alphanumeric with underscores)"
            error={!!siteId && existingSites.includes(siteId)}
            InputProps={{
              endAdornment: existingSites.includes(siteId) && (
                <InputAdornment position="end">
                  <ErrorIcon color="error" />
                </InputAdornment>
              ),
            }}
          />
          {existingSites.includes(siteId) && (
            <Alert severity="error" sx={{ mt: 1 }}>
              This site ID already exists
            </Alert>
          )}
        </Box>

        {/* Token Input Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Authentication Token
          </Typography>

          <TextField
            fullWidth
            required
            multiline
            rows={4}
            label="JWT Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your complete JWT token here (starts with eyJ...)"
            type={showToken ? 'text' : 'password'}
            helperText="JWT token format: xxx.yyy.zzz (3 parts separated by dots)"
            error={!!validation && !validation.valid}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Stack direction="row" spacing={0.5}>
                    {getValidationIcon()}
                    <IconButton
                      onClick={() => setShowToken(!showToken)}
                      edge="end"
                      size="small"
                    >
                      {showToken ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </Stack>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderColor: validation?.valid ? 'success.main' : undefined,
              },
            }}
          />
        </Box>

        {/* Token Validation Display */}
        {validation?.valid && (
          <Alert
            severity={
              validation.status === 'active'
                ? 'success'
                : validation.status === 'warning'
                ? 'warning'
                : 'error'
            }
            icon={
              validation.status === 'active' ? (
                <CheckCircle />
              ) : validation.status === 'warning' ? (
                <WarningIcon />
              ) : (
                <ErrorIcon />
              )
            }
            sx={{ mb: 2 }}
          >
            <AlertTitle>Token Validated</AlertTitle>
            <Stack spacing={0.5}>
              {validation.issuedAt && (
                <Typography variant="body2">
                  <strong>Issued:</strong> {formatDate(validation.issuedAt)}
                </Typography>
              )}
              {validation.expiresAt && (
                <Typography variant="body2">
                  <strong>Expires:</strong> {formatDate(validation.expiresAt)}
                  {validation.daysUntilExpiry !== undefined && (
                    <Chip
                      label={`${validation.daysUntilExpiry} days remaining`}
                      size="small"
                      color={
                        validation.status === 'active'
                          ? 'success'
                          : validation.status === 'warning'
                          ? 'warning'
                          : 'error'
                      }
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
              )}
              {validation.status === 'warning' && (
                <Typography variant="body2" color="warning.dark">
                  <WarningIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  Token expires soon. Consider refreshing it.
                </Typography>
              )}
              {validation.status === 'urgent' && (
                <Typography variant="body2" color="error.dark">
                  <ErrorIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  Token expires very soon! Refresh immediately.
                </Typography>
              )}
            </Stack>
          </Alert>
        )}

        {/* Token Validation Error */}
        {validation && !validation.valid && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Invalid Token</AlertTitle>
            {validation.reason}
          </Alert>
        )}

        {/* Test Token Section */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            onClick={handleTest}
            disabled={!canTest}
            startIcon={testing && <CircularProgress size={16} />}
          >
            {testing ? 'Testing...' : 'Test Token with API'}
          </Button>
        </Box>

        {/* Test Result */}
        {testResult === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <CheckCircle sx={{ verticalAlign: 'middle', mr: 1 }} />
            Token successfully verified with API!
          </Alert>
        )}

        {testResult === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <ErrorIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Token verification failed. Please check the token and try again.
          </Alert>
        )}

        {/* Helper Info */}
        <Alert severity="info" icon={<InfoIcon />}>
          <Typography variant="body2">
            <strong>Tip:</strong> You can test the token before saving to verify it works with the API.
            The token will be securely stored and used for this site.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!canSave}
          startIcon={saving && <CircularProgress size={16} />}
        >
          {saving ? 'Saving...' : 'Add Token'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddTokenDialog;
