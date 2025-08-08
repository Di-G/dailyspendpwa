import { QueryClient, QueryFunction } from "@tanstack/react-query";
import * as localStorageService from "./localStorage";

// Define API endpoint types
type ApiEndpoint = {
  GET: (params?: any) => any;
  POST?: (data: any) => any;
  DELETE?: (id: string) => any;
};

// Mock API layer that uses localStorage
const mockApi: Record<string, ApiEndpoint> = {
  // Categories
  "/api/categories": {
    GET: () => localStorageService.getCategories(),
    POST: (data: any) => localStorageService.createCategory(data),
    DELETE: (id: string) => localStorageService.deleteCategory(id),
  },
  
  // Expenses
  "/api/expenses": {
    GET: (params?: any) => {
      if (params?.date) {
        return localStorageService.getExpensesByDate(params.date);
      } else if (params?.startDate && params?.endDate) {
        return localStorageService.getExpensesByDateRange(params.startDate, params.endDate);
      } else {
        return localStorageService.getExpenses();
      }
    },
    POST: (data: any) => localStorageService.createExpense(data),
    DELETE: (id: string) => localStorageService.deleteExpense(id),
  },
  
  // Analytics
  "/api/analytics/daily-total": {
    GET: (params: any) => ({ total: localStorageService.getDailyTotal(params.date) }),
  },
  
  "/api/analytics/category-totals": {
    GET: (params: any) => localStorageService.getCategoryTotals(params.date),
  },
  
  "/api/analytics/monthly-totals": {
    GET: (params: any) => localStorageService.getMonthlyTotals(parseInt(params.year), parseInt(params.month)),
  },
  
  "/api/analytics/weekly-totals": {
    GET: (params: any) => localStorageService.getWeeklyTotals(params.date),
  },
};

// Helper function to find the appropriate API endpoint
const findApiEndpoint = (url: string): ApiEndpoint | undefined => {
  const baseUrl = url.split('?')[0];
  return mockApi[baseUrl];
};

// Helper function to extract parameters from URL
const extractParams = (url: string) => {
  const urlObj = new URL(url, 'http://localhost');
  const params: Record<string, any> = {};
  
  // Use Array.from to avoid iteration issues
  Array.from(urlObj.searchParams.entries()).forEach(([key, value]) => {
    params[key] = value;
  });
  
  return params;
};

// Helper function to extract ID from URL path
const extractIdFromPath = (url: string) => {
  const parts = url.split('/');
  const id = parts[parts.length - 1];
  // Handle cases where the URL might have query parameters
  return id.split('?')[0];
};

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const endpoint = findApiEndpoint(url);
  
  if (!endpoint) {
    throw new Error(`API endpoint not found: ${url}`);
  }
  
  try {
    let result;
    
    if (method === 'GET') {
      const params = extractParams(url);
      result = endpoint.GET(params);
    } else if (method === 'POST' && endpoint.POST) {
      result = endpoint.POST(data);
    } else if (method === 'DELETE' && endpoint.DELETE) {
      const id = extractIdFromPath(url);
      if (!id) {
        throw new Error('No ID provided for DELETE operation');
      }
      result = endpoint.DELETE(id);
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }
    
    // Create a mock Response object
    const mockResponse = new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
    return mockResponse;
  } catch (error) {
    // Create a mock error Response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorResponse = new Response(JSON.stringify({ message: errorMessage }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    
    return errorResponse;
  }
}



async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url = queryKey[0] as string;
    
    // Handle query parameters
    if (queryKey.length > 1) {
      const params = queryKey[1] as Record<string, any>;
      const searchParams = new URLSearchParams();
      
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      }
      
      if (searchParams.toString()) {
        url += "?" + searchParams.toString();
      }
    }

    const res = await apiRequest('GET', url);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
