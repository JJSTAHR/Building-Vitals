import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { configureStore, PreloadedState } from '@reduxjs/toolkit';
import { RootState } from '../store';

// Create a test theme
const testTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Create a mock store
export const createMockStore = (preloadedState?: PreloadedState<RootState>) => {
  return configureStore({
    reducer: {
      // Add your reducers here
      auth: (state = { user: null, token: null }) => state,
      sites: (state = { currentSite: null, sites: [] }) => state,
    },
    preloadedState,
  });
};

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<RootState>;
  store?: ReturnType<typeof createMockStore>;
  route?: string;
}

/**
 * Custom render function that wraps components with necessary providers
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState,
    store = createMockStore(preloadedState),
    route = '/',
    ...renderOptions
  }: ExtendedRenderOptions = {}
) => {
  window.history.pushState({}, 'Test page', route);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <ThemeProvider theme={testTheme}>
        <MemoryRouter initialEntries={[route]}>
          {children}
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
};

/**
 * Re-export everything from React Testing Library
 */
export * from '@testing-library/react';
export { renderWithProviders as render };
