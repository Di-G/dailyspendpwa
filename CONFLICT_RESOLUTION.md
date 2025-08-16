# Data Conflict Resolution System

## Overview

The Daily Spend PWA now includes a smart data synchronization system that automatically detects and resolves conflicts between local and online data when users sign in.

## How It Works

### 1. Automatic Conflict Detection
When a verified user signs in, the system automatically:
- Downloads online data from Firebase
- Compares it with local data
- Detects any differences in categories, expenses, or recurring expenses

### 2. Conflict Resolution Scenarios

#### Scenario 2: Returning User (No Local Data, Some Online Data)
- **Action**: Automatically downloads all online data to local storage without user intervention
- **Result**: User's data is restored from the cloud seamlessly
- **Note**: No conflict resolution dialog is shown in this case

#### Scenario 2.5: Fresh Device with Default Categories (Local Data = Default Categories Only, Some Online Data)
- **Action**: Automatically replaces local default categories with online data
- **Result**: User's online data is restored, replacing the default categories that were created on app initialization
- **Note**: This prevents duplicate categories when a fresh device gets default categories then syncs with online data

#### Scenario 3: New User (No Local Data, No Online Data)
- **Action**: No conflicts to resolve
- **Result**: User can start using the app normally

#### Scenario 4: Conflict Detected (Local Data + Online Data + Differences)
- **Action**: Shows conflict resolution dialog
- **User Choices**:
  1. **Merge Data (Recommended)**: Combines both datasets, keeping the most recent version of each item
  2. **Use Local Data**: Uploads local data to cloud, completely replacing online data
  3. **Use Online Data**: Downloads online data, replacing local data (with warning about data loss)

### 3. Smart Merging Algorithm
When merging data, the system:
- Compares timestamps (`createdAt` field)
- Keeps the most recent version of each item
- Preserves all unique items from both sources
- Maintains data integrity and relationships

## User Experience

### Conflict Resolution Dialog
The dialog provides:
- **Clear conflict summary** showing what data differs
- **Data comparison** displaying counts of local vs. online items
- **Three resolution options** with clear descriptions
- **Warning messages** for potentially destructive actions
- **Progress indicators** during synchronization

### Safety Features
- **Non-blocking**: Users can continue using the app even if sync fails
- **Data validation**: Ensures data integrity during merge operations
- **Error handling**: Graceful fallbacks if conflicts can't be resolved
- **User confirmation**: Requires explicit choice for data-destructive actions

## Technical Implementation

### Key Components
- `DataConflictDialog.tsx`: UI component for conflict resolution
- `dataConflictResolver.ts`: Core logic for conflict detection and resolution
- `syncClient.ts`: Integration with authentication and sync systems
- `localStorage.ts`: Data persistence utilities

### Data Flow
1. User signs in → `useRealtimeSync` hook triggers
2. Local and remote data are fetched
3. `analyzeDataConflicts()` compares datasets
4. **Special case**: If no local data exists but online data is available, automatically download all online data
5. **Special case**: If local data consists only of default categories and online data exists, automatically replace local data with online data
6. If conflicts exist between local and online data, show conflict resolution dialog
7. User selects resolution method (if dialog is shown)
8. `applyConflictResolution()` processes the choice
9. Data is synchronized locally and remotely
10. UI is updated to reflect changes

### Conflict Detection Logic
```typescript
const conflict = analyzeDataConflicts(localData, remoteData);
const hasConflicts = conflict.conflicts.categories || 
                    conflict.conflicts.expenses || 
                    conflict.conflicts.recurring;
```

### Resolution Methods
```typescript
type ConflictResolution = 'merge' | 'overwrite-local' | 'overwrite-online' | 'replace-local-with-online';
```

**Resolution Types:**
- **`merge`**: Combines local and online data, keeping the most recent version of each item
- **`overwrite-local`**: Keeps local data unchanged (used when local data is authoritative)
- **`overwrite-online`**: Uploads local data to cloud, replacing online data
- **`replace-local-with-online`**: Downloads online data, completely replacing local data (used for fresh devices with default categories)

## Best Practices

### For Users
- **Choose "Merge Data"** when possible to preserve all your information
- **Backup important data** before choosing destructive options
- **Check the conflict summary** to understand what will change

### For Developers
- **Test with various data scenarios** to ensure robust conflict detection
- **Monitor sync performance** and optimize for large datasets
- **Handle edge cases** like corrupted data or network failures
- **Provide clear error messages** when resolution fails

## Troubleshooting

### Common Issues
1. **Dialog not showing**: Check browser console for sync errors
2. **Merge failures**: Verify data structure and timestamps
3. **Performance issues**: Consider pagination for large datasets

### Debug Information
The system logs detailed information to the browser console:
- Sync initiation and progress
- Data counts and conflict detection
- Resolution choices and outcomes
- Error details and fallback actions

## Future Enhancements

Potential improvements could include:
- **Conflict preview**: Show exactly what will change before applying
- **Selective merging**: Allow users to choose specific items to merge
- **Conflict history**: Track and display previous resolution choices
- **Auto-resolution**: Learn user preferences for future conflicts
- **Batch operations**: Handle multiple conflicts simultaneously