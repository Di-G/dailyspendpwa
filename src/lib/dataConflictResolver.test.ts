// Simple test file to demonstrate conflict resolution logic
// This can be run in the browser console for testing

import { 
  analyzeDataConflicts, 
  mergeData, 
  applyConflictResolution,
  type DataConflict 
} from './dataConflictResolver';

// Mock data for testing
const mockLocalData = {
  categories: [
    { id: '1', name: 'Food', color: '#FF0000', createdAt: '2024-01-01T00:00:00Z' },
    { id: '2', name: 'Transport', color: '#00FF00', createdAt: '2024-01-02T00:00:00Z' }
  ],
  expenses: [
    { id: '1', name: 'Lunch', amount: '10.00', categoryId: '1', date: '2024-01-01', createdAt: '2024-01-01T12:00:00Z' }
  ],
  recurring: []
};

const mockOnlineData = {
  categories: [
    { id: '1', name: 'Food', color: '#FF0000', createdAt: '2024-01-01T00:00:00Z' },
    { id: '3', name: 'Entertainment', color: '#0000FF', createdAt: '2024-01-03T00:00:00Z' }
  ],
  expenses: [
    { id: '1', name: 'Lunch', amount: '12.00', categoryId: '1', date: '2024-01-01', createdAt: '2024-01-01T18:00:00Z' }
  ],
  recurring: []
};

// Test conflict analysis
export function testConflictAnalysis() {
  console.log('=== Testing Conflict Analysis ===');
  
  const conflict = analyzeDataConflicts(mockLocalData, mockOnlineData);
  
  console.log('Conflict result:', conflict);
  console.log('Has conflicts:', 
    conflict.conflicts.categories || 
    conflict.conflicts.expenses || 
    conflict.conflicts.recurring
  );
  
  return conflict;
}

// Test data merging
export function testDataMerging() {
  console.log('=== Testing Data Merging ===');
  
  const merged = mergeData(mockLocalData, mockOnlineData);
  
  console.log('Merged data:', merged);
  console.log('Categories count:', merged.categories.length);
  console.log('Expenses count:', merged.expenses.length);
  
  return merged;
}

// Test conflict resolution
export function testConflictResolution() {
  const conflict: DataConflict = {
    hasLocalData: true,
    hasOnlineData: true,
    conflicts: { categories: true, expenses: true, recurring: true, friends: false },
    localData: {
      categories: [{ id: '1', name: 'Local Cat', color: '#000', createdAt: '2023-01-01' }],
      expenses: [{ id: '1', name: 'Local Expense', amount: '10', date: '2023-01-01', createdAt: '2023-01-01', categoryId: null, details: null }],
      recurring: [],
      friends: []
    },
    onlineData: {
      categories: [{ id: '2', name: 'Online Cat', color: '#fff', createdAt: '2023-01-02' }],
      expenses: [{ id: '2', name: 'Online Expense', amount: '20', date: '2023-01-01', createdAt: '2023-01-02', categoryId: null, details: null }],
      recurring: [],
      friends: []
    }
  };

  console.log('Testing conflict resolution...');
  
  const mergedResult = applyConflictResolution('merge', conflict.localData, conflict.onlineData);
  console.log('Merge result:', mergedResult);
  
  const localResult = applyConflictResolution('overwrite-local', conflict.localData, conflict.onlineData);
  console.log('Overwrite local result:', localResult);
  
  const onlineResult = applyConflictResolution('overwrite-online', conflict.localData, conflict.onlineData);
  console.log('Overwrite online result:', onlineResult);
  
  const replaceLocalResult = applyConflictResolution('replace-local-with-online', conflict.localData, conflict.onlineData);
  console.log('Replace local with online result:', replaceLocalResult);
}

// Run all tests
export function runAllTests() {
  console.log('🧪 Running Data Conflict Resolution Tests...\n');
  
  try {
    testConflictAnalysis();
    console.log('');
    testDataMerging();
    console.log('');
    testConflictResolution();
    console.log('');
    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testConflictResolution = {
    runAllTests,
    testConflictAnalysis,
    testDataMerging,
    testConflictResolution
  };
}
