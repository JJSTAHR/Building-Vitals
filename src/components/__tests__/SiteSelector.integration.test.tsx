import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteSelector } from '../SiteSelector';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { multiTokenManager } from '../../services/multiTokenManager';
import { mockSiteTokens } from '../../test-utils/mockData';

jest.mock('../../services/multiTokenManager');

describe('SiteSelector Integration', () => {
  const mockOnSiteChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (multiTokenManager.getAllSiteTokens as jest.Mock).mockResolvedValue(
      new Map(mockSiteTokens.map(token => [token.siteId, token]))
    );
    (multiTokenManager.getCurrentSiteId as jest.Mock).mockReturnValue('site1');
    (multiTokenManager.setCurrentSite as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Display', () => {
    it('renders selector with all sites', async () => {
      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      await waitFor(() => {
        const selector = screen.getByRole('combobox');
        expect(selector).toBeInTheDocument();

        const options = within(selector).getAllByRole('option');
        expect(options).toHaveLength(3);
      });
    });

    it('displays current site as selected', () => {
      renderWithProviders(
        <SiteSelector
          currentSiteId="site2"
          onSiteChange={mockOnSiteChange}
        />
      );

      const selector = screen.getByRole('combobox') as HTMLSelectElement;
      expect(selector.value).toBe('site2');
    });

    it('shows site names in options', async () => {
      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Main Office')).toBeInTheDocument();
        expect(screen.getByText('Branch Office')).toBeInTheDocument();
        expect(screen.getByText('Remote Site')).toBeInTheDocument();
      });
    });

    it('displays loading state while fetching sites', () => {
      (multiTokenManager.getAllSiteTokens as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      expect(screen.getByTestId('selector-loading')).toBeInTheDocument();
    });

    it('shows disabled state when no sites available', async () => {
      (multiTokenManager.getAllSiteTokens as jest.Mock).mockResolvedValue(new Map());

      renderWithProviders(
        <SiteSelector
          currentSiteId={null}
          onSiteChange={mockOnSiteChange}
        />
      );

      await waitFor(() => {
        const selector = screen.getByRole('combobox');
        expect(selector).toBeDisabled();
      });
    });
  });

  describe('Site Switching', () => {
    it('calls onSiteChange when selecting different site', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      const selector = screen.getByRole('combobox');
      await user.selectOptions(selector, 'site2');

      expect(mockOnSiteChange).toHaveBeenCalledWith('site2');
    });

    it('updates multiTokenManager when site changes', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.selectOptions(screen.getByRole('combobox'), 'site2');

      await waitFor(() => {
        expect(multiTokenManager.setCurrentSite).toHaveBeenCalledWith('site2');
      });
    });

    it('shows loading indicator during site switch', async () => {
      const user = userEvent.setup();
      (multiTokenManager.setCurrentSite as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.selectOptions(screen.getByRole('combobox'), 'site2');

      expect(screen.getByTestId('switching-site-indicator')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('switching-site-indicator')).not.toBeInTheDocument();
      });
    });

    it('reverts selection on error', async () => {
      const user = userEvent.setup();
      (multiTokenManager.setCurrentSite as jest.Mock).mockRejectedValue(
        new Error('Failed to switch site')
      );

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.selectOptions(screen.getByRole('combobox'), 'site2');

      await waitFor(() => {
        const selector = screen.getByRole('combobox') as HTMLSelectElement;
        expect(selector.value).toBe('site1');
        expect(screen.getByText(/failed to switch site/i)).toBeInTheDocument();
      });
    });

    it('prevents switching to same site', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.selectOptions(screen.getByRole('combobox'), 'site1');

      expect(multiTokenManager.setCurrentSite).not.toHaveBeenCalled();
      expect(mockOnSiteChange).not.toHaveBeenCalled();
    });
  });

  describe('Dropdown Variants', () => {
    it('renders as native select by default', () => {
      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      expect(screen.getByRole('combobox')).toHaveAttribute('type', undefined);
    });

    it('renders as material-ui select when variant specified', () => {
      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          onSiteChange={mockOnSiteChange}
        />
      );

      const selector = screen.getByRole('button'); // Material-UI uses button for select
      expect(selector).toHaveClass('MuiSelect-root');
    });

    it('opens dropdown menu on click (material variant)', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('displays site icons in dropdown (material variant)', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          showIcons={true}
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));

      const icons = screen.getAllByTestId('site-icon');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Search Functionality', () => {
    it('filters sites by search query', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          searchable={true}
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));

      const searchInput = screen.getByPlaceholderText(/search sites/i);
      await user.type(searchInput, 'main');

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('Main Office');
    });

    it('shows no results message when search matches nothing', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          searchable={true}
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));
      await user.type(screen.getByPlaceholderText(/search sites/i), 'nonexistent');

      expect(screen.getByText(/no sites found/i)).toBeInTheDocument();
    });

    it('clears search when dropdown closes', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          searchable={true}
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));
      await user.type(screen.getByPlaceholderText(/search sites/i), 'main');
      await user.keyboard('{Escape}');

      await user.click(screen.getByRole('button'));

      const searchInput = screen.getByPlaceholderText(/search sites/i) as HTMLInputElement;
      expect(searchInput.value).toBe('');
    });
  });

  describe('Keyboard Navigation', () => {
    it('opens dropdown with space key', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          onSiteChange={mockOnSiteChange}
        />
      );

      const selector = screen.getByRole('button');
      selector.focus();
      await user.keyboard(' ');

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('navigates options with arrow keys', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveClass('focused');
    });

    it('selects site with enter key', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnSiteChange).toHaveBeenCalledWith('site2');
    });

    it('closes dropdown with escape key', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has appropriate ARIA labels', () => {
      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      const selector = screen.getByLabelText(/select active site/i);
      expect(selector).toBeInTheDocument();
    });

    it('announces site changes', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.selectOptions(screen.getByRole('combobox'), 'site2');

      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/switched to branch office/i);
      });
    });

    it('has proper focus management', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          onSiteChange={mockOnSiteChange}
        />
      );

      const selector = screen.getByRole('button');
      await user.click(selector);

      expect(screen.getByRole('listbox')).toHaveFocus();
    });

    it('returns focus to trigger after selection', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          onSiteChange={mockOnSiteChange}
        />
      );

      const selector = screen.getByRole('button');
      await user.click(selector);
      await user.click(screen.getAllByRole('option')[1]);

      await waitFor(() => {
        expect(selector).toHaveFocus();
      });
    });
  });

  describe('Customization', () => {
    it('applies custom className', () => {
      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          className="custom-selector"
          onSiteChange={mockOnSiteChange}
        />
      );

      expect(screen.getByTestId('site-selector')).toHaveClass('custom-selector');
    });

    it('renders custom option templates', async () => {
      const user = userEvent.setup();
      const renderOption = (site: any) => (
        <div>{site.siteName} ({site.siteId})</div>
      );

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          renderOption={renderOption}
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.getByText(/main office \(site1\)/i)).toBeInTheDocument();
    });

    it('groups sites by category when provided', async () => {
      const user = userEvent.setup();
      const sitesWithCategories = mockSiteTokens.map((token, index) => ({
        ...token,
        category: index === 0 ? 'Production' : 'Development',
      }));

      renderWithProviders(
        <SiteSelector
          currentSiteId="site1"
          variant="material"
          sites={sitesWithCategories}
          groupBy="category"
          onSiteChange={mockOnSiteChange}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Production')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
    });
  });
});
