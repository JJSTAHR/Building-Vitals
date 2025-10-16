/**
 * TokenLoadingSkeleton Component
 *
 * Professional loading skeletons for token-related UI components.
 * Provides visual feedback during async operations with smooth animations.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Grid,
  SxProps,
  Theme,
} from '@mui/material';
import { TOKEN_SKELETON_CONFIG, TOKEN_UI_SPACING } from '../../theme/tokenTheme';

/**
 * Base Skeleton Props
 */
interface BaseSkeletonProps {
  /** Number of skeleton items to display */
  count?: number;
  /** Custom styles */
  sx?: SxProps<Theme>;
}

/**
 * Token Card Skeleton
 * Loading skeleton for token cards
 */
export const TokenCardSkeleton: React.FC<BaseSkeletonProps> = ({
  count = 1,
  sx = {},
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          sx={{
            mb: TOKEN_UI_SPACING.cardGap,
            ...sx,
          }}
          className="token-fade-in token-stagger-item"
        >
          <CardContent>
            {/* Title */}
            <Skeleton
              variant="text"
              width={TOKEN_SKELETON_CONFIG.titleWidth}
              height={TOKEN_SKELETON_CONFIG.titleHeight}
              animation={TOKEN_SKELETON_CONFIG.animation}
              sx={{ mb: TOKEN_SKELETON_CONFIG.spacing }}
            />

            {/* Content */}
            <Skeleton
              variant="rectangular"
              width="100%"
              height={TOKEN_SKELETON_CONFIG.contentHeight}
              animation={TOKEN_SKELETON_CONFIG.animation}
              sx={{ borderRadius: 1, mb: TOKEN_SKELETON_CONFIG.spacing }}
            />

            {/* Footer with status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton
                variant="text"
                width={TOKEN_SKELETON_CONFIG.footerWidth}
                height={TOKEN_SKELETON_CONFIG.footerHeight}
                animation={TOKEN_SKELETON_CONFIG.animation}
              />
              <Skeleton
                variant="rounded"
                width={80}
                height={28}
                animation={TOKEN_SKELETON_CONFIG.animation}
              />
            </Box>
          </CardContent>
        </Card>
      ))}
    </>
  );
};

/**
 * Token List Item Skeleton
 * Compact skeleton for list views
 */
export const TokenListItemSkeleton: React.FC<BaseSkeletonProps> = ({
  count = 3,
  sx = {},
}) => {
  return (
    <Stack spacing={1} sx={sx}>
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
          className="token-fade-in token-stagger-item"
        >
          {/* Icon */}
          <Skeleton
            variant="circular"
            width={40}
            height={40}
            animation={TOKEN_SKELETON_CONFIG.animation}
          />

          {/* Content */}
          <Box sx={{ flex: 1 }}>
            <Skeleton
              variant="text"
              width="60%"
              height={24}
              animation={TOKEN_SKELETON_CONFIG.animation}
            />
            <Skeleton
              variant="text"
              width="40%"
              height={16}
              animation={TOKEN_SKELETON_CONFIG.animation}
            />
          </Box>

          {/* Status badge */}
          <Skeleton
            variant="rounded"
            width={90}
            height={28}
            animation={TOKEN_SKELETON_CONFIG.animation}
          />
        </Box>
      ))}
    </Stack>
  );
};

/**
 * Token Settings Skeleton
 * Loading skeleton for settings page
 */
