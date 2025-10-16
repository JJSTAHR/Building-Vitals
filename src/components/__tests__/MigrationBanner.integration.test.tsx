import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MigrationBanner } from '../MigrationBanner';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { tokenMigrationService } from '../../services/tokenMigrationService';
import { mockMigrationStatus, mockUsers } from '../../test-utils/mockData';

jest.mock('../../services/tokenMigrationService');

describe('MigrationBanner Integration', () => {
  const mockOnMigrationComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (tokenMigrationService.checkMigrationStatus as jest.Mock).mockResolvedValue(
      mockMigrationStatus.needsMigration
    );
    (tokenMigrationService.migrateUser as jest.Mock).mockResolvedValue({
      success: true,
      migratedTokens: 3,
    });
  });

  describe('Display Conditions', () => {
    it('displays when user needs migration', async () => {
      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      expect(screen.getByText(/migrate to new token system/i)).toBeInTheDocument();
    });

    it('does not display when user has migrated', () => {
      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.migrated}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      expect(screen.queryByTestId('migration-banner')).not.toBeInTheDocument();
    });

    it('does not display when no migration needed', () => {
      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.noMigration}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      expect(screen.queryByTestId('migration-banner')).not.toBeInTheDocument();
    });

    it('displays after checking migration status', async () => {
      renderWithProviders(
        <MigrationBanner
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await waitFor(() => {
        expect(tokenMigrationService.checkMigrationStatus).toHaveBeenCalledWith(
          mockUsers.standard.id
        );
        expect(screen.getByTestId('migration-banner')).toBeInTheDocument();
      });
    });
  });

  describe('Migration Process', () => {
    it('migrates user on button click', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /migrate now/i }));

      await waitFor(() => {
        expect(tokenMigrationService.migrateUser).toHaveBeenCalledWith(
          mockUsers.standard.id
        );
        expect(mockOnMigrationComplete).toHaveBeenCalled();
      });
    });

    it('shows loading state during migration', async () => {
      const user = userEvent.setup();
      (tokenMigrationService.migrateUser as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /migrate now/i }));

      expect(screen.getByTestId('migration-loading')).toBeInTheDocument();
      expect(screen.getByText(/migrating/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('migration-loading')).not.toBeInTheDocument();
      });
    });

    it('displays progress during migration', async () => {
      const user = userEvent.setup();
      let progressCallback: ((progress: number) => void) | undefined;

      (tokenMigrationService.migrateUser as jest.Mock).mockImplementation(
        (userId, onProgress) => {
          progressCallback = onProgress;
          return new Promise(resolve => {
            setTimeout(() => {
              progressCallback?.(50);
              setTimeout(() => {
                progressCallback?.(100);
                resolve({ success: true });
              }, 50);
            }, 50);
          });
        }
      );

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /migrate now/i }));

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      });

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      });
    });

    it('displays success message after migration', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /migrate now/i }));

      await waitFor(() => {
        expect(screen.getByText(/migration complete/i)).toBeInTheDocument();
        expect(screen.getByText(/3 tokens migrated/i)).toBeInTheDocument();
      });
    });

    it('handles migration errors gracefully', async () => {
      const user = userEvent.setup();
      (tokenMigrationService.migrateUser as jest.Mock).mockRejectedValue(
        new Error('Migration failed')
      );

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /migrate now/i }));

      await waitFor(() => {
        expect(screen.getByText(/migration failed/i)).toBeInTheDocument();
        expect(mockOnMigrationComplete).not.toHaveBeenCalled();
      });
    });

    it('allows retry after error', async () => {
      const user = userEvent.setup();
      (tokenMigrationService.migrateUser as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, migratedTokens: 3 });

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /migrate now/i }));

      await waitFor(() => {
        expect(screen.getByText(/migration failed/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /try again/i }));

      await waitFor(() => {
        expect(screen.getByText(/migration complete/i)).toBeInTheDocument();
        expect(mockOnMigrationComplete).toHaveBeenCalled();
      });
    });
  });

  describe('User Information', () => {
    it('explains what migration does', () => {
      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      expect(screen.getByText(/upgrade to multi-site token management/i)).toBeInTheDocument();
    });

    it('shows benefits of migration', () => {
      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      expect(screen.getByText(/manage multiple sites/i)).toBeInTheDocument();
      expect(screen.getByText(/improved security/i)).toBeInTheDocument();
    });

    it('displays migration FAQ link', () => {
      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      const faqLink = screen.getByRole('link', { name: /learn more/i });
      expect(faqLink).toHaveAttribute('href', expect.stringContaining('/migration-faq'));
    });

    it('shows warning about data backup', () => {
      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      expect(screen.getByText(/existing token will be preserved/i)).toBeInTheDocument();
    });
  });

  describe('Dismissal', () => {
    it('allows dismissing banner temporarily', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByLabelText(/dismiss/i));

      expect(screen.queryByTestId('migration-banner')).not.toBeInTheDocument();
    });

    it('persists dismissal to localStorage', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByLabelText(/dismiss/i));

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `migrationBannerDismissed-${mockUsers.standard.id}`,
        expect.any(String)
      );
    });

    it('respects dismissal for 7 days', () => {
      const dismissedAt = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
      localStorage.getItem = jest.fn().mockReturnValue(
        JSON.stringify({ dismissedAt })
      );

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      expect(screen.queryByTestId('migration-banner')).not.toBeInTheDocument();
    });

    it('shows banner again after dismissal expires', () => {
      const dismissedAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      localStorage.getItem = jest.fn().mockReturnValue(
        JSON.stringify({ dismissedAt })
      );

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      expect(screen.getByTestId('migration-banner')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate ARIA attributes', () => {
      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      const banner = screen.getByRole('region');
      expect(banner).toHaveAttribute('aria-label', /migration notice/i);
    });

    it('announces migration completion', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /migrate now/i }));

      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/migration complete/i);
      });
    });

    it('has keyboard accessible actions', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MigrationBanner
          migrationStatus={mockMigrationStatus.needsMigration}
          userId={mockUsers.standard.id}
          onMigrationComplete={mockOnMigrationComplete}
        />
      );

      const migrateButton = screen.getByRole('button', { name: /migrate now/i });
      migrateButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(tokenMigrationService.migrateUser).toHaveBeenCalled();
      });
    });
  });
});
