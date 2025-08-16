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
  console.log('=== Testing Conflict Resolution ===');
  
  const conflict = analyzeDataConflicts(mockLocalData, mockOnlineData);
  
  // Test merge resolution
  const mergedResult = applyConflictResolution('merge', conflict.localData, conflict.onlineData);
  console.log('Merge result:', mergedResult);
  
  // Test overwrite local
  const localResult = applyConflictResolution('overwrite-local', conflict.localData, conflict.onlineData);
  console.log('Overwrite local result:', localResult);
  
  // Test overwrite online
  const onlineResult = applyConflictResolution('overwrite-online', conflict.localData, conflict.onlineData);
  console.log('Overwrite online result:', onlineResult);
  
  return { mergedResult, localResult, onlineResult };
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
