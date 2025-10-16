import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '../Settings';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { multiTokenManager } from '../../services/multiTokenManager';
import { tokenValidator } from '../../services/tokenValidator';
import { mockSiteTokens, VALID_JWT, mockValidationResults } from '../../test-utils/mockData';

// Mock services
jest.mock('../../services/multiTokenManager');
jest.mock('../../services/tokenValidator');

describe('Settings Page Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (multiTokenManager.getAllSiteTokens as jest.Mock).mockResolvedValue(
      new Map(mockSiteTokens.map(token => [token.siteId, token]))
    );
    (multiTokenManager.getCurrentSiteId as jest.Mock).mockReturnValue('site1');
    (tokenValidator.validateToken as jest.Mock).mockReturnValue(mockValidationResults.valid);
  });

  describe('Initial Load', () => {
    it('loads and displays all site tokens', async () => {
      renderWithProviders(<Settings />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      // Check all tokens are displayed
      expect(screen.getByText('Main Office')).toBeInTheDocument();
      expect(screen.getByText('Branch Office')).toBeInTheDocument();
      expect(screen.getByText('Remote Site')).toBeInTheDocument();
    });

    it('displays current active site indicator', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        const activeSite = screen.getByTestId('active-site-indicator');
        expect(within(activeSite).getByText('Main Office')).toBeInTheDocument();
      });
    });

    it('shows token count in header', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/3 sites configured/i)).toBeInTheDocument();
      });
    });

    it('displays empty state when no tokens exist', async () => {
      (multiTokenManager.getAllSiteTokens as jest.Mock).mockResolvedValue(new Map());

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/no tokens configured/i)).toBeInTheDocument();
        expect(screen.getByText(/add your first token/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Token Dialog', () => {
    it('opens AddTokenDialog when clicking Add button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      const addButton = screen.getByRole('button', { name: /add token/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/site id/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/token/i)).toBeInTheDocument();
      });
    });

    it('adds new token successfully', async () => {
      const user = userEvent.setup();
      const mockAdd = jest.fn().mockResolvedValue(undefined);
      (multiTokenManager.addToken as jest.Mock) = mockAdd;

      renderWithProviders(<Settings />);

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add token/i }));

      // Fill form
      await user.type(screen.getByLabelText(/site id/i), 'new_site');
      await user.type(screen.getByLabelText(/site name/i), 'New Site');
      await user.type(screen.getByLabelText(/token/i), VALID_JWT);

      // Submit
      await user.click(screen.getByRole('button', { name: /add token/i }));

      await waitFor(() => {
        expect(mockAdd).toHaveBeenCalledWith(
          'new_site',
          VALID_JWT,
          'New Site'
        );
        expect(screen.getByText(/token added successfully/i)).toBeInTheDocument();
      });
    });

    it('validates token before adding', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.fn().mockReturnValue(mockValidationResults.invalid);
      (tokenValidator.validateToken as jest.Mock) = mockValidate;

      renderWithProviders(<Settings />);

      await user.click(screen.getByRole('button', { name: /add token/i }));
      await user.type(screen.getByLabelText(/token/i), 'invalid_token');

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledWith('invalid_token');
        expect(screen.getByText(/invalid token/i)).toBeInTheDocument();
      });

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /add token/i });
      expect(submitButton).toBeDisabled();
    });

    it('closes dialog without adding on cancel', async () => {
      const user = userEvent.setup();
      const mockAdd = jest.fn();
      (multiTokenManager.addToken as jest.Mock) = mockAdd;

      renderWithProviders(<Settings />);

      await user.click(screen.getByRole('button', { name: /add token/i }));
      await user.type(screen.getByLabelText(/site id/i), 'test');

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mockAdd).not.toHaveBeenCalled();
      });
    });

    it('prevents duplicate site IDs', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await user.click(screen.getByRole('button', { name: /add token/i }));
      await user.type(screen.getByLabelText(/site id/i), 'site1'); // Existing site

      await waitFor(() => {
        expect(screen.getByText(/site id already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Delete Token', () => {
    it('deletes token after confirmation', async () => {
      const user = userEvent.setup();
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      (multiTokenManager.removeToken as jest.Mock) = mockRemove;

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Main Office')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByLabelText(/delete token/i);
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmDialog = screen.getByRole('dialog');
      const confirmButton = within(confirmDialog).getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockRemove).toHaveBeenCalledWith('site1');
        expect(screen.getByText(/token deleted/i)).toBeInTheDocument();
      });
    });

    it('cancels deletion on cancel', async () => {
      const user = userEvent.setup();
      const mockRemove = jest.fn();
      (multiTokenManager.removeToken as jest.Mock) = mockRemove;

      renderWithProviders(<Settings />);

      const deleteButtons = screen.getAllByLabelText(/delete token/i);
      await user.click(deleteButtons[0]);

      // Cancel deletion
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockRemove).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('prevents deleting the last token', async () => {
      const user = userEvent.setup();
      (multiTokenManager.getAllSiteTokens as jest.Mock).mockResolvedValue(
        new Map([[mockSiteTokens[0].siteId, mockSiteTokens[0]]])
      );

      renderWithProviders(<Settings />);

      const deleteButton = screen.getByLabelText(/delete token/i);
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot delete the last token/i)).toBeInTheDocument();
      });
    });

    it('switches to another site after deleting current site', async () => {
      const user = userEvent.setup();
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      const mockSetCurrent = jest.fn().mockResolvedValue(undefined);
      (multiTokenManager.removeToken as jest.Mock) = mockRemove;
      (multiTokenManager.setCurrentSite as jest.Mock) = mockSetCurrent;

      renderWithProviders(<Settings />);

      // Delete current site (site1)
      const deleteButtons = screen.getAllByLabelText(/delete token/i);
      await user.click(deleteButtons[0]);
      await user.click(screen.getByRole('button', { name: /confirm/i }));

      await waitFor(() => {
        expect(mockRemove).toHaveBeenCalledWith('site1');
        expect(mockSetCurrent).toHaveBeenCalledWith('site2'); // Next available site
      });
    });
  });

  describe('Site Switching', () => {
    it('switches current site via selector', async () => {
      const user = userEvent.setup();
      const mockSetSite = jest.fn().mockResolvedValue(undefined);
      (multiTokenManager.setCurrentSite as jest.Mock) = mockSetSite;

      renderWithProviders(<Settings />);

      const selector = screen.getByLabelText(/select active site/i);
      await user.selectOptions(selector, 'site2');

      expect(mockSetSite).toHaveBeenCalledWith('site2');
    });

    it('updates UI after site switch', async () => {
      const user = userEvent.setup();
      (multiTokenManager.setCurrentSite as jest.Mock).mockResolvedValue(undefined);
      (multiTokenManager.getCurrentSiteId as jest.Mock)
        .mockReturnValueOnce('site1')
        .mockReturnValueOnce('site2');

      renderWithProviders(<Settings />);

      const selector = screen.getByLabelText(/select active site/i);
      await user.selectOptions(selector, 'site2');

      await waitFor(() => {
        const activeSite = screen.getByTestId('active-site-indicator');
        expect(within(activeSite).getByText('Branch Office')).toBeInTheDocument();
      });
    });

    it('displays loading state during site switch', async () => {
      const user = userEvent.setup();
      const mockSetSite = jest.fn(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      );
      (multiTokenManager.setCurrentSite as jest.Mock) = mockSetSite;

      renderWithProviders(<Settings />);

      const selector = screen.getByLabelText(/select active site/i);
      await user.selectOptions(selector, 'site2');

      expect(screen.getByText(/switching site/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/switching site/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Token Expiry Warnings', () => {
    it('displays warning for expiring tokens', async () => {
      (tokenValidator.validateToken as jest.Mock).mockImplementation((token) => {
        if (token === mockSiteTokens[2].token) {
          return mockValidationResults.expiringSoon;
        }
        return mockValidationResults.valid;
      });

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/expiring soon/i)).toBeInTheDocument();
      });
    });

    it('highlights expired tokens', async () => {
      (tokenValidator.validateToken as jest.Mock).mockImplementation((token) => {
        if (token === mockSiteTokens[2].token) {
          return mockValidationResults.expired;
        }
        return mockValidationResults.valid;
      });

      renderWithProviders(<Settings />);

      await waitFor(() => {
        const expiredRow = screen.getByTestId('token-row-site3');
        expect(expiredRow).toHaveClass('expired');
        expect(within(expiredRow).getByText(/expired/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when failing to load tokens', async () => {
      (multiTokenManager.getAllSiteTokens as jest.Mock).mockRejectedValue(
        new Error('Failed to load tokens')
      );

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load tokens/i)).toBeInTheDocument();
      });
    });

    it('shows error when adding token fails', async () => {
      const user = userEvent.setup();
      (multiTokenManager.addToken as jest.Mock).mockRejectedValue(
        new Error('Failed to add token')
      );

      renderWithProviders(<Settings />);

      await user.click(screen.getByRole('button', { name: /add token/i }));
      await user.type(screen.getByLabelText(/site id/i), 'new_site');
      await user.type(screen.getByLabelText(/token/i), VALID_JWT);
      await user.click(screen.getByRole('button', { name: /add token/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to add token/i)).toBeInTheDocument();
      });
    });

    it('allows retry after error', async () => {
      const user = userEvent.setup();
      (multiTokenManager.getAllSiteTokens as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Map(mockSiteTokens.map(t => [t.siteId, t])));

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load tokens/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('Main Office')).toBeInTheDocument();
      });
    });
  });
});
