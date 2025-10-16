import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Box,
  Typography,
  Collapse,
  IconButton,
  Slide,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { SiteToken, TokenValidation } from '../types/auth';
import { TokenStatusBadge } from './TokenStatusBadge';

interface TokenExpiryWarningProps {
  siteTokens: Map<string, SiteToken>;
  validations: Map<string, TokenValidation>;
  onTokenClick?: (siteId: string) => void;
}

type WarningStatus = 'expired' | 'critical' | 'urgent' | 'warning' | null;

interface WarningData {
  status: WarningStatus;
  siteIds: string[];
}

const DISMISS_STORAGE_KEY = 'token_warning_dismissed';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const TokenExpiryWarning: React.FC<TokenExpiryWarningProps> = ({
  siteTokens,
  validations,
  onTokenClick,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);

  // Check if warning was dismissed
  useEffect(() => {
    const dismissedData = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (dismissedData) {
      try {
        const { timestamp } = JSON.parse(dismissedData);
        const now = Date.now();
        if (now - timestamp < DISMISS_DURATION) {
          setDismissed(true);
        } else {
          localStorage.removeItem(DISMISS_STORAGE_KEY);
        }
      } catch (e) {
        localStorage.removeItem(DISMISS_STORAGE_KEY);
      }
    }
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setForceUpdateKey((prev) => prev + 1);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const getWarningData = useCallback((): WarningData => {
    const expiredSites: string[] = [];
    const criticalSites: string[] = [];
    const urgentSites: string[] = [];
    const warningSites: string[] = [];

    for (const [siteId, validation] of validations) {
      if (!validation.valid || validation.expired) {
        expiredSites.push(siteId);
      } else if (validation.daysUntilExpiry !== undefined && validation.daysUntilExpiry < 1) {
        criticalSites.push(siteId);
      } else if (validation.daysUntilExpiry !== undefined && validation.daysUntilExpiry < 3) {
        urgentSites.push(siteId);
      } else if (validation.daysUntilExpiry !== undefined && validation.daysUntilExpiry < 7) {
        warningSites.push(siteId);
      }
    }

    if (expiredSites.length > 0) {
      return { status: 'expired', siteIds: expiredSites };
    }
    if (criticalSites.length > 0) {
      return { status: 'critical', siteIds: criticalSites };
    }
    if (urgentSites.length > 0) {
      return { status: 'urgent', siteIds: urgentSites };
    }
    if (warningSites.length > 0) {
      return { status: 'warning', siteIds: warningSites };
    }

    return { status: null, siteIds: [] };
  }, [validations, forceUpdateKey]);

  const warningData = getWarningData();

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(
      DISMISS_STORAGE_KEY,
      JSON.stringify({ timestamp: Date.now() })
    );
  };

  const handleTokenClick = (siteId: string) => {
    if (onTokenClick) {
      onTokenClick(siteId);
    }
  };

  const getSiteNames = (siteIds: string[]): string => {
    return siteIds
      .map((id) => siteTokens.get(id)?.siteName || id)
      .join(', ');
  };

  const renderSiteDetails = (siteIds: string[]) => (
    <Collapse in={expanded}>
      <Box sx={{ mt: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
        {siteIds.map((siteId) => {
          const token = siteTokens.get(siteId);
          const validation = validations.get(siteId);

          return (
            <Box
              key={siteId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                mb: 1,
                p: 1,
                bgcolor: 'background.paper',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                {token?.siteName || siteId}
              </Typography>
              {validation && <TokenStatusBadge validation={validation} size="small" />}
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleTokenClick(siteId)}
              >
                Update
              </Button>
            </Box>
          );
        })}
      </Box>
    </Collapse>
  );

  // Don't render if no warnings or dismissed
  if (!warningData.status || (dismissed && warningData.status === 'warning')) {
    return null;
  }

  const siteCount = warningData.siteIds.length;
  const siteNames = getSiteNames(warningData.siteIds);

  const renderAlert = () => {
    switch (warningData.status) {
      case 'expired':
        return (
          <Alert
            severity="error"
            variant="filled"
            icon={<ErrorIcon />}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => handleTokenClick(warningData.siteIds[0])}
              >
                Update Token
              </Button>
            }
            sx={{ mb: 0 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <AlertTitle sx={{ mb: 1 }}>Token Expired</AlertTitle>
                <Typography variant="body2">
                  {siteCount} site token{siteCount > 1 ? 's have' : ' has'} expired: <strong>{siteNames}</strong>
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Please update your tokens to continue using the application.
                </Typography>
              </Box>
              {siteCount > 1 && (
                <IconButton
                  size="small"
                  onClick={() => setExpanded(!expanded)}
                  sx={{
                    color: 'inherit',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s',
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              )}
            </Box>
            {siteCount > 1 && renderSiteDetails(warningData.siteIds)}
          </Alert>
        );

      case 'critical':
        return (
          <Alert
            severity="error"
            icon={<WarningIcon />}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => handleTokenClick(warningData.siteIds[0])}
              >
                Renew Now
              </Button>
            }
            sx={{ mb: 0 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <AlertTitle sx={{ mb: 1 }}>Token Expiring Today!</AlertTitle>
                <Typography variant="body2">
                  {siteCount} site token{siteCount > 1 ? 's expire' : ' expires'} within 24 hours: <strong>{siteNames}</strong>
                </Typography>
              </Box>
              {siteCount > 1 && (
                <IconButton
                  size="small"
                  onClick={() => setExpanded(!expanded)}
                  sx={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s',
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              )}
            </Box>
            {siteCount > 1 && renderSiteDetails(warningData.siteIds)}
          </Alert>
        );

      case 'urgent':
        return (
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setExpanded(!expanded)}
              >
                View Details
              </Button>
            }
            sx={{ mb: 0 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <AlertTitle sx={{ mb: 1 }}>Token Expiring Soon</AlertTitle>
                <Typography variant="body2">
                  {siteCount} site token{siteCount > 1 ? 's expire' : ' expires'} within 3 days: <strong>{siteNames}</strong>
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            {renderSiteDetails(warningData.siteIds)}
          </Alert>
        );

      case 'warning':
        return (
          <Alert
            severity="info"
            onClose={handleDismiss}
            sx={{ mb: 0 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <AlertTitle sx={{ mb: 1 }}>Token Renewal Reminder</AlertTitle>
                <Typography variant="body2">
                  {siteCount} site token{siteCount > 1 ? 's expire' : ' expires'} within 7 days: <strong>{siteNames}</strong>
                </Typography>
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block', opacity: 0.8 }}>
                  Click the × to dismiss this reminder for 24 hours
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            {renderSiteDetails(warningData.siteIds)}
          </Alert>
        );

      default:
        return null;
    }
  };

  return (
    <Slide direction="down" in={true} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          mb: 2,
          '& .MuiAlert-root': {
            borderRadius: 0,
            borderBottom: 1,
            borderColor: 'divider',
          },
        }}
      >
        {renderAlert()}
      </Box>
    </Slide>
  );
};