export const TokenSettingsSkeleton: React.FC<{ sx?: SxProps<Theme> }> = ({ sx = {} }) => {
  return (
    <Box sx={sx}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Skeleton
          variant="text"
          width="50%"
          height={40}
          animation={TOKEN_SKELETON_CONFIG.animation}
          sx={{ mb: 1 }}
        />
        <Skeleton
          variant="text"
          width="70%"
          height={24}
          animation={TOKEN_SKELETON_CONFIG.animation}
        />
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[1, 2, 3, 4].map((index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card className="token-fade-in token-stagger-item">
              <CardContent>
                <Skeleton
                  variant="text"
                  width="60%"
                  height={20}
                  animation={TOKEN_SKELETON_CONFIG.animation}
                  sx={{ mb: 1 }}
                />
                <Skeleton
                  variant="text"
                  width="40%"
                  height={36}
                  animation={TOKEN_SKELETON_CONFIG.animation}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Token Cards */}
      <TokenCardSkeleton count={2} />
    </Box>
  );
};

/**
 * Token Dialog Skeleton
 * Loading skeleton for dialogs
 */
export const TokenDialogSkeleton: React.FC = () => {
  return (
    <Box sx={{ p: 2 }}>
      {/* Title */}
      <Skeleton
        variant="text"
        width="60%"
        height={32}
        animation={TOKEN_SKELETON_CONFIG.animation}
        sx={{ mb: 3 }}
      />

      {/* Form fields */}
      <Stack spacing={3}>
        {[1, 2, 3].map((index) => (
          <Box key={index}>
            <Skeleton
              variant="text"
              width="30%"
              height={20}
              animation={TOKEN_SKELETON_CONFIG.animation}
              sx={{ mb: 1 }}
            />
            <Skeleton
              variant="rectangular"
              width="100%"
              height={56}
              animation={TOKEN_SKELETON_CONFIG.animation}
              sx={{ borderRadius: 1 }}
            />
          </Box>
        ))}
      </Stack>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
        <Skeleton
          variant="rounded"
          width={100}
          height={36}
          animation={TOKEN_SKELETON_CONFIG.animation}
        />
        <Skeleton
          variant="rounded"
          width={120}
          height={36}
          animation={TOKEN_SKELETON_CONFIG.animation}
        />
      </Box>
    </Box>
  );
};

/**
 * Token Status Badge Skeleton
 * Skeleton for status badges
 */
export const TokenStatusBadgeSkeleton: React.FC<{
  size?: 'small' | 'medium';
}> = ({ size = 'medium' }) => {
  const height = size === 'small' ? 24 : 32;
  const width = size === 'small' ? 80 : 100;

  return (
    <Skeleton
      variant="rounded"
      width={width}
      height={height}
      animation={TOKEN_SKELETON_CONFIG.animation}
      sx={{ borderRadius: 2 }}
    />
  );
};

/**
 * Token Table Skeleton
 * Loading skeleton for token tables
 */
export const TokenTableSkeleton: React.FC<{
  rows?: number;
  sx?: SxProps<Theme>;
}> = ({ rows = 5, sx = {} }) => {
  return (
    <Box sx={sx}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          mb: 1,
        }}
      >
        {[40, 30, 20, 10].map((width, index) => (
          <Skeleton
            key={index}
            variant="text"
            width={`${width}%`}
            height={24}
            animation={TOKEN_SKELETON_CONFIG.animation}
          />
        ))}
      </Box>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            gap: 2,
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
          className="token-fade-in token-stagger-item"
        >
          <Skeleton
            variant="text"
            width="40%"
            height={20}
            animation={TOKEN_SKELETON_CONFIG.animation}
          />
          <Skeleton
            variant="text"
            width="30%"
            height={20}
            animation={TOKEN_SKELETON_CONFIG.animation}
          />
          <Skeleton
            variant="rounded"
            width="20%"
            height={28}
            animation={TOKEN_SKELETON_CONFIG.animation}
          />
          <Box sx={{ width: '10%', display: 'flex', gap: 1 }}>
            <Skeleton
              variant="circular"
              width={28}
              height={28}
              animation={TOKEN_SKELETON_CONFIG.animation}
            />
            <Skeleton
              variant="circular"
              width={28}
              height={28}
              animation={TOKEN_SKELETON_CONFIG.animation}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

/**
 * Inline Skeleton
 * Small inline skeleton for buttons/badges
 */
export const InlineSkeleton: React.FC<{
  width?: number | string;
  height?: number;
}> = ({ width = 100, height = 20 }) => {
  return (
    <Skeleton
      variant="text"
      width={width}
      height={height}
      animation={TOKEN_SKELETON_CONFIG.animation}
      sx={{ display: 'inline-block' }}
    />
  );
};

/**
 * Shimmer Box
 * Generic shimmer effect container
 */
export const ShimmerBox: React.FC<{
  width?: string | number;
  height?: number;
  variant?: 'text' | 'rectangular' | 'rounded' | 'circular';
  sx?: SxProps<Theme>;
}> = ({
  width = '100%',
  height = 40,
  variant = 'rectangular',
  sx = {},
}) => {
  return (
    <Skeleton
      variant={variant}
      width={width}
      height={height}
      animation={TOKEN_SKELETON_CONFIG.animation}
      sx={{ borderRadius: variant === 'rounded' ? 1 : undefined, ...sx }}
    />
  );
};

/**
 * Export all skeleton components
 */
export default {
  TokenCardSkeleton,
  TokenListItemSkeleton,
  TokenSettingsSkeleton,
  TokenDialogSkeleton,
  TokenStatusBadgeSkeleton,
  TokenTableSkeleton,
  InlineSkeleton,
  ShimmerBox,
};
