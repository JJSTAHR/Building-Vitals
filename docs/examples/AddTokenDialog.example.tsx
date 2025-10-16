/**
 * AddTokenDialog Usage Examples
 *
 * This file demonstrates various ways to use the AddTokenDialog component
 * in your application for managing multi-site authentication tokens.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import { Add, Delete, Refresh } from '@mui/icons-material';
import { AddTokenDialog } from '../../src/components/AddTokenDialog';

// ============================================================================
// Example 1: Basic Integration in Settings Page
// ============================================================================

export const SettingsPageExample: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sites, setSites] = useState<string[]>([]);

  // Load existing sites from storage
  useEffect(() => {
    const loadSites = () => {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('token_'));
      const siteIds = keys.map(key => key.replace('token_', ''));
      setSites(siteIds);
    };
    loadSites();
  }, []);

  const handleTokenAdded = (siteId: string) => {
    setSites(prev => [...prev, siteId]);
    console.log(`Token added for site: ${siteId}`);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Multi-Site Token Management
      </Typography>

      <Button
        variant="outlined"
        startIcon={<Add />}
        onClick={() => setDialogOpen(true)}
        sx={{ mb: 2 }}
      >
        Add Token for New Site
      </Button>

      <AddTokenDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onTokenAdded={handleTokenAdded}
        existingSites={sites}
      />

      {sites.length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You have {sites.length} site(s) configured
        </Alert>
      )}
    </Paper>
  );
};

// ============================================================================
// Example 2: Integration with Site List Management
// ============================================================================

interface SiteTokenData {
  siteId: string;
  siteName: string;
  addedAt: string;
  expiresAt?: string;
}

export const SiteListManagementExample: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [siteTokens, setSiteTokens] = useState<SiteTokenData[]>([]);

  // Load site tokens from storage
  useEffect(() => {
    const loadTokens = () => {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('token_'));
      const tokens = keys.map(key => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      }).filter(Boolean);
      setSiteTokens(tokens);
    };
    loadTokens();
  }, []);

  const handleTokenAdded = (siteId: string) => {
    // Reload tokens after adding new one
    const data = localStorage.getItem(`token_${siteId}`);
    if (data) {
      const tokenData = JSON.parse(data);
      setSiteTokens(prev => [...prev, tokenData]);
    }
  };

  const handleRemoveToken = (siteId: string) => {
    if (window.confirm(`Remove token for ${siteId}?`)) {
      localStorage.removeItem(`token_${siteId}`);
      setSiteTokens(prev => prev.filter(t => t.siteId !== siteId));
    }
  };

  const handleRefreshToken = (siteId: string) => {
    // Open dialog pre-filled with site ID for token refresh
    console.log(`Refresh token for ${siteId}`);
    // In a real app, you'd handle this by removing old token and adding new one
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configured Sites
      </Typography>

      <Button
        variant="contained"
        startIcon={<Add />}
        onClick={() => setDialogOpen(true)}
        sx={{ mb: 2 }}
      >
        Add Site Token
      </Button>

      <AddTokenDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onTokenAdded={handleTokenAdded}
        existingSites={siteTokens.map(t => t.siteId)}
      />

      {siteTokens.length === 0 ? (
        <Alert severity="info">
          No sites configured. Click "Add Site Token" to add one.
        </Alert>
      ) : (
        <List>
          {siteTokens.map(site => (
            <ListItem
              key={site.siteId}
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
                    <Typography variant="subtitle1">{site.siteName}</Typography>
                    <Chip label="Active" size="small" color="success" />
                  </Box>
                }
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Site ID: {site.siteId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Added: {new Date(site.addedAt).toLocaleDateString()}
                    </Typography>
                  </>
                }
              />
              <ListItemSecondaryAction>
                <IconButton onClick={() => handleRefreshToken(site.siteId)}>
                  <Refresh />
                </IconButton>
                <IconButton onClick={() => handleRemoveToken(site.siteId)}>
                  <Delete />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

// ============================================================================
// Example 3: Programmatic Dialog Control with State Management
// ============================================================================

export const AdvancedIntegrationExample: React.FC = () => {
  const [dialogState, setDialogState] = useState({
    open: false,
    mode: 'add' as 'add' | 'refresh',
    targetSiteId: null as string | null,
  });
  const [existingSites, setExistingSites] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  useEffect(() => {
    // Load existing sites
    const keys = Object.keys(localStorage).filter(key => key.startsWith('token_'));
    setExistingSites(keys.map(key => key.replace('token_', '')));
  }, []);

  const handleOpenDialog = (mode: 'add' | 'refresh', siteId?: string) => {
    setDialogState({
      open: true,
      mode,
      targetSiteId: siteId || null,
    });
  };

  const handleCloseDialog = () => {
    setDialogState({
      open: false,
      mode: 'add',
      targetSiteId: null,
    });
  };

  const handleTokenAdded = (siteId: string) => {
    setExistingSites(prev => [...prev, siteId]);
    setSnackbar({
      open: true,
      message: `Token successfully added for ${siteId}`,
      severity: 'success',
    });

    // Auto-close snackbar after 3 seconds
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }));
    }, 3000);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Token Management System
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog('add')}
        >
          Add New Site
        </Button>

        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => handleOpenDialog('refresh')}
          disabled={existingSites.length === 0}
        >
          Refresh Token
        </Button>
      </Box>

      <AddTokenDialog
        open={dialogState.open}
        onClose={handleCloseDialog}
        onTokenAdded={handleTokenAdded}
        existingSites={existingSites}
      />

      {snackbar.open && (
        <Alert severity={snackbar.severity} sx={{ mt: 2 }}>
          {snackbar.message}
        </Alert>
      )}

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="body1">
          <strong>Sites configured:</strong> {existingSites.length}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {existingSites.join(', ') || 'None'}
        </Typography>
      </Paper>
    </Box>
  );
};

// ============================================================================
// Example 4: Responsive Mobile Integration
// ============================================================================

export const MobileResponsiveExample: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingSites, setExistingSites] = useState<string[]>([
    'ses_site_1',
    'ses_site_2',
  ]);

  const handleTokenAdded = (siteId: string) => {
    setExistingSites(prev => [...prev, siteId]);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography
        variant="h6"
        sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' }, mb: 2 }}
      >
        Site Tokens
      </Typography>

      <Button
        fullWidth
        variant="contained"
        size="large"
        startIcon={<Add />}
        onClick={() => setDialogOpen(true)}
        sx={{
          py: { xs: 1.5, sm: 1 },
          fontSize: { xs: '1rem', sm: '0.875rem' },
        }}
      >
        Add Site Token
      </Button>

      {/* Dialog automatically goes fullscreen on mobile */}
      <AddTokenDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onTokenAdded={handleTokenAdded}
        existingSites={existingSites}
      />
    </Box>
  );
};

