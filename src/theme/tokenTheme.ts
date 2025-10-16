/**
 * Token Theme Configuration
 *
 * Centralized theme configuration for all token-related UI components.
 * Provides consistent colors, spacing, typography, and animations across
 * the multi-site token management system.
 */

/**
 * Token Status Color Palette
 * Color scheme for different token states with accessibility (WCAG AA)
 */
export const TOKEN_STATUS_COLORS = {
  active: {
    main: '#4caf50',      // Green - Material UI success
    light: '#81c784',     // Light green
    dark: '#388e3c',      // Dark green
    bg: '#e8f5e9',        // Very light green background
    contrastText: '#fff',
  },
  warning: {
    main: '#ff9800',      // Orange - Material UI warning
    light: '#ffb74d',     // Light orange
    dark: '#f57c00',      // Dark orange
    bg: '#fff3e0',        // Very light orange background
    contrastText: '#fff',
  },
  urgent: {
    main: '#f44336',      // Red - Material UI error
    light: '#e57373',     // Light red
    dark: '#d32f2f',      // Dark red
    bg: '#ffebee',        // Very light red background
    contrastText: '#fff',
  },
  expired: {
    main: '#9e9e9e',      // Grey - Material UI grey
    light: '#bdbdbd',     // Light grey
    dark: '#616161',      // Dark grey
    bg: '#f5f5f5',        // Very light grey background
    contrastText: '#fff',
  },
  invalid: {
    main: '#757575',      // Medium grey
    light: '#9e9e9e',     // Lighter grey
    dark: '#424242',      // Darker grey
    bg: '#fafafa',        // Almost white background
    contrastText: '#fff',
  },
} as const;

/**
 * Token UI Spacing
 * Standardized spacing values (in theme spacing units, 1 unit = 8px)
 */
export const TOKEN_UI_SPACING = {
  cardGap: 3,              // 24px - Gap between cards
  sectionMargin: 4,        // 32px - Margin between major sections
  itemPadding: 2,          // 16px - Padding within items
  iconGap: 1,              // 8px - Gap between icon and text
  buttonSpacing: 2,        // 16px - Space between buttons
  inlineSpacing: 1.5,      // 12px - Inline element spacing
  compactSpacing: 0.5,     // 4px - Very compact spacing
} as const;

/**
 * Token Animation Durations
 * Consistent timing for all animations (in milliseconds)
 */
export const TOKEN_ANIMATIONS = {
  // Standard transitions
  fast: 150,               // Quick state changes
  standard: 300,           // Default animation duration
  slow: 500,               // Deliberate, emphasized transitions

  // Special animations
  pulse: 2000,             // Pulsing animation for critical alerts
  slideIn: 400,            // Slide-in animations
  fadeIn: 250,             // Fade-in animations

  // Easing functions
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
} as const;

/**
 * Token Typography
 * Consistent text styles for token components
 */
