# replit.md

## Overview

Shape Quest is a mobile puzzle game built with React Native and Expo. Players solve geometric shape-matching puzzles across procedurally generated levels. The app renders colored shapes (rectangles, circles, triangles, stripes) on an SVG game board divided into a grid, and the player must identify or match a target cell. The project includes a backend Express server for API support and uses a PostgreSQL database with Drizzle ORM for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Mobile App)
- **Framework**: React Native with Expo SDK 54, using the Expo Router (file-based routing under `app/`)
- **Navigation**: Expo Router with a single-screen Stack layout. The main game screen is `app/index.tsx`
- **State Management**: Local React state for game logic; TanStack React Query for server data fetching
- **Animations**: React Native Reanimated for smooth game animations and transitions
- **Styling**: React Native StyleSheet with a custom dark theme defined in `constants/colors.ts`
- **Fonts**: Google Fonts (Rubik family: Regular, Medium, Bold) loaded via `@expo-google-fonts/rubik`
- **SVG Rendering**: `react-native-svg` for drawing game shapes on the board (`components/GameBoard.tsx`)
- **Haptics**: `expo-haptics` for tactile feedback during gameplay
- **Error Handling**: Class-based ErrorBoundary component wrapping the entire app

### Game Engine
- **Location**: `lib/game-engine.ts` — pure TypeScript module with no UI dependencies
- **Level Generation**: Procedural level generation using seeded random functions for reproducibility
- **Grid System**: 6 rows × 4 columns grid; shapes are placed within grid cells
- **Shape Types**: rect, circle, triangle, right-triangle, stripe
- **Color Palette**: 14 predefined game colors in `constants/colors.ts`

### Backend (Express Server)
- **Framework**: Express 5 running on Node.js
- **Location**: `server/` directory — `index.ts` (entry), `routes.ts` (API routes), `storage.ts` (data layer)
- **API Pattern**: All routes should be prefixed with `/api`
- **CORS**: Dynamic CORS setup supporting Replit dev/deployment domains and localhost for Expo web dev
- **Storage**: Currently uses in-memory storage (`MemStorage` class) with an `IStorage` interface designed for easy swapping to database-backed implementation
- **Static Serving**: In production, serves a landing page from `server/templates/landing-page.html`

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` — currently has a `users` table with id, username, password
- **Validation**: Zod schemas generated from Drizzle schema via `drizzle-zod`
- **Migrations**: Output to `./migrations` directory, managed by `drizzle-kit`
- **Push Command**: `npm run db:push` to sync schema to database
- **Note**: The storage layer currently uses in-memory Maps, not the PostgreSQL database. The Drizzle schema is set up but not yet wired into the storage implementation.

### Shared Code
- **Location**: `shared/` directory — contains code shared between frontend and backend
- **Path Alias**: `@shared/*` maps to `./shared/*`, `@/*` maps to `./*`

### Build & Development
- **Dev Mode**: Two processes — `expo:dev` for the mobile app, `server:dev` for the Express backend
- **Server Dev**: Uses `tsx` for TypeScript execution in development
- **Server Build**: Uses `esbuild` to bundle server code to `server_dist/`
- **Static Build**: Custom build script at `scripts/build.js` for Expo web static builds
- **Patch Package**: `postinstall` runs `patch-package` for any dependency patches

## External Dependencies

### Core Services
- **PostgreSQL**: Database provisioned via Replit (connection via `DATABASE_URL` environment variable)
- **Replit Hosting**: Deployment uses Replit-specific environment variables (`REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS`, `REPLIT_INTERNAL_APP_DOMAIN`)

### Key Libraries
- **Expo SDK 54**: Core mobile framework with plugins for router, fonts, web browser
- **Drizzle ORM + drizzle-kit**: Database schema management and query building
- **TanStack React Query**: Server state management and caching
- **React Native Reanimated**: Animation engine
- **React Native Gesture Handler**: Touch/gesture handling
- **React Native SVG**: SVG rendering for game graphics
- **Express 5**: HTTP server framework
- **pg**: PostgreSQL client for Node.js
- **Zod**: Runtime type validation (used with drizzle-zod)

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required for database operations)
- `EXPO_PUBLIC_DOMAIN`: Public domain for API requests from the mobile app
- `REPLIT_DEV_DOMAIN`: Replit development domain
- `REPLIT_DOMAINS`: Comma-separated list of Replit deployment domains
- `REPLIT_INTERNAL_APP_DOMAIN`: Internal deployment domain