/**
 * TokenSuccessSnackbar Component
 *
 * Provides beautiful, animated success/error feedback for token operations.
 * Displays snackbar notifications with icons, animations, and auto-dismiss.
 */

import React from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Box,
  Typography,
  Grow,
  Slide,
  IconButton,
  SxProps,
  Theme,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { TOKEN_ANIMATIONS, TOKEN_Z_INDEX } from '../../theme/tokenTheme';

/**
 * Notification Types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Snackbar Position
 */
export type SnackbarPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * TokenSuccessSnackbar Props
 */
export interface TokenSuccessSnackbarProps {
  /** Whether the snackbar is open */
  open: boolean;
  /** Callback when snackbar should close */
  onClose: () => void;
  /** Type of notification */
  type?: NotificationType;
  /** Title text */
  title?: string;
  /** Message text */
  message: string;
  /** Auto-hide duration in milliseconds (default: 6000) */
  autoHideDuration?: number;
  /** Position on screen */
  position?: SnackbarPosition;
  /** Show close button */
  showCloseButton?: boolean;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Custom styles */
  sx?: SxProps<Theme>;
}

/**
 * Get icon for notification type
 */
const getIcon = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return <CheckCircleIcon className="token-success-icon" />;
    case 'error':
      return <ErrorIcon className="token-error-icon" />;
    case 'warning':
      return <WarningIcon className="token-warning-icon" />;
    case 'info':
      return <InfoIcon />;
  }
};

/**
 * Convert position string to MUI anchorOrigin
 */
const getAnchorOrigin = (position: SnackbarPosition) => {
  const [vertical, horizontal] = position.split('-');
  return {
    vertical: vertical as 'top' | 'bottom',
    horizontal: horizontal === 'center' ? 'center' : (horizontal as 'left' | 'right'),
  };
};

/**
 * TokenSuccessSnackbar Component
 *
 * Animated notification snackbar for token operations.
 * Provides visual feedback for success, error, warning, and info states.
 *
 * @example
 * ```tsx
 * <TokenSuccessSnackbar
 *   open={showSuccess}
 *   onClose={() => setShowSuccess(false)}
 *   type="success"
 *   title="Token Added"
 *   message="Token successfully added for Falls City Hospital"
 * />
 * ```
 */
export const TokenSuccessSnackbar: React.FC<TokenSuccessSnackbarProps> = ({
  open,
  onClose,
  type = 'success',
  title,
  message,
  autoHideDuration = 6000,
  position = 'bottom-center',
  showCloseButton = true,
  action,
  sx = {},
}) => {
  const anchorOrigin = getAnchorOrigin(position);
  const icon = getIcon(type);

  // Determine transition based on position
  const TransitionComponent = anchorOrigin.vertical === 'top' ? Slide : Grow;
  const transitionProps = anchorOrigin.vertical === 'top'
    ? { direction: 'down' as const }
    : {};

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      TransitionComponent={TransitionComponent}
      TransitionProps={transitionProps}
      sx={{
        zIndex: TOKEN_Z_INDEX.snackbar,
        ...sx,
      }}
    >
      <Alert
        severity={type}
        icon={icon}
        onClose={showCloseButton ? onClose : undefined}
        action={
          action ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography
                variant="button"
                sx={{
                  cursor: 'pointer',
                  color: 'inherit',
                  opacity: 0.9,
                  '&:hover': { opacity: 1 },
                }}
                onClick={action.onClick}
              >
                {action.label}
              </Typography>
              {showCloseButton && (
                <IconButton
                  size="small"
                  onClick={onClose}
                  sx={{ color: 'inherit' }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ) : undefined
        }
        sx={{
          minWidth: 300,
          maxWidth: 600,
          boxShadow: 6,
          '& .MuiAlert-icon': {
            fontSize: 24,
          },
        }}
        className={`token-${type}-enter`}
      >
        {title && (
          <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>
            {title}
          </AlertTitle>
        )}
        <Typography variant="body2">
          {message}
        </Typography>
      </Alert>
    </Snackbar>
  );
};

/**
 * Preset Notification Functions
 * Convenient helpers for common token operations
 */

/**
 * Token Added Success Notification
 */
export const tokenAddedNotification = (siteName: string): Omit<TokenSuccessSnackbarProps, 'open' | 'onClose'> => ({
  type: 'success',
  title: 'Token Added Successfully',
  message: `Token for ${siteName} has been added and is ready to use.`,
});

/**
 * Token Updated Success Notification
 */
export const tokenUpdatedNotification = (siteName: string): Omit<TokenSuccessSnackbarProps, 'open' | 'onClose'> => ({
  type: 'success',
  title: 'Token Updated',
  message: `Token for ${siteName} has been updated successfully.`,
});

/**
 * Token Deleted Success Notification
 */
export const tokenDeletedNotification = (siteName: string): Omit<TokenSuccessSnackbarProps, 'open' | 'onClose'> => ({
  type: 'info',
  title: 'Token Removed',
  message: `Token for ${siteName} has been removed from your account.`,
});

/**
 * Token Error Notification
 */
export const tokenErrorNotification = (error: string): Omit<TokenSuccessSnackbarProps, 'open' | 'onClose'> => ({
  type: 'error',
  title: 'Operation Failed',
  message: error,
  autoHideDuration: 8000,
});

/**
 * Token Expiring Warning Notification
 */
export const tokenExpiringNotification = (
  siteName: string,
  daysRemaining: number,
  onUpdate: () => void
): Omit<TokenSuccessSnackbarProps, 'open' | 'onClose'> => ({
  type: 'warning',
  title: 'Token Expiring Soon',
  message: `Token for ${siteName} expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.`,
  action: {
    label: 'Update Now',
    onClick: onUpdate,
  },
  autoHideDuration: 10000,
});

/**
 * Migration Success Notification
 */
export const migrationSuccessNotification = (count: number): Omit<TokenSuccessSnackbarProps, 'open' | 'onClose'> => ({
  type: 'success',
  title: 'Migration Complete',
  message: `Successfully migrated ${count} token${count > 1 ? 's' : ''} to the new system.`,
  autoHideDuration: 8000,
});

/**
 * Token Validation Success Notification
 */
export const tokenValidatedNotification = (): Omit<TokenSuccessSnackbarProps, 'open' | 'onClose'> => ({
  type: 'success',
  title: 'Token Validated',
  message: 'Token has been successfully validated with the API.',
});

/**
 * Batch Operation Notification
 */
export const batchOperationNotification = (
  operation: string,
  successCount: number,
  totalCount: number
): Omit<TokenSuccessSnackbarProps, 'open' | 'onClose'> => ({
  type: successCount === totalCount ? 'success' : 'warning',
  title: `${operation} Complete`,
  message: `${successCount} of ${totalCount} token${totalCount > 1 ? 's' : ''} ${operation.toLowerCase()} successfully.`,
  autoHideDuration: 8000,
});

/**
 * Export all notification helpers
 */
export const tokenNotifications = {
  added: tokenAddedNotification,
  updated: tokenUpdatedNotification,
  deleted: tokenDeletedNotification,
  error: tokenErrorNotification,
  expiring: tokenExpiringNotification,
  migrationSuccess: migrationSuccessNotification,
  validated: tokenValidatedNotification,
  batchOperation: batchOperationNotification,
};

export default TokenSuccessSnackbar;
