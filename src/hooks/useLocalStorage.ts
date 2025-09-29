import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for localStorage with automatic serialization/deserialization
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  } = {}
) {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = options;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, serialize(valueToStore));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serialize, storedValue]
  );

  return [storedValue, setValue] as const;
}

/**
 * Hook for managing preset-specific localStorage keys
 */
export function usePresetStorage<T>(
  presetName: string,
  suffix: string,
  initialValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
) {
  const key = `${presetName}:${suffix}`;
  return useLocalStorage(key, initialValue, options);
}

/**
 * Hook for managing multiple related localStorage values efficiently
 */
export function useBatchLocalStorage<T extends Record<string, any>>(
  keys: T,
  presetName?: string
): [T, <K extends keyof T>(key: K, value: T[K]) => void, (updates: Partial<T>) => void] {
  const prefix = presetName ? `${presetName}:` : '';
  
  const [values, setValues] = useState<T>(() => {
    const result = {} as T;
    for (const key in keys) {
      try {
        const item = window.localStorage.getItem(`${prefix}${key}`);
        result[key] = item ? JSON.parse(item) : keys[key];
      } catch (error) {
        console.warn(`Error reading localStorage key "${prefix}${key}":`, error);
        result[key] = keys[key];
      }
    }
    return result;
  });

  const updateValue = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues(prev => ({ ...prev, [key]: value }));
      try {
        window.localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
      } catch (error) {
        console.warn(`Error setting localStorage key "${prefix}${key}":`, error);
      }
    },
    [prefix]
  );

  const updateValues = useCallback(
    (updates: Partial<T>) => {
      setValues(prev => ({ ...prev, ...updates }));
      Object.entries(updates).forEach(([key, value]) => {
        try {
          window.localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
        } catch (error) {
          console.warn(`Error setting localStorage key "${prefix}${key}":`, error);
        }
      });
    },
    [prefix]
  );

  return [values, updateValue, updateValues];
}
