/**
 * API route configuration for Django backend
 */

const API_BASE = 'http://localhost:8000/api';

export const api: any = {
    users: {
        me: `${API_BASE}/users/users/me/`,
        login: { path: '/auth/login', input: {}, responses: { 200: { parse: (x: any) => x } } },
        signup: '/auth/signup',
        get: { path: '/users/:id', responses: { 200: { parse: (x: any) => x } } },
    },
    policies: {
        getAll: `${API_BASE}/policies/`,
        getById: (id: string) => `${API_BASE}/policies/${id}/`,
        create: { path: `${API_BASE}/policies/`, responses: { 201: { parse: (x: any) => x } } },
        update: (id: string) => `${API_BASE}/policies/${id}/`,
        getByUser: { path: `${API_BASE}/policies/my_policy/`, responses: { 200: { parse: (x: any) => x } } },
        list: { path: `${API_BASE}/policies/`, responses: { 200: { parse: (x: any) => x } } },
        updateStatus: { path: `${API_BASE}/policies/:id/update_status/`, responses: { 200: { parse: (x: any) => x } } },
        pending: { path: `${API_BASE}/policies/pending/`, responses: { 200: { parse: (x: any) => x } } },
        allFamilies: { path: `${API_BASE}/policies/all_families/`, responses: { 200: { parse: (x: any) => x } } },
    },
    members: {
        getAll: `${API_BASE}/family-members/`,
        create: { path: `${API_BASE}/family-members/`, responses: { 201: { parse: (x: any) => x } } },
        list: { path: `${API_BASE}/family-members/`, responses: { 200: { parse: (x: any) => x } } },
        getById: (id: string) => `${API_BASE}/family-members/${id}/`,
        update: (id: string) => `${API_BASE}/family-members/${id}/`,
        delete: (id: string) => `${API_BASE}/family-members/${id}/`,
    },
    claims: {
        getAll: `${API_BASE}/claims/`,
        getById: (id: string) => `${API_BASE}/claims/${id}/`,
        create: { path: `${API_BASE}/claims/`, responses: { 201: { parse: (x: any) => x } } },
        updateStatus: { path: `${API_BASE}/claims/:id/status`, responses: { 200: { parse: (x: any) => x } } },
        listByUser: { path: `${API_BASE}/claims/`, responses: { 200: { parse: (x: any) => x } } },
        listAll: { path: `${API_BASE}/claims/`, responses: { 200: { parse: (x: any) => x } } },
        get: { path: `${API_BASE}/claims/:id`, responses: { 200: { parse: (x: any) => x } } },
    },
    admin: {
        claims: {
            pending: '/admin/claims/pending/',
        },
        stats: { path: '/admin/stats', responses: { 200: { parse: (x: any) => x } } },
    },
};

export const buildUrl = (path: string, params?: Record<string, any>) => {
    if (!params) return path;

    const queryString = new URLSearchParams(
        Object.entries(params).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null) {
                acc[key] = String(value);
            }
            return acc;
        }, {} as Record<string, string>)
    ).toString();

    return queryString ? `${path}?${queryString}` : path;
};
