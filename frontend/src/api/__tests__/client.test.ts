import { vi } from 'vitest'

// Mock axios before importing client to avoid form-data dependency issue in jsdom
vi.mock('axios', async () => {
  const handlers: Array<{ fulfilled: (config: any) => any }> = []
  const instance = {
    defaults: {
      baseURL: 'http://localhost:8000',
      headers: { 'Content-Type': 'application/json' } as Record<string, string>,
    },
    interceptors: {
      request: {
        use: (fn: (config: any) => any) => {
          handlers.push({ fulfilled: fn })
        },
        handlers,
      },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
  return {
    default: {
      create: () => instance,
    },
  }
})

import api from '../client'

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should export a default axios instance', () => {
    expect(api).toBeDefined()
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('should have a baseURL set', () => {
    expect(api.defaults.baseURL).toBeTruthy()
  })

  it('should have request interceptors configured', () => {
    const interceptors = (api.interceptors.request as any).handlers
    expect(interceptors.length).toBeGreaterThan(0)
  })

  it('interceptor adds Authorization header when token exists', () => {
    localStorage.setItem('routed_token', 'my-test-token')

    const interceptors = (api.interceptors.request as any).handlers
    const fulfilled = interceptors[0].fulfilled
    const config = { headers: {} as Record<string, string> }
    const result = fulfilled(config)
    expect(result.headers.Authorization).toBe('Bearer my-test-token')
  })

  it('interceptor does not add Authorization header when no token', () => {
    const interceptors = (api.interceptors.request as any).handlers
    const fulfilled = interceptors[0].fulfilled
    const config = { headers: {} as Record<string, string> }
    const result = fulfilled(config)
    expect(result.headers.Authorization).toBeUndefined()
  })
})
