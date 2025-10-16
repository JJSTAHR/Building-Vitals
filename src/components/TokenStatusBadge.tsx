/**
 * TokenStatusBadge Component
 *
 * Displays token expiration status with color-coded badges and icons.
 * Shows active, warning, urgent, critical, expired, and invalid states.
 *
 * Status Logic:
 * - Active: >7 days until expiry (green)
 * - Warning: 3-7 days until expiry (orange)
 * - Urgent: 1-3 days until expiry (red/amber)
 * - Critical: <1 day until expiry (red, pulsing)
 * - Expired: Token is expired (red, with error icon)
 * - Invalid: Token format invalid (grey, with warning icon)
 */

import React from 'react';
import {
  Chip,
  Tooltip,
  Box,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { keyframes } from '@mui/system';

// Import TokenValidation type from the existing types file
import type { TokenValidation } from '../types/token.types';

export interface TokenStatusBadgeProps {
  /** Token validation object containing expiration details */
  validation: TokenValidation;
  /** Size of the badge */
  size?: 'small' | 'medium' | 'large';
  /** Show days until expiry in the label */
  showDays?: boolean;
}

/**
 * Pulsing animation for critical token status
 */
const pulseAnimation = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
`;

/**
 * Configuration for each status level
 */
interface StatusConfig {
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: React.ReactElement;
  pulse?: boolean;
}

/**
 * Get status configuration based on token validation
 */
const getStatusConfig = (
  validation: TokenValidation,
  showDays: boolean
): StatusConfig => {
  // Invalid token format
  if (!validation.isValid) {
    return {
      label: 'Invalid',
      color: 'default',
      icon: <WarningIcon fontSize="small" />,
    };
  }

  // Expired token
  if (validation.isExpired) {
    return {
      label: 'Expired',
      color: 'error',
      icon: <ErrorIcon fontSize="small" />,
    };
  }

  const days = validation.daysUntilExpiration ?? 0;

  // Active: >7 days
  if (days > 7) {
    return {
      label: showDays ? `Active (${days}d)` : 'Active',
      color: 'success',
      icon: <CheckCircleIcon fontSize="small" />,
    };
  }

  // Warning: 3-7 days
  if (days > 3) {
    return {
      label: showDays ? `Expiring Soon (${days}d)` : 'Warning',
      color: 'warning',
      icon: <WarningIcon fontSize="small" />,
    };
  }

  // Urgent: 1-3 days
  if (days > 1) {
    return {
      label: showDays ? `Urgent (${days}d)` : 'Urgent',
      color: 'error',
      icon: <ErrorIcon fontSize="small" />,
      pulse: true,
    };
  }

  // Critical: <1 day
  return {
    label: showDays ? 'Critical (<1d)' : 'Critical',
    color: 'error',
    icon: <ErrorIcon fontSize="small" />,
    pulse: true,
  };
};

/**
 * Size-specific styles
 */
const sizeStyles = {
  small: {
    fontSize: '0.75rem',
    height: 24,
    '& .MuiChip-icon': { fontSize: '0.875rem' },
  },
  medium: {
    fontSize: '0.875rem',
    height: 32,
    '& .MuiChip-icon': { fontSize: '1rem' },
  },
  large: {
    fontSize: '1rem',
    height: 40,
    '& .MuiChip-icon': { fontSize: '1.25rem' },
  },
};

/**
 * Format date for display
 */
const formatDate = (date: Date | null): string => {
  if (!date) return 'N/A';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Build tooltip content with token details
 */
const getTooltipContent = (validation: TokenValidation) => {
  return (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="caption" display="block" sx={{ fontWeight: 600, mb: 0.5 }}>
        {validation.isValid ? 'Valid Token' : 'Invalid Token'}
      </Typography>

      {validation.expiresAt && (
        <Typography variant="caption" display="block" sx={{ mb: 0.25 }}>
          Expires: {formatDate(validation.expiresAt)}
        </Typography>
      )}

      {validation.daysUntilExpiration !== undefined && validation.daysUntilExpiration !== null && validation.daysUntilExpiration >= 0 && (
        <Typography variant="caption" display="block" sx={{ mb: 0.25 }}>
          Days Remaining: {validation.daysUntilExpiration}
        </Typography>
      )}

      {validation.isExpired && (
        <Typography variant="caption" display="block" sx={{ color: 'error.light' }}>
          Token has expired. Please update.
        </Typography>
      )}

      {!validation.isValid && !validation.isExpired && (
        <Typography variant="caption" display="block" sx={{ color: 'warning.light' }}>
          Token format is invalid.
        </Typography>
      )}
    </Box>
  );
};

/**
 * TokenStatusBadge Component
 *
 * Displays a color-coded badge indicating the token's expiration status.
 * Includes tooltip with detailed information and supports multiple sizes.
 *
 * @example
 * ```tsx
 * <TokenStatusBadge
 *   validation={tokenValidation}
 *   size="medium"
 *   showDays={true}
 * />
 * ```
 */
export const TokenStatusBadge: React.FC<TokenStatusBadgeProps> = ({
  validation,
  size = 'medium',
  showDays = true,
}) => {
  const statusConfig = getStatusConfig(validation, showDays);
  const tooltipContent = getTooltipContent(validation);

  // Build aria-label for accessibility
  const ariaLabel = `Token status: ${statusConfig.label}. ${
    validation.isExpired
      ? 'Token has expired.'
      : validation.isValid && validation.daysUntilExpiration !== undefined && validation.daysUntilExpiration !== null
        ? `Expires in ${validation.daysUntilExpiration} days.`
        : 'Token is invalid.'
  }`;

  return (
    <Tooltip title={tooltipContent} arrow placement="top">
      <Chip
        label={statusConfig.label}
        color={statusConfig.color}
        icon={statusConfig.icon}
        size={size === 'large' ? 'medium' : 'small'}
        aria-label={ariaLabel}
        sx={{
          ...sizeStyles[size],
          animation: statusConfig.pulse
            ? `${pulseAnimation} 2s ease-in-out infinite`
            : 'none',
          fontWeight: 500,
          '& .MuiChip-label': {
            px: 1,
          },
        }}
      />
    </Tooltip>
  );
};

export default TokenStatusBadge;