export const TOKEN_TYPOGRAPHY = {
  // Section headers
  sectionHeader: {
    variant: 'h6' as const,
    sx: {
      mb: 2,
      fontWeight: 600,
      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
  },

  // Subsection headers
  subsectionHeader: {
    variant: 'subtitle1' as const,
    sx: {
      mb: 1,
      fontWeight: 500,
      color: 'text.primary',
    },
  },

  // Body text
  body: {
    variant: 'body2' as const,
    sx: {
      color: 'text.secondary',
    },
  },

  // Labels and captions
  label: {
    variant: 'caption' as const,
    sx: {
      color: 'text.secondary',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      fontWeight: 500,
    },
  },

  // Empty state text
  emptyStateTitle: {
    variant: 'h6' as const,
    sx: {
      color: 'text.secondary',
      fontWeight: 500,
    },
  },

  emptyStateBody: {
    variant: 'body2' as const,
    sx: {
      color: 'text.secondary',
      textAlign: 'center' as const,
    },
  },
} as const;

/**
 * Token Card Styles
 * Reusable card styling configurations
 */
export const TOKEN_CARD_STYLES = {
  // Standard card
  standard: {
    elevation: 1,
    sx: {
      transition: `all ${TOKEN_ANIMATIONS.standard}ms ${TOKEN_ANIMATIONS.easing.standard}`,
      '&:hover': {
        elevation: 3,
        transform: 'translateY(-2px)',
      },
    },
  },

  // Attention-needed card (higher elevation)
  attention: {
    elevation: 6,
    sx: {
      borderLeft: 4,
      borderColor: 'error.main',
      transition: `all ${TOKEN_ANIMATIONS.standard}ms ${TOKEN_ANIMATIONS.easing.standard}`,
    },
  },

  // Interactive card
  interactive: {
    elevation: 1,
    sx: {
      cursor: 'pointer',
      transition: `all ${TOKEN_ANIMATIONS.standard}ms ${TOKEN_ANIMATIONS.easing.standard}`,
      '&:hover': {
        elevation: 4,
        transform: 'scale(1.02)',
        bgcolor: 'action.hover',
      },
    },
  },

  // Compact card
  compact: {
    elevation: 0,
    variant: 'outlined' as const,
    sx: {
      transition: `all ${TOKEN_ANIMATIONS.fast}ms ${TOKEN_ANIMATIONS.easing.standard}`,
    },
  },
} as const;

/**
 * Icon Button Hover Effects
 */
export const TOKEN_ICON_BUTTON_STYLES = {
  // Standard hover
  standard: {
    '&:hover': {
      bgcolor: 'action.hover',
      transform: 'scale(1.1)',
      transition: `all ${TOKEN_ANIMATIONS.fast}ms ${TOKEN_ANIMATIONS.easing.standard}`,
    },
  },

  // Rotate on hover
  rotate: {
    '&:hover': {
      bgcolor: 'action.hover',
      transform: 'rotate(180deg)',
      transition: `transform ${TOKEN_ANIMATIONS.standard}ms ${TOKEN_ANIMATIONS.easing.standard}`,
    },
  },

  // Pulse on hover
  pulse: {
    '&:hover': {
      bgcolor: 'action.hover',
      animation: 'pulse 0.5s ease-in-out',
    },
  },
} as const;

/**
 * Empty State Configuration
 */
export const TOKEN_EMPTY_STATE_CONFIG = {
  minHeight: 300,
  iconSize: 64,
  iconColor: 'text.disabled',
  spacing: 2,
  buttonMarginTop: 3,
} as const;

/**
 * Loading Skeleton Configuration
 */
export const TOKEN_SKELETON_CONFIG = {
  titleWidth: '60%',
  titleHeight: 30,
  contentHeight: 60,
  footerWidth: '40%',
  footerHeight: 20,
  spacing: 2,
  animation: 'wave' as const,
} as const;

/**
 * Transition Components Configuration
 */
export const TOKEN_TRANSITIONS = {
  // Fade transition
  fade: {
    timeout: TOKEN_ANIMATIONS.fadeIn,
  },

  // Slide transition
  slide: {
    direction: 'down' as const,
    timeout: TOKEN_ANIMATIONS.slideIn,
  },

  // Grow transition
  grow: {
    timeout: TOKEN_ANIMATIONS.standard,
  },

  // Collapse transition
  collapse: {
    timeout: TOKEN_ANIMATIONS.standard,
  },
} as const;

/**
 * Alert Severity Colors (extended)
 */
export const TOKEN_ALERT_COLORS = {
  success: {
    bgcolor: TOKEN_STATUS_COLORS.active.bg,
    color: TOKEN_STATUS_COLORS.active.dark,
    iconColor: TOKEN_STATUS_COLORS.active.main,
  },
  warning: {
    bgcolor: TOKEN_STATUS_COLORS.warning.bg,
    color: TOKEN_STATUS_COLORS.warning.dark,
    iconColor: TOKEN_STATUS_COLORS.warning.main,
  },
  error: {
    bgcolor: TOKEN_STATUS_COLORS.urgent.bg,
    color: TOKEN_STATUS_COLORS.urgent.dark,
    iconColor: TOKEN_STATUS_COLORS.urgent.main,
  },
  info: {
    bgcolor: '#e3f2fd',
    color: '#1565c0',
    iconColor: '#2196f3',
  },
} as const;

/**
 * Responsive Breakpoints for Token Components
 */
export const TOKEN_RESPONSIVE = {
  // Mobile-first approach
  mobile: {
    buttonSize: 'large' as const,
    fullWidth: true,
    stackDirection: 'column' as const,
    cardPadding: 2,
  },

  // Tablet and above
  tablet: {
    buttonSize: 'medium' as const,
    fullWidth: false,
    stackDirection: 'row' as const,
    cardPadding: 3,
  },
} as const;

/**
 * Z-Index Layering for Token Components
 */
export const TOKEN_Z_INDEX = {
  banner: 1100,            // Top banner warnings
  dialog: 1300,            // Dialogs and modals
  snackbar: 1400,          // Success/error notifications
  tooltip: 1500,           // Tooltips (highest)
} as const;

/**
 * Helper function to get status color configuration
 */
export const getTokenStatusColor = (
  status: 'active' | 'warning' | 'urgent' | 'expired' | 'invalid'
) => {
  return TOKEN_STATUS_COLORS[status];
};

/**
 * Helper function to create consistent box shadows
 */
export const getTokenElevation = (level: number = 1) => {
  const elevations = {
    0: 'none',
    1: '0px 2px 4px rgba(0,0,0,0.1)',
    2: '0px 4px 8px rgba(0,0,0,0.12)',
    3: '0px 6px 12px rgba(0,0,0,0.15)',
    4: '0px 8px 16px rgba(0,0,0,0.18)',
    6: '0px 12px 24px rgba(0,0,0,0.22)',
  };
  return elevations[level as keyof typeof elevations] || elevations[1];
};

/**
 * Export all theme constants as a single object
 */
export const tokenTheme = {
  colors: TOKEN_STATUS_COLORS,
  spacing: TOKEN_UI_SPACING,
  animations: TOKEN_ANIMATIONS,
  typography: TOKEN_TYPOGRAPHY,
  cards: TOKEN_CARD_STYLES,
  iconButtons: TOKEN_ICON_BUTTON_STYLES,
  emptyState: TOKEN_EMPTY_STATE_CONFIG,
  skeleton: TOKEN_SKELETON_CONFIG,
  transitions: TOKEN_TRANSITIONS,
  alerts: TOKEN_ALERT_COLORS,
  responsive: TOKEN_RESPONSIVE,
  zIndex: TOKEN_Z_INDEX,
  helpers: {
    getStatusColor: getTokenStatusColor,
    getElevation: getTokenElevation,
  },
} as const;

export default tokenTheme;
