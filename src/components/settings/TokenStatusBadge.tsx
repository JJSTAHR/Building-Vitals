/**
 * Re-export TokenStatusBadge from canonical location
 *
 * This file maintains backwards compatibility for imports from the settings directory.
 * The canonical implementation is located at src/components/TokenStatusBadge.tsx
 */

export { TokenStatusBadge, type TokenStatusBadgeProps } from '../TokenStatusBadge';
export default TokenStatusBadge;
