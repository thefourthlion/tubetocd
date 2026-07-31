# SQLite Node.js Server

Auto-generated Node.js server with SQLite database.

## Features

- Express.js REST API
- SQLite database with Sequelize ORM
- CRUD operations
- Docker support
- Existing database files are preserved (never overwritten)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Copy `.env` file and update `DATABASE_PATH` if needed.

3. Start the server:
```bash
npm start
```

The SQLite database file is created automatically at `./data/database.sqlite` if it does not already exist. Existing database files are never overwritten.

### Docker Setup

Run with Docker Compose:
```bash
docker-compose up -d
```

The SQLite database is persisted in a Docker volume at `/app/data`.

## API Endpoints

Your custom model routes will be available at `/api/{model_name}/`

### Standard CRUD Operations
- `POST /api/{model}/create` - Create new record
- `GET /api/{model}/read` - Read all records (with pagination)
- `GET /api/{model}/read/:id` - Read specific record by ID
- `PUT /api/{model}/update/:id` - Update record by ID
- `DELETE /api/{model}/delete/:id` - Delete record by ID

## Environment Variables

- `DATABASE_PATH` - Path to the SQLite database file (default: `./data/database.sqlite`)
- `PORT` - Server port (default: 3025)
- `CORS_ORIGINS` - Extra allowed browser origins (comma-separated). Defaults include `https://tubetocd.com`, `https://www.tubetocd.com`, and `http://localhost:3024`
