import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login';

const loginMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: loginMock
  })
}));

vi.mock('../components/AuthMapPanel', () => ({
  default: () => <div data-testid="auth-map-panel" />
}));

describe('Login page', () => {
  it('renders login form and submits credentials', async () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /^login$/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('user@example.com', 'SecurePass123');
    });
  });
});
