import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddTokenDialog } from '../AddTokenDialog';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { tokenValidator } from '../../services/tokenValidator';
import { multiTokenManager } from '../../services/multiTokenManager';
import { VALID_JWT, INVALID_JWT, mockValidationResults } from '../../test-utils/mockData';

jest.mock('../../services/tokenValidator');
jest.mock('../../services/multiTokenManager');

describe('AddTokenDialog Integration', () => {
  const mockOnClose = jest.fn();
  const mockOnTokenAdded = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (tokenValidator.validateToken as jest.Mock).mockReturnValue(mockValidationResults.valid);
    (multiTokenManager.addToken as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Dialog Display', () => {
    it('renders when open prop is true', () => {
      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/add new token/i)).toBeInTheDocument();
    });

    it('does not render when open prop is false', () => {
      renderWithProviders(
        <AddTokenDialog open={false} onClose={mockOnClose} />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays all required form fields', () => {
      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      expect(screen.getByLabelText(/site id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/token/i)).toBeInTheDocument();
    });

    it('shows helper text for each field', () => {
      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      expect(screen.getByText(/unique identifier for the site/i)).toBeInTheDocument();
      expect(screen.getByText(/friendly name for display/i)).toBeInTheDocument();
      expect(screen.getByText(/jwt token from analytics platform/i)).toBeInTheDocument();
    });
  });

  describe('Real-time Token Validation', () => {
    it('validates token in real-time', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.fn().mockReturnValue(mockValidationResults.invalid);
      (tokenValidator.validateToken as jest.Mock) = mockValidate;

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      const tokenInput = screen.getByLabelText(/token/i);
      await user.type(tokenInput, INVALID_JWT);

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledWith(INVALID_JWT);
        expect(screen.getByText(/invalid token format/i)).toBeInTheDocument();
      });
    });

    it('shows success indicator for valid token', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/token/i), VALID_JWT);

      await waitFor(() => {
        expect(screen.getByTestId('valid-token-indicator')).toBeInTheDocument();
        expect(screen.getByText(/valid token/i)).toBeInTheDocument();
      });
    });

    it('displays token expiry information', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/token/i), VALID_JWT);

      await waitFor(() => {
        expect(screen.getByText(/expires in 300 days/i)).toBeInTheDocument();
      });
    });

    it('warns about tokens expiring soon', async () => {
      const user = userEvent.setup();
      (tokenValidator.validateToken as jest.Mock).mockReturnValue(
        mockValidationResults.expiringSoon
      );

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/token/i), VALID_JWT);

      await waitFor(() => {
        expect(screen.getByText(/warning: token expires in 5 days/i)).toBeInTheDocument();
      });
    });

    it('rejects expired tokens', async () => {
      const user = userEvent.setup();
      (tokenValidator.validateToken as jest.Mock).mockReturnValue(
        mockValidationResults.expired
      );

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/token/i), VALID_JWT);

      await waitFor(() => {
        expect(screen.getByText(/token has expired/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add token/i })).toBeDisabled();
      });
    });

    it('debounces validation requests', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.fn().mockReturnValue(mockValidationResults.valid);
      (tokenValidator.validateToken as jest.Mock) = mockValidate;

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      const tokenInput = screen.getByLabelText(/token/i);

      // Type quickly
      await user.type(tokenInput, 'abc', { delay: 10 });

      // Should only validate once after debounce
      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Form Validation', () => {
    it('validates site ID format', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      const siteIdInput = screen.getByLabelText(/site id/i);
      await user.type(siteIdInput, 'invalid site!@#');
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByText(/site id can only contain letters, numbers, and underscores/i))
          .toBeInTheDocument();
      });
    });

    it('requires all fields to be filled', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      const submitButton = screen.getByRole('button', { name: /add token/i });
      expect(submitButton).toBeDisabled();

      await user.type(screen.getByLabelText(/site id/i), 'site1');
      expect(submitButton).toBeDisabled();

      await user.type(screen.getByLabelText(/site name/i), 'Site 1');
      expect(submitButton).toBeDisabled();

      await user.type(screen.getByLabelText(/token/i), VALID_JWT);

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('validates site name length', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      const siteNameInput = screen.getByLabelText(/site name/i);
      await user.type(siteNameInput, 'x'.repeat(101));
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/site name must be less than 100 characters/i))
          .toBeInTheDocument();
      });
    });

    it('checks for duplicate site IDs', async () => {
      const user = userEvent.setup();
      (multiTokenManager.getAllSiteTokens as jest.Mock).mockResolvedValue(
        new Map([['existing_site', {}]])
      );

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/site id/i), 'existing_site');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/site id already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Token Addition', () => {
    it('adds token successfully', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog
          open={true}
          onClose={mockOnClose}
          onTokenAdded={mockOnTokenAdded}
        />
      );

      await user.type(screen.getByLabelText(/site id/i), 'new_site');
      await user.type(screen.getByLabelText(/site name/i), 'New Site');
      await user.type(screen.getByLabelText(/token/i), VALID_JWT);

      await user.click(screen.getByRole('button', { name: /add token/i }));

      await waitFor(() => {
        expect(multiTokenManager.addToken).toHaveBeenCalledWith(
          'new_site',
          VALID_JWT,
          'New Site'
        );
        expect(mockOnTokenAdded).toHaveBeenCalledWith('new_site');
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('displays loading state during submission', async () => {
      const user = userEvent.setup();
      (multiTokenManager.addToken as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/site id/i), 'new_site');
      await user.type(screen.getByLabelText(/site name/i), 'New Site');
      await user.type(screen.getByLabelText(/token/i), VALID_JWT);

      await user.click(screen.getByRole('button', { name: /add token/i }));

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });
    });

    it('shows success message after adding', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/site id/i), 'new_site');
      await user.type(screen.getByLabelText(/site name/i), 'New Site');
      await user.type(screen.getByLabelText(/token/i), VALID_JWT);
      await user.click(screen.getByRole('button', { name: /add token/i }));

      await waitFor(() => {
        expect(screen.getByText(/token added successfully/i)).toBeInTheDocument();
      });
    });

    it('handles addition errors gracefully', async () => {
      const user = userEvent.setup();
      (multiTokenManager.addToken as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/site id/i), 'new_site');
      await user.type(screen.getByLabelText(/site name/i), 'New Site');
      await user.type(screen.getByLabelText(/token/i), VALID_JWT);
      await user.click(screen.getByRole('button', { name: /add token/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to add token/i)).toBeInTheDocument();
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });
  });

  describe('Dialog Interactions', () => {
    it('closes dialog on cancel', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
      expect(multiTokenManager.addToken).not.toHaveBeenCalled();
    });

    it('closes dialog on escape key', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('resets form when dialog closes', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      await user.type(screen.getByLabelText(/site id/i), 'test');
      await user.type(screen.getByLabelText(/site name/i), 'Test Site');

      // Close dialog
      rerender(<AddTokenDialog open={false} onClose={mockOnClose} />);

      // Reopen dialog
      rerender(<AddTokenDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText(/site id/i)).toHaveValue('');
      expect(screen.getByLabelText(/site name/i)).toHaveValue('');
    });

    it('focuses first field when dialog opens', () => {
      renderWithProviders(
        <AddTokenDialog open={true} onClose={mockOnClose} />
      );

      expect(screen.getByLabelText(/site id/i)).toHaveFocus();
    });
  });
});
