// Simple test file to demonstrate conflict resolution logic
// This can be run in the browser console for testing

import { 
  analyzeDataConflicts, 
  mergeData, 
  applyConflictResolution,
  analyzeTripsConflicts,
  mergeTripsData,
  applyTripsConflictResolution,
  type DataConflict,
  type TripsConflict
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

// Test trips conflict detection
export function testTripsConflictDetection() {
  console.log('=== Testing Trips Conflict Detection ===');
  
  // Test case 1: Online has trips, local has no trips (user deleted trips offline)
  const localDataNoTrips = { trips: [], tripExpenses: [], tripRecurring: [] };
  const onlineDataWithTrips = {
    trips: [{ id: '1', name: 'Vacation', friends: 2 }],
    tripExpenses: [{ id: '1', tripId: '1', name: 'Hotel', amount: '100', date: '2024-01-01', createdAt: '2024-01-01T00:00:00Z' }],
    tripRecurring: []
  };
  
  const conflict1 = analyzeTripsConflicts(localDataNoTrips, onlineDataWithTrips);
  console.log('Case 1 - Online has trips, local has no trips:');
  console.log('Has conflicts:', conflict1.conflicts.trips || conflict1.conflicts.tripExpenses || conflict1.conflicts.tripRecurring);
  console.log('Conflict result:', conflict1);
  
  // Test case 2: Online has no trips, local has trips (user created trips offline)
  const localDataWithTrips = {
    trips: [{ id: '1', name: 'Business Trip', friends: 1 }],
    tripExpenses: [{ id: '1', tripId: '1', name: 'Flight', amount: '200', date: '2024-01-01', createdAt: '2024-01-01T00:00:00Z' }],
    tripRecurring: []
  };
  const onlineDataNoTrips = { trips: [], tripExpenses: [], tripRecurring: [] };
  
  const conflict2 = analyzeTripsConflicts(localDataWithTrips, onlineDataNoTrips);
  console.log('Case 2 - Online has no trips, local has trips:');
  console.log('Has conflicts:', conflict2.conflicts.trips || conflict2.conflicts.tripExpenses || conflict2.conflicts.tripRecurring);
  console.log('Conflict result:', conflict2);
  
  // Test case 3: Both have trips but different data
  const conflict3 = analyzeTripsConflicts(localDataWithTrips, onlineDataWithTrips);
  console.log('Case 3 - Both have trips but different data:');
  console.log('Has conflicts:', conflict3.conflicts.trips || conflict3.conflicts.tripExpenses || conflict3.conflicts.tripRecurring);
  console.log('Conflict result:', conflict3);
  
  // Test case 4: Neither has trips (no conflict)
  const conflict4 = analyzeTripsConflicts(localDataNoTrips, onlineDataNoTrips);
  console.log('Case 4 - Neither has trips:');
  console.log('Has conflicts:', conflict4.conflicts.trips || conflict4.conflicts.tripExpenses || conflict4.conflicts.tripRecurring);
  console.log('Conflict result:', conflict4);
  
  return { conflict1, conflict2, conflict3, conflict4 };
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
    testTripsConflictDetection();
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
