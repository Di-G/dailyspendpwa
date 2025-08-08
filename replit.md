# Daily Expense Tracker

## Overview

This is a full-stack expense tracking application that helps users manage their daily expenses across different categories. The application features a React frontend with TypeScript, an Express.js backend, and uses PostgreSQL with Drizzle ORM for data persistence. Users can add expenses, categorize them, view spending analytics through charts, and navigate expenses via a calendar interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui for consistent design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod for validation
- **Charts**: Chart.js for data visualization

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured but using in-memory storage for development)
- **API Design**: RESTful endpoints for CRUD operations
- **Data Validation**: Zod schemas for request/response validation
- **Development**: Hot reload with Vite middleware integration

### Data Storage
- **Schema Design**: Two main entities - Categories and Expenses with foreign key relationship
- **Storage Layer**: Abstracted storage interface allowing for different implementations (currently using in-memory storage with planned PostgreSQL support)
- **Migration Support**: Drizzle Kit for database migrations

### Key Features
- **Expense Management**: Create, read, and delete expenses with amount, description, category, and date
- **Category System**: Customizable expense categories with color coding
- **Analytics**: Daily totals, category breakdowns, and monthly summaries
- **Visualization**: Pie charts for category distribution and bar charts for trends
- **Calendar View**: Monthly calendar showing daily expense totals
- **Responsive Design**: Mobile-first approach with adaptive layouts

### Development Configuration
- **Build System**: Vite for frontend bundling, esbuild for backend compilation
- **Type Safety**: Shared TypeScript schemas between frontend and backend
- **Development Tools**: Hot module replacement, runtime error overlay for Replit environment
- **Path Aliases**: Configured for clean imports across the application

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL database driver
- **drizzle-orm**: Type-safe database ORM with PostgreSQL dialect
- **express**: Web application framework for the backend API
- **react**: Frontend UI library with TypeScript support
- **@tanstack/react-query**: Server state management and caching

### UI and Design System
- **@radix-ui/***: Comprehensive set of accessible, unstyled UI primitives
- **tailwindcss**: Utility-first CSS framework for styling
- **class-variance-authority**: For managing component variants
- **lucide-react**: Icon library for consistent iconography

### Development and Build Tools
- **vite**: Frontend build tool and development server
- **drizzle-kit**: Database migration and introspection tools
- **@replit/vite-plugin-runtime-error-modal**: Error handling in Replit environment
- **wouter**: Lightweight routing library for React

### Data Validation and Forms
- **zod**: Schema validation for both frontend and backend
- **react-hook-form**: Form state management with validation
- **@hookform/resolvers**: Zod integration for form validation

### Visualization and Charts
- **chart.js**: Canvas-based charting library for analytics
- **embla-carousel-react**: Carousel component for UI interactions
- **date-fns**: Date manipulation utilities for calendar functionality