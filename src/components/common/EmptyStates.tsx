/**
 * EmptyStates Component
 *
 * Reusable empty state components for consistent UX across the application.
 * Provides helpful, visually appealing empty states with clear calls to action.
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Token as TokenIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { TOKEN_EMPTY_STATE_CONFIG, TOKEN_TYPOGRAPHY } from '../../theme/tokenTheme';

/**
 * Base Empty State Props
 */
interface BaseEmptyStateProps {
  /** Custom icon to display */
  icon?: React.ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Additional custom content */
  children?: React.ReactNode;
  /** Custom styles */
  sx?: SxProps<Theme>;
}

/**
 * Base Empty State Component
 * Foundation for all empty states
 */
export const EmptyState: React.FC<BaseEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  sx = {},
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: TOKEN_EMPTY_STATE_CONFIG.minHeight,
        p: 4,
        textAlign: 'center',
        ...sx,
      }}
      className="token-fade-in"
    >
      {/* Icon */}
      {icon && (
        <Box
          sx={{
            fontSize: TOKEN_EMPTY_STATE_CONFIG.iconSize,
            color: TOKEN_EMPTY_STATE_CONFIG.iconColor,
            mb: TOKEN_EMPTY_STATE_CONFIG.spacing,
          }}
          className="token-scale-in"
        >
          {icon}
        </Box>
      )}

      {/* Title */}
      <Typography
        {...TOKEN_TYPOGRAPHY.emptyStateTitle}
        gutterBottom
      >
        {title}
      </Typography>

      {/* Description */}
      {description && (
        <Typography
          {...TOKEN_TYPOGRAPHY.emptyStateBody}
          sx={{ mb: TOKEN_EMPTY_STATE_CONFIG.buttonMarginTop, maxWidth: 500 }}
        >
          {description}
        </Typography>
      )}

      {/* Custom Content */}
      {children}

      {/* Actions */}
      {(action || secondaryAction) && (
        <Stack direction="row" spacing={2} sx={{ mt: children ? 2 : 0 }}>
          {action && (
            <Button
              variant="contained"
              onClick={action.onClick}
              startIcon={action.icon}
              className="token-button-hover"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outlined"
              onClick={secondaryAction.onClick}
              className="token-button-hover"
            >
              {secondaryAction.label}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
};

/**
 * No Tokens Empty State
 * Displayed when no site tokens are configured
 */
export const NoTokensEmptyState: React.FC<{
  onAddToken: () => void;
}> = ({ onAddToken }) => {
  return (
    <EmptyState
      icon={<TokenIcon sx={{ fontSize: 'inherit' }} />}
      title="No Tokens Configured"
      description="Get started by adding your first site token to access building data via the ACE IoT API."
      action={{
        label: 'Add Token',
        onClick: onAddToken,
        icon: <AddIcon />,
      }}
    />
  );
};

/**
 * No Search Results Empty State
 * Displayed when search/filter returns no results
 */
export const NoSearchResultsEmptyState: React.FC<{
  searchQuery?: string;
  onClearSearch?: () => void;
}> = ({ searchQuery, onClearSearch }) => {
  return (
    <EmptyState
      icon={<SearchIcon sx={{ fontSize: 'inherit' }} />}
      title="No Results Found"
      description={
        searchQuery
          ? `No tokens match "${searchQuery}". Try adjusting your search criteria.`
          : 'No tokens match your current filters.'
      }
      action={
        onClearSearch
          ? {
              label: 'Clear Search',
              onClick: onClearSearch,
            }
          : undefined
      }
    />
  );
};

/**
 * All Tokens Expired Empty State
 * Displayed when all tokens are expired
 */
export const AllExpiredEmptyState: React.FC<{
  onAddToken: () => void;
}> = ({ onAddToken }) => {
  return (
    <EmptyState
      icon={<ErrorIcon sx={{ fontSize: 'inherit', color: 'error.main' }} />}
      title="All Tokens Expired"
      description="All configured site tokens have expired. Add a new token or update existing ones to continue using the application."
      action={{
        label: 'Add New Token',
        onClick: onAddToken,
        icon: <AddIcon />,
      }}
      sx={{
        bgcolor: 'error.lighter',
        borderRadius: 2,
      }}
    />
  );
};

/**
 * Loading Failed Empty State
 * Displayed when token loading fails
 */
export const LoadingFailedEmptyState: React.FC<{
  error?: string;
  onRetry: () => void;
}> = ({ error, onRetry }) => {
  return (
    <EmptyState
      icon={<WarningIcon sx={{ fontSize: 'inherit', color: 'warning.main' }} />}
      title="Failed to Load Tokens"
      description={error || 'An error occurred while loading your tokens. Please try again.'}
      action={{
        label: 'Retry',
        onClick: onRetry,
      }}
      sx={{
        bgcolor: 'warning.lighter',
        borderRadius: 2,
      }}
    />
  );
};

/**
 * All Tokens Active Empty State
 * Celebratory state when all tokens are healthy
 */
export const AllActiveEmptyState: React.FC = () => {
  return (
    <EmptyState
      icon={<CheckCircleIcon sx={{ fontSize: 'inherit', color: 'success.main' }} />}
      title="All Tokens Active"
      description="All your site tokens are active and healthy. No action required."
      sx={{
        bgcolor: 'success.lighter',
        borderRadius: 2,
        minHeight: 200,
      }}
    />
  );
};

/**
 * Migration Required Empty State
 * Displayed when legacy tokens need migration
 */
export const MigrationRequiredEmptyState: React.FC<{
  tokenCount: number;
  onMigrate: () => void;
}> = ({ tokenCount, onMigrate }) => {
  return (
    <EmptyState
      icon={<InfoIcon sx={{ fontSize: 'inherit', color: 'info.main' }} />}
      title="Migration Required"
      description={`You have ${tokenCount} legacy token${tokenCount > 1 ? 's' : ''} that need${tokenCount === 1 ? 's' : ''} to be migrated to the new multi-site system.`}
      action={{
        label: 'Migrate Now',
        onClick: onMigrate,
      }}
      sx={{
        bgcolor: 'info.lighter',
        borderRadius: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
        This is a one-time process that will preserve all your existing tokens.
      </Typography>
    </EmptyState>
  );
};

/**
 * Permission Denied Empty State
 * Displayed when user lacks permission
 */
export const PermissionDeniedEmptyState: React.FC<{
  onRequestAccess?: () => void;
}> = ({ onRequestAccess }) => {
  return (
    <EmptyState
      icon={<WarningIcon sx={{ fontSize: 'inherit', color: 'error.main' }} />}
      title="Access Denied"
      description="You don't have permission to view or manage site tokens. Please contact your administrator."
      action={
        onRequestAccess
          ? {
              label: 'Request Access',
              onClick: onRequestAccess,
            }
          : undefined
      }
      sx={{
        bgcolor: 'error.lighter',
        borderRadius: 2,
      }}
    />
  );
};

/**
 * Site Selector Empty State
 * Displayed in site selector when no sites available
 */
export const NoSitesEmptyState: React.FC<{
  onAddSite: () => void;
}> = ({ onAddSite }) => {
  return (
    <Box
      sx={{
        p: 3,
        textAlign: 'center',
        bgcolor: 'background.default',
        borderRadius: 1,
      }}
    >
      <TokenIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
      <Typography variant="body2" color="text.secondary" gutterBottom>
        No sites configured
      </Typography>
      <Button
        size="small"
        variant="text"
        startIcon={<AddIcon />}
        onClick={onAddSite}
        sx={{ mt: 1 }}
      >
        Add Site
      </Button>
    </Box>
  );
};

/**
 * Compact Empty State
 * Smaller version for cards and compact layouts
 */
export const CompactEmptyState: React.FC<{
  message: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}> = ({ message, icon, action }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        p: 2,
        textAlign: 'center',
      }}
    >
      {icon && (
        <Box sx={{ fontSize: 32, color: 'text.disabled' }}>
          {icon}
        </Box>
      )}
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
      {action && (
        <Button
          size="small"
          variant="outlined"
          onClick={action.onClick}
          sx={{ mt: 0.5 }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
};

/**
 * Export all empty states
 */
export default {
  EmptyState,
  NoTokensEmptyState,
  NoSearchResultsEmptyState,
  AllExpiredEmptyState,
  LoadingFailedEmptyState,
  AllActiveEmptyState,
  MigrationRequiredEmptyState,
  PermissionDeniedEmptyState,
  NoSitesEmptyState,
  CompactEmptyState,
};
