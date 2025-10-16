import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '../Dashboard';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { multiTokenManager } from '../../services/multiTokenManager';
import { tokenValidator } from '../../services/tokenValidator';
import { mockSiteTokens, mockValidationResults } from '../../test-utils/mockData';

jest.mock('../../services/multiTokenManager');
jest.mock('../../services/tokenValidator');

describe('Dashboard Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (multiTokenManager.getCurrentSiteId as jest.Mock).mockReturnValue('site1');
    (multiTokenManager.getCurrentToken as jest.Mock).mockResolvedValue(mockSiteTokens[0]);
    (multiTokenManager.getAllSiteTokens as jest.Mock).mockResolvedValue(
      new Map(mockSiteTokens.map(token => [token.siteId, token]))
    );
    (tokenValidator.validateToken as jest.Mock).mockReturnValue(mockValidationResults.valid);
  });

  describe('Initial Load', () => {
    it('displays current site in header', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/current site: main office/i)).toBeInTheDocument();
      });
    });

    it('shows site selector with all sites', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const selector = screen.getByTestId('dashboard-site-selector');
        expect(selector).toBeInTheDocument();

        const options = within(selector).getAllByRole('option');
        expect(options).toHaveLength(3);
        expect(options[0]).toHaveTextContent('Main Office');
        expect(options[1]).toHaveTextContent('Branch Office');
        expect(options[2]).toHaveTextContent('Remote Site');
      });
    });

    it('displays loading state initially', () => {
      renderWithProviders(<Dashboard />);

      expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
    });

    it('loads dashboard data for current site', async () => {
      const mockLoadData = jest.fn().mockResolvedValue({
        metrics: { visitors: 100, pageViews: 500 },
        charts: [],
      });

      renderWithProviders(<Dashboard onLoadData={mockLoadData} />);

      await waitFor(() => {
        expect(mockLoadData).toHaveBeenCalledWith('site1');
      });
    });
  });

  describe('Token Expiry Warnings', () => {
    it('displays TokenExpiryWarning when token expires soon', async () => {
      (tokenValidator.validateToken as jest.Mock).mockReturnValue(
        mockValidationResults.expiringSoon
      );

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/token expiring soon/i)).toBeInTheDocument();
        expect(screen.getByText(/5 days remaining/i)).toBeInTheDocument();
      });
    });

    it('shows critical warning for tokens expiring within 3 days', async () => {
      (tokenValidator.validateToken as jest.Mock).mockReturnValue({
        ...mockValidationResults.expiringSoon,
        daysUntilExpiry: 2,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const warning = screen.getByTestId('token-expiry-warning');
        expect(warning).toHaveClass('critical');
        expect(within(warning).getByText(/2 days remaining/i)).toBeInTheDocument();
      });
    });

    it('displays error banner for expired tokens', async () => {
      (tokenValidator.validateToken as jest.Mock).mockReturnValue(
        mockValidationResults.expired
      );

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/token has expired/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /update token/i })).toBeInTheDocument();
      });
    });

    it('navigates to settings when clicking update token', async () => {
      const user = userEvent.setup();
      (tokenValidator.validateToken as jest.Mock).mockReturnValue(
        mockValidationResults.expired
      );

      const { store } = renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /update token/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /update token/i }));

      // Should navigate to settings
      await waitFor(() => {
        expect(window.location.pathname).toBe('/settings');
      });
    });

    it('does not show warning for valid tokens with long expiry', async () => {
      (tokenValidator.validateToken as jest.Mock).mockReturnValue({
        ...mockValidationResults.valid,
        daysUntilExpiry: 300,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.queryByTestId('token-expiry-warning')).not.toBeInTheDocument();
      });
    });
  });

  describe('Site Switching', () => {
    it('switches site when selecting from dropdown', async () => {
      const user = userEvent.setup();
      const mockSetSite = jest.fn().mockResolvedValue(undefined);
      (multiTokenManager.setCurrentSite as jest.Mock) = mockSetSite;

      renderWithProviders(<Dashboard />);

      const selector = screen.getByTestId('dashboard-site-selector');
      await user.selectOptions(selector, 'site2');

      expect(mockSetSite).toHaveBeenCalledWith('site2');
    });

    it('reloads data when switching sites', async () => {
      const user = userEvent.setup();
      const mockLoadData = jest.fn().mockResolvedValue({});
      (multiTokenManager.setCurrentSite as jest.Mock).mockResolvedValue(undefined);
      (multiTokenManager.getCurrentSiteId as jest.Mock)
        .mockReturnValueOnce('site1')
        .mockReturnValueOnce('site2');

      renderWithProviders(<Dashboard onLoadData={mockLoadData} />);

      await waitFor(() => {
        expect(mockLoadData).toHaveBeenCalledWith('site1');
      });

      mockLoadData.mockClear();

      const selector = screen.getByTestId('dashboard-site-selector');
      await user.selectOptions(selector, 'site2');

      await waitFor(() => {
        expect(mockLoadData).toHaveBeenCalledWith('site2');
      });
    });

    it('shows loading state during site switch', async () => {
      const user = userEvent.setup();
      (multiTokenManager.setCurrentSite as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithProviders(<Dashboard />);

      const selector = screen.getByTestId('dashboard-site-selector');
      await user.selectOptions(selector, 'site2');

      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('maintains dashboard state during site switch', async () => {
      const user = userEvent.setup();

      renderWithProviders(<Dashboard />);

      // Expand a section
      const expandButton = screen.getByLabelText(/expand section/i);
      await user.click(expandButton);

      // Switch site
      const selector = screen.getByTestId('dashboard-site-selector');
      await user.selectOptions(selector, 'site2');

      await waitFor(() => {
        // Section should still be expanded
        expect(screen.getByTestId('expanded-section')).toBeInTheDocument();
      });
    });
  });

  describe('Data Refresh', () => {
    it('refreshes data when clicking refresh button', async () => {
      const user = userEvent.setup();
      const mockLoadData = jest.fn().mockResolvedValue({});

      renderWithProviders(<Dashboard onLoadData={mockLoadData} />);

      await waitFor(() => {
        expect(mockLoadData).toHaveBeenCalledTimes(1);
      });

      mockLoadData.mockClear();

      await user.click(screen.getByRole('button', { name: /refresh/i }));

      await waitFor(() => {
        expect(mockLoadData).toHaveBeenCalledTimes(1);
      });
    });

    it('displays last updated timestamp', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      });
    });

    it('auto-refreshes data every 5 minutes', async () => {
      jest.useFakeTimers();
      const mockLoadData = jest.fn().mockResolvedValue({});

      renderWithProviders(<Dashboard onLoadData={mockLoadData} autoRefresh={true} />);

      await waitFor(() => {
        expect(mockLoadData).toHaveBeenCalledTimes(1);
      });

      mockLoadData.mockClear();

      // Fast-forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(mockLoadData).toHaveBeenCalledTimes(1);
      });

      jest.useRealTimers();
    });

    it('pauses auto-refresh when tab is hidden', async () => {
      jest.useFakeTimers();
      const mockLoadData = jest.fn().mockResolvedValue({});

      renderWithProviders(<Dashboard onLoadData={mockLoadData} autoRefresh={true} />);

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      mockLoadData.mockClear();
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(mockLoadData).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when data load fails', async () => {
      const mockLoadData = jest.fn().mockRejectedValue(new Error('Network error'));

      renderWithProviders(<Dashboard onLoadData={mockLoadData} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      const user = userEvent.setup();
      const mockLoadData = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({});

      renderWithProviders(<Dashboard onLoadData={mockLoadData} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
      });
    });

    it('handles token validation errors gracefully', async () => {
      (tokenValidator.validateToken as jest.Mock).mockImplementation(() => {
        throw new Error('Validation error');
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/unable to validate token/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('collapses sidebar on mobile', async () => {
      // Mock mobile viewport
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const sidebar = screen.getByTestId('dashboard-sidebar');
        expect(sidebar).toHaveClass('collapsed');
      });
    });

    it('shows mobile menu button on small screens', async () => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));

      renderWithProviders(<Dashboard />);

      expect(screen.getByLabelText(/open menu/i)).toBeInTheDocument();
    });
  });
});
