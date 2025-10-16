/**
 * AddTokenDialog Component Tests
 *
 * Comprehensive test suite for the AddTokenDialog component covering:
 * - Form input and validation
 * - Real-time token validation
 * - Duplicate site ID prevention
 * - API token testing
 * - Save functionality
 * - Error handling
 * - Mobile responsiveness
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddTokenDialog } from '../AddTokenDialog';
import { generateMockJWT, createExpiringSoonToken, createExpiredToken } from '../../test-utils/mockTokenData';

describe('AddTokenDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnTokenAdded = vi.fn();
  const existingSites = ['ses_existing_site', 'ses_another_site'];

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onTokenAdded: mockOnTokenAdded,
    existingSites,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render dialog when open', () => {
      render(<AddTokenDialog {...defaultProps} />);

      expect(screen.getByText('Add Token for New Site')).toBeInTheDocument();
      expect(screen.getByLabelText(/Site Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Site ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/JWT Token/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<AddTokenDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Add Token for New Site')).not.toBeInTheDocument();
    });

    it('should show helper text for each field', () => {
      render(<AddTokenDialog {...defaultProps} />);

      expect(screen.getByText(/Friendly display name/i)).toBeInTheDocument();
      expect(screen.getByText(/lowercase, alphanumeric/i)).toBeInTheDocument();
      expect(screen.getByText(/3 parts separated by dots/i)).toBeInTheDocument();
    });

    it('should have Cancel and Add Token buttons', () => {
      render(<AddTokenDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add Token/i })).toBeInTheDocument();
    });

    it('should show Test Token button', () => {
      render(<AddTokenDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Test Token with API/i })).toBeInTheDocument();
    });
  });

  describe('Site ID Input', () => {
    it('should accept site ID input', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/Site ID/i);
      await user.type(input, 'ses_new_site');

      expect(input).toHaveValue('ses_new_site');
    });

    it('should convert site ID to lowercase', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/Site ID/i);
      await user.type(input, 'SES_NEW_SITE');

      expect(input).toHaveValue('ses_new_site');
    });

    it('should show error for duplicate site ID', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/Site ID/i);
      await user.type(input, existingSites[0]);

      await waitFor(() => {
        expect(screen.getByText(/This site ID already exists/i)).toBeInTheDocument();
      });
    });

    it('should show error icon for duplicate site ID', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/Site ID/i);
      await user.type(input, existingSites[0]);

      const inputContainer = input.closest('.MuiTextField-root');
      expect(inputContainer).toBeInTheDocument();
    });
  });

  describe('Site Name Input', () => {
    it('should accept site name input', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/Site Name/i);
      await user.type(input, 'Falls City Hospital');

      expect(input).toHaveValue('Falls City Hospital');
    });

    it('should be optional', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, 'ses_test');

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      const validToken = generateMockJWT();
      await user.type(tokenInput, validToken);

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).not.toBeDisabled();
      });
    });
  });

  describe('Token Input', () => {
    it('should accept token input', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      const token = generateMockJWT();
      await user.type(input, token);

      expect(input).toHaveValue(token);
    });

    it('should be password field by default', () => {
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should toggle token visibility', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

      expect(input).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
    });
  });

  describe('Real-time Token Validation', () => {
    it('should validate valid JWT format', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      const validToken = generateMockJWT();
      await user.type(input, validToken);

      await waitFor(() => {
        expect(screen.getByText(/Token Validated/i)).toBeInTheDocument();
      });
    });

    it('should show error for invalid JWT format', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, 'invalid.token');

      await waitFor(() => {
        expect(screen.getByText(/Invalid Token/i)).toBeInTheDocument();
      });
    });

    it('should show error for token with only 2 parts', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, 'part1.part2');

      await waitFor(() => {
        expect(screen.getByText(/Invalid JWT format/i)).toBeInTheDocument();
      });
    });

    it('should show loading indicator during validation', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, generateMockJWT());

      // Should show loading briefly
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show success icon for valid token', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, generateMockJWT());

      await waitFor(() => {
        const successIcon = screen.getByTestId('CheckCircleIcon');
        expect(successIcon).toBeInTheDocument();
      });
    });

    it('should show error icon for invalid token', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, 'invalid');

      await waitFor(() => {
        const errorIcon = screen.getByTestId('ErrorIcon');
        expect(errorIcon).toBeInTheDocument();
      });
    });
  });

  describe('Token Expiration Display', () => {
    it('should display issued date', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, generateMockJWT());

      await waitFor(() => {
        expect(screen.getByText(/Issued:/i)).toBeInTheDocument();
      });
    });

    it('should display expiration date', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, generateMockJWT());

      await waitFor(() => {
        expect(screen.getByText(/Expires:/i)).toBeInTheDocument();
      });
    });

    it('should display days until expiry', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, generateMockJWT());

      await waitFor(() => {
        expect(screen.getByText(/days remaining/i)).toBeInTheDocument();
      });
    });

    it('should show warning for token expiring soon', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const expiringToken = createExpiringSoonToken(5);
      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, expiringToken.token);

      await waitFor(() => {
        expect(screen.getByText(/expires soon/i)).toBeInTheDocument();
      });
    });

    it('should show urgent warning for token expiring very soon', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const urgentToken = createExpiringSoonToken(0.5);
      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, urgentToken.token);

      await waitFor(() => {
        expect(screen.getByText(/expires very soon/i)).toBeInTheDocument();
      });
    });

    it('should show error for expired token', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const expiredToken = createExpiredToken();
      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, expiredToken.token);

      await waitFor(() => {
        expect(screen.getByText(/Token has expired/i)).toBeInTheDocument();
      });
    });
  });

  describe('Test Token Button', () => {
    it('should be disabled when token is invalid', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, 'invalid');

      await waitFor(() => {
        const testButton = screen.getByRole('button', { name: /Test Token/i });
        expect(testButton).toBeDisabled();
      });
    });

    it('should be enabled when token is valid', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, generateMockJWT());

      await waitFor(() => {
        const testButton = screen.getByRole('button', { name: /Test Token/i });
        expect(testButton).not.toBeDisabled();
      });
    });

    it('should show loading state during test', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, generateMockJWT());

      await waitFor(() => {
        const testButton = screen.getByRole('button', { name: /Test Token/i });
        expect(testButton).not.toBeDisabled();
      });

      const testButton = screen.getByRole('button', { name: /Test Token/i });
      await user.click(testButton);

      expect(screen.getByText(/Testing.../i)).toBeInTheDocument();
    });

    it('should show success message on successful test', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const input = screen.getByLabelText(/JWT Token/i);
      await user.type(input, generateMockJWT());

      await waitFor(() => {
        const testButton = screen.getByRole('button', { name: /Test Token/i });
        expect(testButton).not.toBeDisabled();
      });

      const testButton = screen.getByRole('button', { name: /Test Token/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/successfully verified/i)).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    it('should be disabled when site ID is missing', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      await user.type(tokenInput, generateMockJWT());

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).toBeDisabled();
      });
    });

    it('should be disabled when token is invalid', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, 'ses_test');

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      await user.type(tokenInput, 'invalid');

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).toBeDisabled();
      });
    });

    it('should be enabled when all fields are valid', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, 'ses_test');

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      await user.type(tokenInput, generateMockJWT());

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).not.toBeDisabled();
      });
    });

    it('should save token and call onTokenAdded', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, 'ses_test');

      const siteNameInput = screen.getByLabelText(/Site Name/i);
      await user.type(siteNameInput, 'Test Site');

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      const token = generateMockJWT();
      await user.type(tokenInput, token);

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).not.toBeDisabled();
      });

      const addButton = screen.getByRole('button', { name: /Add Token/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(mockOnTokenAdded).toHaveBeenCalledWith('ses_test');
      });
    });

    it('should store token in localStorage', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, 'ses_test');

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      const token = generateMockJWT();
      await user.type(tokenInput, token);

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).not.toBeDisabled();
      });

      const addButton = screen.getByRole('button', { name: /Add Token/i });
      await user.click(addButton);

      await waitFor(() => {
        const stored = localStorage.getItem('token_ses_test');
        expect(stored).toBeTruthy();
      });
    });

    it('should close dialog after successful save', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, 'ses_test');

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      await user.type(tokenInput, generateMockJWT());

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).not.toBeDisabled();
      });

      const addButton = screen.getByRole('button', { name: /Add Token/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when saving with duplicate site ID', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, existingSites[0]);

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      await user.type(tokenInput, generateMockJWT());

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).not.toBeDisabled();
      });

      const addButton = screen.getByRole('button', { name: /Add Token/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });

    it('should show error for invalid site ID format', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, 'INVALID-SITE');

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      await user.type(tokenInput, generateMockJWT());

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).not.toBeDisabled();
      });

      const addButton = screen.getByRole('button', { name: /Add Token/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/lowercase alphanumeric/i)).toBeInTheDocument();
      });
    });

    it('should allow dismissing error messages', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, existingSites[0]);

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      await user.type(tokenInput, generateMockJWT());

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add Token/i });
        expect(addButton).not.toBeDisabled();
      });

      const addButton = screen.getByRole('button', { name: /Add Token/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });
  });

  describe('Cancel and Reset', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<AddTokenDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when dialog is reopened', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<AddTokenDialog {...defaultProps} />);

      const siteIdInput = screen.getByLabelText(/Site ID/i);
      await user.type(siteIdInput, 'ses_test');

      const tokenInput = screen.getByLabelText(/JWT Token/i);
      await user.type(tokenInput, generateMockJWT());

      rerender(<AddTokenDialog {...defaultProps} open={false} />);
      rerender(<AddTokenDialog {...defaultProps} open={true} />);

      expect(screen.getByLabelText(/Site ID/i)).toHaveValue('');
      expect(screen.getByLabelText(/JWT Token/i)).toHaveValue('');
    });
  });
});
