import '@testing-library/jest-dom/vitest';
import 'whatwg-fetch';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { mswServer } from './msw/server';
import { resetBridgeRequestLog } from './msw/handlers';

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  mswServer.resetHandlers();
  resetBridgeRequestLog();
});

afterAll(() => {
  mswServer.close();
});

