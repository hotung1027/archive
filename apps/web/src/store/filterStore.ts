import { create } from 'zustand';
import type { FilterQuery, FilterRule } from '@omnisearch/types';

interface FilterStore {
  query: FilterQuery;
  textSearch: string;

  // Setters
  setTextSearch: (text: string) => void;
  setAndRule:    (rule: FilterRule) => void;
  removeAndRule: (field: string) => void;
  addNotRule:    (rule: FilterRule) => void;
  removeNotRule: (field: string) => void;
  clearFilters:  () => void;
}

const DEFAULT_QUERY: FilterQuery = { and: [], not: [], text: '' };

export const useFilterStore = create<FilterStore>((set) => ({
  query: DEFAULT_QUERY,
  textSearch: '',

  setTextSearch: (text) =>
    set(s => ({ textSearch: text, query: { ...s.query, text } })),

  setAndRule: (rule) =>
    set(s => ({
      query: {
        ...s.query,
        and: [
          ...s.query.and.filter(r => r.field !== rule.field),
          rule,
        ],
      },
    })),

  removeAndRule: (field) =>
    set(s => ({
      query: { ...s.query, and: s.query.and.filter(r => r.field !== field) },
    })),

  addNotRule: (rule) =>
    set(s => ({
      query: {
        ...s.query,
        not: [
          ...s.query.not.filter(r => r.field !== rule.field),
          rule,
        ],
      },
    })),

  removeNotRule: (field) =>
    set(s => ({
      query: { ...s.query, not: s.query.not.filter(r => r.field !== field) },
    })),

  clearFilters: () => set({ query: DEFAULT_QUERY, textSearch: '' }),
}));
