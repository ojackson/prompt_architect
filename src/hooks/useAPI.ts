import { useState, useCallback } from 'react';

interface APIState {
  loading: boolean;
  error: string | null;
  data: any;
}

interface UseAPIOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for API operations with loading states and error handling
 */
export function useAPI(initialState: APIState = { loading: false, error: null, data: null }) {
  const [state, setState] = useState<APIState>(initialState);

  const execute = useCallback(
    async <T>(
      apiCall: () => Promise<T>,
      options: UseAPIOptions = {}
    ): Promise<T | null> => {
      setState({ loading: true, error: null, data: null });
      
      try {
        const result = await apiCall();
        setState({ loading: false, error: null, data: result });
        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setState({ loading: false, error: errorMessage, data: null });
        options.onError?.(error as Error);
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null });
  }, []);

  return { ...state, execute, reset };
}

/**
 * Hook for managing OpenAI API calls with retry logic
 */
export function useOpenAI() {
  const apiState = useAPI();

  const callOpenAI = useCallback(
    async (
      messages: Array<{ role: string; content: string }>,
      model: string,
      apiKey: string,
      options: {
        temperature?: number;
        maxRetries?: number;
        baseDelay?: number;
      } = {}
    ) => {
      const { temperature = 0.7, maxRetries = 3, baseDelay = 500 } = options;

      const fetchWithRetry = async (url: string, opts: RequestInit, tries = maxRetries) => {
        let attempt = 0;
        let lastErr: Error | null = null;
        
        while (attempt < tries) {
          try {
            // Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const res = await fetch(url, {
              ...opts,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (res.ok) return res;
            
            const txt = await res.text().catch(() => "");
            if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
              lastErr = new Error(`HTTP ${res.status} ${txt}`);
            } else {
              throw new Error(`HTTP ${res.status} ${txt}`);
            }
          } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
              lastErr = new Error('Request timeout');
            } else {
              lastErr = e as Error;
            }
          }
          
          attempt++;
          if (attempt < tries) {
            const jitter = Math.floor(Math.random() * 200);
            const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        throw lastErr || new Error("Request failed");
      };

      return apiState.execute(async () => {
        const response = await fetchWithRetry(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              temperature,
            }),
          }
        );

        const data = await response.json();
        return data?.choices?.[0]?.message?.content?.trim?.() || "";
      });
    },
    [apiState]
  );

  return {
    ...apiState,
    callOpenAI,
  };
}
