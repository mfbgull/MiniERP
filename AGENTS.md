# Agent Guidelines for Mini ERP

## Build/Lint/Test Commands

### Client (React/Vite)
- **Development**: `cd client && npm run dev`
- **Build**: `cd client && npm run build`
- **No linting configured**

### Server (Node.js/Express)
- **Development**: `cd server && npm run dev` (uses nodemon)
- **Production**: `cd server && npm start`
- **Test all**: `cd server && npm test` (Jest)
- **Test single file**: `cd server && node test-filename.js` (manual test scripts)
- **No linting configured**

## Code Style Guidelines

### Frontend (React)
- **Components**: Functional components with hooks
- **Imports**: Group by React, third-party libraries, then local imports
- **Styling**: CSS classes/modules, no CSS-in-JS
- **Naming**: PascalCase for components, camelCase for variables/functions
- **JSX**: Multi-line props, self-closing tags when no children

### Backend (Node.js)
- **Modules**: CommonJS (require/module.exports)
- **Async**: Use async/await with try/catch blocks
- **Error handling**: Try/catch in controllers, centralized error middleware
- **Database**: SQLite with prepared statements
- **Naming**: camelCase for functions/variables, UPPER_CASE for constants

### General
- **No TypeScript** - Use plain JavaScript
- **No linting/formatting tools** configured
- **Comments**: Minimal, only when necessary
- **File structure**: Follow existing patterns (controllers, routes, components)</content>
<parameter name="filePath">D:\ai\minierp\AGENTS.md