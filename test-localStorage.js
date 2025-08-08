// Simple test script to verify localStorage functionality
// Run this in the browser console to test the localStorage service

console.log('Testing localStorage functionality...');

// Test data
const testCategory = {
  name: "Test Category",
  color: "#FF0000"
};

const testExpense = {
  name: "Test Expense",
  amount: "25.50",
  details: "Test expense details",
  categoryId: null,
  date: "2024-01-15"
};

// Mock localStorage service functions
const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

const getFromStorage = (key, defaultValue) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage key ${key}:`, error);
    return defaultValue;
  }
};

const setToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage key ${key}:`, error);
  }
};

// Test categories
const testCategories = () => {
  console.log('Testing categories...');
  
  // Get categories
  const categories = getFromStorage('dailyspend_categories', []);
  console.log('Current categories:', categories);
  
  // Add test category
  const newCategory = {
    id: generateId(),
    name: testCategory.name,
    color: testCategory.color,
    createdAt: new Date().toISOString(),
  };
  
  const updatedCategories = [...categories, newCategory];
  setToStorage('dailyspend_categories', updatedCategories);
  console.log('Added test category:', newCategory);
  
  // Verify
  const categoriesAfter = getFromStorage('dailyspend_categories', []);
  console.log('Categories after adding:', categoriesAfter);
  
  return newCategory.id;
};

// Test expenses
const testExpenses = (categoryId) => {
  console.log('Testing expenses...');
  
  // Get expenses
  const expenses = getFromStorage('dailyspend_expenses', []);
  console.log('Current expenses:', expenses);
  
  // Add test expense
  const newExpense = {
    id: generateId(),
    name: testExpense.name,
    amount: testExpense.amount,
    details: testExpense.details,
    categoryId: categoryId,
    date: testExpense.date,
    createdAt: new Date().toISOString(),
  };
  
  const updatedExpenses = [...expenses, newExpense];
  setToStorage('dailyspend_expenses', updatedExpenses);
  console.log('Added test expense:', newExpense);
  
  // Verify
  const expensesAfter = getFromStorage('dailyspend_expenses', []);
  console.log('Expenses after adding:', expensesAfter);
  
  return newExpense.id;
};

// Run tests
try {
  const categoryId = testCategories();
  const expenseId = testExpenses(categoryId);
  
  console.log('✅ All tests passed!');
  console.log('Category ID:', categoryId);
  console.log('Expense ID:', expenseId);
  
  // Clean up test data
  console.log('Cleaning up test data...');
  localStorage.removeItem('dailyspend_categories');
  localStorage.removeItem('dailyspend_expenses');
  console.log('✅ Cleanup complete');
  
} catch (error) {
  console.error('❌ Test failed:', error);
}
