
# Outbox Scheduler

A full-stack asynchronous email scheduling platform built using React, Node.js, PostgreSQL, Redis and BullMQ.

Outbox Scheduler allows users to compose emails, schedule them for future delivery, monitor their status and cancel pending emails through a dashboard.

## Features

- Schedule emails for future delivery.
- Persistent delayed job scheduling using BullMQ and Redis.
- Background email processing using a dedicated worker.
- Email delivery simulation using Nodemailer and Ethereal SMTP.
- Track scheduled and sent emails.
- Cancel pending scheduled emails.
- PostgreSQL-based email status tracking.
- Automatic dashboard data refresh.
- Recovery of pending jobs after application process restarts.

## Tech Stack

### Frontend
- React
- Vite
- React Router
- CSS
- Custom React Hooks

### Backend
- Node.js
- Express.js
- PostgreSQL
- BullMQ
- Redis
- Nodemailer
- Ethereal SMTP

## Architecture

```text
React Dashboard
      |
      v
React Router
      |
      v
Custom Hooks
      |
      v
Email API Service
      |
      v
Express REST API
      |
      +----------> PostgreSQL
      |
      v
BullMQ Queue
      |
      v
Redis
      |
      v
Email Worker
      |
      v
Nodemailer / Ethereal SMTP
      |
      v
PostgreSQL Status Update
```

## Project Structure

```text
OutBox_Scheduler/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── queues/
│   ├── routes/
│   ├── services/
│   ├── workers/
│   ├── app.js
│   └── server.js
│
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── routes/
│       ├── utils/
│       ├── App.jsx
│       └── main.jsx
│
└── README.md
```

## Prerequisites

- Node.js
- PostgreSQL
- Docker Desktop
- Redis

## Setup Instructions

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd OutBox_Scheduler
```

### 2. Start Redis

```bash
docker run -d \
  --name outbox-redis \
  -p 6379:6379 \
  -v outbox-redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes
```

### 3. Configure PostgreSQL

Create a database named:

```text
outbox_scheduler
```

Create the required emails table using the SQL schema provided in the backend setup.

### 4. Configure backend environment

Create `backend/.env`:

```env
PORT=5000

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/outbox_scheduler

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

Ethereal test credentials can be generated automatically when SMTP credentials are not configured.

### 5. Install backend dependencies

```bash
cd backend
npm install
```

### 6. Start the backend API

```bash
npm run dev
```

### 7. Start the email worker

Open another terminal:

```bash
cd backend
npm run worker
```

### 8. Install frontend dependencies

```bash
cd frontend
npm install
```

### 9. Start the frontend

```bash
npm run dev
```

Open:

http://localhost:5173

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/emails` | Schedule an email |
| GET | `/api/emails` | Retrieve all emails |
| GET | `/api/emails/scheduled` | Retrieve scheduled emails |
| GET | `/api/emails/sent` | Retrieve sent emails |
| DELETE | `/api/emails/:id` | Cancel a scheduled email |

## Reliability and Testing

The implementation has been tested for:

- Delayed job execution through BullMQ.
- Email status persistence in PostgreSQL.
- Background processing through a dedicated worker.
- Application process restart recovery while Redis remains running.
- Cancellation of scheduled emails.
- Skipping cancelled jobs.
- SMTP test-message generation using Ethereal.

## Important Note

Ethereal SMTP is a testing service. It captures messages for preview and does not deliver them to real recipient inboxes.

BullMQ provides retryable background job processing. SMTP delivery and PostgreSQL updates are not an atomic transaction, so exactly-once email delivery is not guaranteed.

## Future Improvements

- Authentication and user-specific email management.
- Retry monitoring and dead-letter handling.
- Rate limiting and email provider integration.
- Worker health monitoring.
- Delivery idempotency and duplicate-send mitigation.
- Deployment with managed Redis and PostgreSQL.
