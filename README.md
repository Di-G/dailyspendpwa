# Daily Expense Tracker PWA

A Progressive Web App for tracking daily expenses with a beautiful, modern UI. This app stores all data locally in the browser using localStorage, making it completely offline-capable and privacy-focused.

## Features

- **Expense Tracking**: Add, view, and delete daily expenses
- **Category Management**: Create and manage expense categories with custom colors
- **Analytics**: View expense breakdowns by category and time periods
- **Multiple Views**: 
  - Expense entry form with daily summary
  - Calendar view for date-based navigation
  - Charts view with pie charts and bar graphs
- **Currency Support**: Switch between USD and INR
- **PWA Features**: Installable app with offline support
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **UI Components**: Radix UI with Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation
- **Charts**: Chart.js for data visualization
- **Routing**: Wouter for lightweight routing
- **Storage**: Browser localStorage for data persistence
- **Build Tool**: Vite with PWA plugin

## Getting Started

### Prerequisites

- Node.js 18+ (recommended) or 20+
- npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dailyspendpwa
```

2. Install dependencies:
```bash
# If PowerShell blocks npm scripts on Windows, either use Command Prompt (cmd)
# or run this once in PowerShell: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
npm ci
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview the production build

```bash
npm run preview
```

## Data Storage

All data is stored locally in the browser's localStorage:

- **Categories**: Stored under `dailyspend_categories` key
- **Expenses**: Stored under `dailyspend_expenses` key

The app automatically initializes with default categories on first run:
- Food & Dining (Red)
- Transportation (Blue)
- Shopping (Green)
- Entertainment (Yellow)
- Bills & Utilities (Purple)
- Healthcare (Pink)

## Project Structure

```
dailyspendpwa/
├── src/                   # Source code
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and services
│   ├── pages/            # Page components
│   └── ui/               # UI component library
├── public/               # Static assets
├── shared/               # Shared types and schemas
├── package.json          # Dependencies and scripts
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind CSS configuration
└── index.html            # Entry point
```

## Key Components

- **ExpenseEntry**: Main expense input form with daily summary
- **CategoryManagement**: Category creation and management
- **ChartsView**: Analytics with pie charts and bar graphs
- **CalendarView**: Date-based expense viewing
- **localStorage.ts**: Data persistence service
- **queryClient.ts**: Mock API layer for localStorage integration

## Browser Support

This app works in all modern browsers that support:
- ES6+ JavaScript
- localStorage API
- Service Workers (for PWA features)

## Privacy

Since all data is stored locally in your browser:
- No data is sent to external servers
- Your expense data remains private
- Data persists across browser sessions
- You can clear data by clearing browser storage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see `LICENSE` file for details. 