// ============================================================================
// Example 5: Validation and Error Handling
// ============================================================================

export const ValidationExample: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingSites] = useState<string[]>([
    'ses_falls_city',
    'ses_production_1',
    'ses_staging_1',
  ]);
  const [errorLog, setErrorLog] = useState<string[]>([]);

  const handleTokenAdded = (siteId: string) => {
    console.log(`✓ Token added successfully for: ${siteId}`);
    setErrorLog(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] SUCCESS: Token added for ${siteId}`,
    ]);
  };

  const handleDialogClose = () => {
    console.log('Dialog closed');
    setDialogOpen(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Token Validation Example
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Try adding a token with:
        <ul>
          <li>Invalid JWT format (not 3 parts)</li>
          <li>Duplicate site ID: {existingSites[0]}</li>
          <li>Expired token</li>
          <li>Token expiring soon (7 days)</li>
        </ul>
      </Alert>

      <Button
        variant="contained"
        onClick={() => setDialogOpen(true)}
      >
        Open Dialog
      </Button>

      <AddTokenDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onTokenAdded={handleTokenAdded}
        existingSites={existingSites}
      />

      {errorLog.length > 0 && (
        <Paper sx={{ p: 2, mt: 3, bgcolor: 'grey.900', color: 'grey.100' }}>
          <Typography variant="subtitle2" gutterBottom>
            Event Log:
          </Typography>
          {errorLog.map((log, idx) => (
            <Typography key={idx} variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
              {log}
            </Typography>
          ))}
        </Paper>
      )}
    </Box>
  );
};

// ============================================================================
// Example 6: Custom Hook for Token Management
// ============================================================================

/**
 * Custom hook for managing site tokens with the AddTokenDialog
 */
const useTokenManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sites, setSites] = useState<string[]>([]);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = () => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('token_'));
    setSites(keys.map(key => key.replace('token_', '')));
  };

  const openAddDialog = () => setDialogOpen(true);
  const closeDialog = () => setDialogOpen(false);

  const handleTokenAdded = (siteId: string) => {
    loadSites(); // Reload to get updated list
    return siteId;
  };

  const removeToken = (siteId: string) => {
    localStorage.removeItem(`token_${siteId}`);
    loadSites();
  };

  return {
    dialogOpen,
    sites,
    openAddDialog,
    closeDialog,
    handleTokenAdded,
    removeToken,
  };
};

export const CustomHookExample: React.FC = () => {
  const {
    dialogOpen,
    sites,
    openAddDialog,
    closeDialog,
    handleTokenAdded,
    removeToken,
  } = useTokenManagement();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Token Management with Custom Hook
      </Typography>

      <Button variant="contained" onClick={openAddDialog}>
        Add Token
      </Button>

      <AddTokenDialog
        open={dialogOpen}
        onClose={closeDialog}
        onTokenAdded={handleTokenAdded}
        existingSites={sites}
      />

      <Typography variant="body2" sx={{ mt: 2 }}>
        Configured sites: {sites.length}
      </Typography>
    </Box>
  );
};

// ============================================================================
// Export all examples for documentation
// ============================================================================

export const examples = {
  SettingsPageExample,
  SiteListManagementExample,
  AdvancedIntegrationExample,
  MobileResponsiveExample,
  ValidationExample,
  CustomHookExample,
};

export default examples;
