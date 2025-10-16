import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TokenExpiryWarning } from '../TokenExpiryWarning';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { mockValidationResults } from '../../test-utils/mockData';

describe('TokenExpiryWarning Integration', () => {
  const mockOnDismiss = jest.fn();
  const mockOnUpdateToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Display Conditions', () => {
    it('displays when token expires within 7 days', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/token expiring soon/i)).toBeInTheDocument();
      expect(screen.getByText(/5 days remaining/i)).toBeInTheDocument();
    });

    it('does not display for valid tokens with long expiry', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={{
            ...mockValidationResults.valid,
            daysUntilExpiry: 300,
          }}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.queryByTestId('token-expiry-warning')).not.toBeInTheDocument();
    });

    it('displays for expired tokens', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expired}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/token has expired/i)).toBeInTheDocument();
    });

    it('does not display when dismissed', () => {
      const { rerender } = renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
          dismissed={true}
        />
      );

      expect(screen.queryByTestId('token-expiry-warning')).not.toBeInTheDocument();
    });
  });

  describe('Severity Levels', () => {
    it('shows info level for 7+ days remaining', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={{
            ...mockValidationResults.expiringSoon,
            daysUntilExpiry: 7,
          }}
          onDismiss={mockOnDismiss}
        />
      );

      const warning = screen.getByTestId('token-expiry-warning');
      expect(warning).toHaveAttribute('data-severity', 'info');
    });

    it('shows warning level for 3-6 days remaining', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={{
            ...mockValidationResults.expiringSoon,
            daysUntilExpiry: 5,
          }}
          onDismiss={mockOnDismiss}
        />
      );

      const warning = screen.getByTestId('token-expiry-warning');
      expect(warning).toHaveAttribute('data-severity', 'warning');
    });

    it('shows error level for less than 3 days remaining', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={{
            ...mockValidationResults.expiringSoon,
            daysUntilExpiry: 2,
          }}
          onDismiss={mockOnDismiss}
        />
      );

      const warning = screen.getByTestId('token-expiry-warning');
      expect(warning).toHaveAttribute('data-severity', 'error');
    });

    it('shows critical level for expired tokens', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expired}
          onDismiss={mockOnDismiss}
        />
      );

      const warning = screen.getByTestId('token-expiry-warning');
      expect(warning).toHaveAttribute('data-severity', 'critical');
    });
  });

  describe('User Interactions', () => {
    it('dismisses warning when clicking dismiss button', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
        />
      );

      await user.click(screen.getByLabelText(/dismiss/i));

      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('navigates to update token when clicking action button', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
          onUpdateToken={mockOnUpdateToken}
        />
      );

      await user.click(screen.getByRole('button', { name: /update token/i }));

      expect(mockOnUpdateToken).toHaveBeenCalled();
    });

    it('shows countdown timer for urgent warnings', () => {
      jest.useFakeTimers();
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      renderWithProviders(
        <TokenExpiryWarning
          validation={{
            ...mockValidationResults.expiringSoon,
            daysUntilExpiry: 2,
            expiresAt,
          }}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();

      jest.useRealTimers();
    });

    it('allows snoozing warning for 24 hours', async () => {
      const user = userEvent.setup();
      const mockOnSnooze = jest.fn();

      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
          onSnooze={mockOnSnooze}
        />
      );

      await user.click(screen.getByRole('button', { name: /remind me later/i }));

      expect(mockOnSnooze).toHaveBeenCalledWith(24); // 24 hours
    });
  });

  describe('Message Content', () => {
    it('displays appropriate message for days remaining', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={{
            ...mockValidationResults.expiringSoon,
            daysUntilExpiry: 3,
          }}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/your token will expire in 3 days/i)).toBeInTheDocument();
    });

    it('displays singular day for 1 day remaining', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={{
            ...mockValidationResults.expiringSoon,
            daysUntilExpiry: 1,
          }}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/1 day remaining/i)).toBeInTheDocument();
    });

    it('shows hours for less than 24 hours', () => {
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

      renderWithProviders(
        <TokenExpiryWarning
          validation={{
            ...mockValidationResults.expiringSoon,
            daysUntilExpiry: 0,
            expiresAt,
          }}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/12 hours remaining/i)).toBeInTheDocument();
    });

    it('displays site name when provided', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          siteName="Main Office"
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/main office/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate ARIA role and label', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
        />
      );

      const warning = screen.getByRole('alert');
      expect(warning).toHaveAttribute('aria-live', 'polite');
    });

    it('marks critical warnings as assertive', () => {
      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expired}
          onDismiss={mockOnDismiss}
        />
      );

      const warning = screen.getByRole('alert');
      expect(warning).toHaveAttribute('aria-live', 'assertive');
    });

    it('has keyboard accessible dismiss button', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
        />
      );

      const dismissButton = screen.getByLabelText(/dismiss/i);
      dismissButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnDismiss).toHaveBeenCalled();
    });
  });

  describe('Animation and Transitions', () => {
    it('animates entrance', () => {
      const { container } = renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
        />
      );

      const warning = container.querySelector('[data-testid="token-expiry-warning"]');
      expect(warning).toHaveClass('animate-slide-in');
    });

    it('animates exit when dismissed', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          onDismiss={mockOnDismiss}
        />
      );

      await user.click(screen.getByLabelText(/dismiss/i));

      const warning = screen.getByTestId('token-expiry-warning');
      expect(warning).toHaveClass('animate-slide-out');
    });
  });

  describe('Persistence', () => {
    it('persists dismiss state to localStorage', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          siteId="site1"
          onDismiss={mockOnDismiss}
        />
      );

      await user.click(screen.getByLabelText(/dismiss/i));

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'tokenWarningDismissed-site1',
        expect.any(String)
      );
    });

    it('respects persisted dismiss state', () => {
      localStorage.getItem = jest.fn().mockReturnValue(
        JSON.stringify({ dismissedAt: Date.now(), duration: 24 * 60 * 60 * 1000 })
      );

      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          siteId="site1"
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.queryByTestId('token-expiry-warning')).not.toBeInTheDocument();
    });

    it('shows warning again after snooze duration expires', () => {
      const expiredSnooze = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      localStorage.getItem = jest.fn().mockReturnValue(
        JSON.stringify({ dismissedAt: expiredSnooze, duration: 24 * 60 * 60 * 1000 })
      );

      renderWithProviders(
        <TokenExpiryWarning
          validation={mockValidationResults.expiringSoon}
          siteId="site1"
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByTestId('token-expiry-warning')).toBeInTheDocument();
    });
  });
});
