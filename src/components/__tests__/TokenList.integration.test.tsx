import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TokenList } from '../TokenList';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { mockSiteTokens, mockValidationResults } from '../../test-utils/mockData';
import { tokenValidator } from '../../services/tokenValidator';

jest.mock('../../services/tokenValidator');

describe('TokenList Integration', () => {
  const mockOnTokenSelect = jest.fn();
  const mockOnTokenDelete = jest.fn();
  const mockOnTokenEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (tokenValidator.validateToken as jest.Mock).mockReturnValue(mockValidationResults.valid);
  });

  describe('Display', () => {
    it('renders all tokens in list', () => {
      renderWithProviders(
        <TokenList
          tokens={mockSiteTokens}
          onTokenSelect={mockOnTokenSelect}
        />
      );

      expect(screen.getByText('Main Office')).toBeInTheDocument();
      expect(screen.getByText('Branch Office')).toBeInTheDocument();
      expect(screen.getByText('Remote Site')).toBeInTheDocument();
    });

    it('displays empty state when no tokens', () => {
      renderWithProviders(
        <TokenList tokens={[]} onTokenSelect={mockOnTokenSelect} />
      );

      expect(screen.getByText(/no tokens configured/i)).toBeInTheDocument();
    });

    it('shows site IDs alongside names', () => {
      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      expect(screen.getByText('site1')).toBeInTheDocument();
      expect(screen.getByText('site2')).toBeInTheDocument();
      expect(screen.getByText('site3')).toBeInTheDocument();
    });

    it('displays token creation dates', () => {
      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      expect(screen.getByText(/created: 2024-01-01/i)).toBeInTheDocument();
      expect(screen.getByText(/created: 2024-02-01/i)).toBeInTheDocument();
    });

    it('highlights currently active token', () => {
      renderWithProviders(
        <TokenList
          tokens={mockSiteTokens}
          currentSiteId="site2"
          onTokenSelect={mockOnTokenSelect}
        />
      );

      const activeRow = screen.getByTestId('token-row-site2');
      expect(activeRow).toHaveClass('active');
      expect(within(activeRow).getByText(/active/i)).toBeInTheDocument();
    });
  });

  describe('Token Validation Display', () => {
    it('shows valid indicator for valid tokens', () => {
      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const validIndicators = screen.getAllByTestId('token-valid-indicator');
      expect(validIndicators).toHaveLength(3);
    });

    it('displays expiry warning for tokens expiring soon', () => {
      (tokenValidator.validateToken as jest.Mock).mockImplementation((token) => {
        if (token === mockSiteTokens[2].token) {
          return mockValidationResults.expiringSoon;
        }
        return mockValidationResults.valid;
      });

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const warningRow = screen.getByTestId('token-row-site3');
      expect(within(warningRow).getByText(/expiring soon/i)).toBeInTheDocument();
    });

    it('shows error for expired tokens', () => {
      (tokenValidator.validateToken as jest.Mock).mockImplementation((token) => {
        if (token === mockSiteTokens[2].token) {
          return mockValidationResults.expired;
        }
        return mockValidationResults.valid;
      });

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const errorRow = screen.getByTestId('token-row-site3');
      expect(within(errorRow).getByText(/expired/i)).toBeInTheDocument();
      expect(errorRow).toHaveClass('error');
    });

    it('displays days until expiry', () => {
      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      expect(screen.getByText(/expires in 300 days/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onTokenSelect when clicking token row', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const tokenRow = screen.getByTestId('token-row-site1');
      await user.click(tokenRow);

      expect(mockOnTokenSelect).toHaveBeenCalledWith('site1');
    });

    it('calls onTokenDelete when clicking delete button', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList
          tokens={mockSiteTokens}
          onTokenSelect={mockOnTokenSelect}
          onTokenDelete={mockOnTokenDelete}
        />
      );

      const deleteButtons = screen.getAllByLabelText(/delete token/i);
      await user.click(deleteButtons[0]);

      expect(mockOnTokenDelete).toHaveBeenCalledWith('site1');
    });

    it('calls onTokenEdit when clicking edit button', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList
          tokens={mockSiteTokens}
          onTokenSelect={mockOnTokenSelect}
          onTokenEdit={mockOnTokenEdit}
        />
      );

      const editButtons = screen.getAllByLabelText(/edit token/i);
      await user.click(editButtons[0]);

      expect(mockOnTokenEdit).toHaveBeenCalledWith('site1');
    });

    it('shows context menu on right-click', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList
          tokens={mockSiteTokens}
          onTokenSelect={mockOnTokenSelect}
          onTokenDelete={mockOnTokenDelete}
        />
      );

      const tokenRow = screen.getByTestId('token-row-site1');
      await user.pointer({ keys: '[MouseRight]', target: tokenRow });

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const firstRow = screen.getByTestId('token-row-site1');
      firstRow.focus();
      await user.keyboard('{ArrowDown}');

      const secondRow = screen.getByTestId('token-row-site2');
      expect(secondRow).toHaveFocus();
    });

    it('selects token with Enter key', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const firstRow = screen.getByTestId('token-row-site1');
      firstRow.focus();
      await user.keyboard('{Enter}');

      expect(mockOnTokenSelect).toHaveBeenCalledWith('site1');
    });
  });

  describe('Sorting', () => {
    it('sorts by site name by default', () => {
      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const rows = screen.getAllByTestId(/^token-row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'token-row-site2'); // Branch Office
      expect(rows[1]).toHaveAttribute('data-testid', 'token-row-site1'); // Main Office
      expect(rows[2]).toHaveAttribute('data-testid', 'token-row-site3'); // Remote Site
    });

    it('sorts by creation date when column clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      await user.click(screen.getByText(/created/i));

      const rows = screen.getAllByTestId(/^token-row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'token-row-site1');
      expect(rows[1]).toHaveAttribute('data-testid', 'token-row-site2');
      expect(rows[2]).toHaveAttribute('data-testid', 'token-row-site3');
    });

    it('reverses sort order on second click', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      await user.click(screen.getByText(/site name/i));
      await user.click(screen.getByText(/site name/i));

      const rows = screen.getAllByTestId(/^token-row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'token-row-site3');
      expect(rows[1]).toHaveAttribute('data-testid', 'token-row-site1');
      expect(rows[2]).toHaveAttribute('data-testid', 'token-row-site2');
    });
  });

  describe('Filtering', () => {
    it('filters tokens by search query', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const searchInput = screen.getByPlaceholderText(/search tokens/i);
      await user.type(searchInput, 'main');

      expect(screen.getByText('Main Office')).toBeInTheDocument();
      expect(screen.queryByText('Branch Office')).not.toBeInTheDocument();
      expect(screen.queryByText('Remote Site')).not.toBeInTheDocument();
    });

    it('shows no results message when filter matches nothing', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      await user.type(screen.getByPlaceholderText(/search tokens/i), 'nonexistent');

      expect(screen.getByText(/no tokens found/i)).toBeInTheDocument();
    });

    it('filters by status', async () => {
      const user = userEvent.setup();
      (tokenValidator.validateToken as jest.Mock).mockImplementation((token) => {
        if (token === mockSiteTokens[2].token) {
          return mockValidationResults.expired;
        }
        return mockValidationResults.valid;
      });

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      await user.click(screen.getByLabelText(/filter by status/i));
      await user.click(screen.getByText(/expired/i));

      expect(screen.getByText('Remote Site')).toBeInTheDocument();
      expect(screen.queryByText('Main Office')).not.toBeInTheDocument();
    });
  });

  describe('Bulk Actions', () => {
    it('selects multiple tokens with checkboxes', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });

    it('selects all tokens with header checkbox', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      const selectAllCheckbox = screen.getByLabelText(/select all/i);
      await user.click(selectAllCheckbox);

      expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
    });

    it('shows bulk delete button when tokens selected', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList
          tokens={mockSiteTokens}
          onTokenSelect={mockOnTokenSelect}
          onTokenDelete={mockOnTokenDelete}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has table structure with proper roles', () => {
      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(4); // Header + 3 tokens
      expect(screen.getAllByRole('columnheader')).toHaveLength(5); // All columns
    });

    it('has descriptive labels for actions', () => {
      renderWithProviders(
        <TokenList
          tokens={mockSiteTokens}
          onTokenSelect={mockOnTokenSelect}
          onTokenDelete={mockOnTokenDelete}
        />
      );

      expect(screen.getByLabelText(/delete token for main office/i)).toBeInTheDocument();
    });

    it('announces selection changes', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TokenList tokens={mockSiteTokens} onTokenSelect={mockOnTokenSelect} />
      );

      await user.click(screen.getByTestId('token-row-site1'));

      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent(/main office selected/i);
    });
  });
});
