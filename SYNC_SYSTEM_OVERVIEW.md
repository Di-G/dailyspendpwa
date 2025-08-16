# Data Synchronization System Overview

## Overview

The Daily Spend PWA now includes a comprehensive data synchronization system that handles all scenarios when a verified user signs in. The system automatically detects data conflicts and provides appropriate user choices for resolution.

## Scenarios Handled

### Scenario 1: No Local Data, Some Online Data
- **Action**: Automatically downloads all online data to local storage
- **User Experience**: Seamless data restoration with toast notification
- **No User Intervention Required**

### Scenario 2: Some Local Data, No Online Data
- **Action**: Shows upload prompt asking user to upload local data to cloud
- **User Experience**: Clear explanation of benefits with option to upload or cancel
- **User Choice Required**: Upload to cloud or continue with local-only data

### Scenario 3: Both Local and Online Data Exist
- **Action**: Analyzes for conflicts and shows resolution dialog if differences detected
- **User Experience**: Three clear options with appropriate warnings
- **User Choice Required**: Must select resolution method

## Conflict Resolution Options

### Option A: Merge Data (Recommended)
- **Description**: Combines both datasets, keeping the most recent version of each item
- **Result**: All data preserved, most recent versions prioritized
- **Risk Level**: Low - no data loss

### Option B: Use Local Data
- **Description**: Uploads local data to cloud, completely replacing online data
- **Result**: Local data becomes authoritative source
- **Risk Level**: High - online data permanently lost
- **Warning**: "This action will completely replace all online data with your local data. Any online data not present in your local storage will be permanently lost from the server."

### Option C: Use Online Data
- **Description**: Downloads online data, replacing local data
- **Result**: Online data becomes authoritative source
- **Risk Level**: High - local data permanently lost
- **Warning**: "This action will permanently remove all local data from your mobile device and replace it with online data. Any local changes not yet synced will be lost forever."

## User Interface Features

### Scrollable Conflict Resolution Dialog
- **ScrollArea**: Ensures all content is accessible on mobile devices
- **Fixed Footer**: Accept/Cancel buttons always visible at bottom
- **Responsive Design**: Works on all screen sizes

### Clear Warnings
- **Destructive Actions**: Red warning boxes for data-loss scenarios
- **Specific Language**: Clear explanation of what will be lost
- **User Confirmation**: Requires explicit choice for destructive actions

### Manual Sync Options
- **Settings Drawer**: New "Data Synchronization" section
- **Three Functions**:
  1. **Download Online Data**: Manual download trigger
  2. **Upload Local Data**: Manual upload (merges with existing)
  3. **Force Upload Local Data**: Completely replaces online data

## Technical Implementation

### Components
- `DataConflictDialog.tsx`: Handles conflict resolution scenarios
- `DataUploadPrompt.tsx`: Prompts for upload when no online data
- `syncClient.ts`: Manages automatic sync logic
- `sync.ts`: Core sync functions
- `dataConflictResolver.ts`: Conflict detection and resolution logic

### Sync Flow
1. **User Signs In** → `useRealtimeSync` hook triggers
2. **Data Analysis** → Local and remote data fetched and compared
3. **Scenario Detection** → Appropriate action taken based on data state
4. **User Choice** → If conflicts exist, user selects resolution method
5. **Data Sync** → Chosen resolution applied locally and remotely
6. **UI Update** → App reflects synchronized data

### Safety Features
- **Non-blocking**: App continues to work even if sync fails
- **Data Validation**: Ensures integrity during operations
- **Error Handling**: Graceful fallbacks with user notifications
- **User Confirmation**: Destructive actions require explicit consent

## User Experience Improvements

### Automatic Actions
- **Smart Detection**: Automatically handles common scenarios
- **No Unnecessary Prompts**: Only shows dialogs when user choice is needed
- **Toast Notifications**: Keeps user informed of automatic actions

### Manual Control
- **Settings Access**: Easy access to manual sync functions
- **Clear Descriptions**: Each function clearly explained
- **Progress Indicators**: Shows sync status during operations

### Mobile Optimized
- **Scrollable Dialogs**: All content accessible on small screens
- **Touch Friendly**: Large buttons and clear touch targets
- **Responsive Layout**: Adapts to different screen sizes

## Usage Examples

### New Device Setup
1. User signs in on new device
2. System detects no local data but online data exists
3. Automatically downloads all online data
4. User sees "Data Restored" notification

### Returning User with Local Changes
1. User signs in on device with local data
2. System detects both local and online data
3. Shows conflict resolution dialog
4. User chooses merge option
5. Data synchronized with most recent versions preserved

### First Time User
1. User signs in with no online data
2. System detects local data but no online data
3. Shows upload prompt explaining benefits
4. User chooses to upload or continue locally

## Benefits

- **Seamless Experience**: Most scenarios handled automatically
- **Data Safety**: Clear warnings for destructive actions
- **User Control**: Manual sync options available
- **Cross-Device Sync**: Access data from any device
- **Data Recovery**: Automatic restoration when possible
- **Conflict Prevention**: Smart merging algorithms
