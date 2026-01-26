# Routed

**A Travel Partner Recommendation System**

**ECE 651 - Foundations of Software Engineering**

## Overview

Routed is a travel partner recommendation system designed to connect travelers with compatible companions based on personal preferences, trip details, and location. Unlike other platforms, Routed focuses on meaningful travel connections through precise matching algorithms and consent-driven matchmaking.

## Problem Statement

Many individuals plan trips at random dates due to hybrid work and academic schedules. While they seek compatible companions for social interaction and enjoyable trips, existing online platforms don't adequately account for personal preferences, resulting in non-compatible matches.

## Key Features (Most are yet to be implemented)

- **User Authentication** - Secure login and registration system
- **Profile Management** - Customize your travel preferences and interests
- **Trip Management** - Create and manage trip details with structured data
- **Smart Recommendations** - Algorithm-driven matching based on:
  - Personal preferences
  - Trip details and dates
  - Location compatibility
  - User interests
- **Consent-Driven Matching** - Privacy-focused matchmaking with user control
- **Enhanced Privacy** - Your data is protected and shared only with consent

## Architecture

```
Routed/
├── backend/          # FastAPI backend server
│   ├── src/
│   │   └── backend/
│   │       ├── main.py           # FastAPI application
│   │       ├── loggers/          # Logging system
│   │       └── ...
│   └── tests/        # Backend tests
├── frontend/         # React + TypeScript frontend
│   └── src/
└── project docs/     # Project documentation
```

## Getting Started

### Prerequisites

- Python 3.14+
- Node.js 18+
- Poetry (for Python dependency management)

### Backend Setup

```bash
cd backend
poetry install
poetry run dev
```

The backend server will start at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at `http://localhost:5173`

## Testing

### Backend Tests

```bash
cd backend
poetry run test
```

## Development Approach

- **Modular Design** - Each component developed independently
- **Agile Methodology** - Iterative development with sprint planning
- **Backlog Planning** - Structured task management
- **Team Collaboration** - Task allocation and milestone tracking

## Project Goals

- Test effectiveness of the matching algorithm
- Measure user satisfaction and engagement
- Demonstrate improved discoverability of compatible travel companions
- Achieve higher confidence in partner selection

## Privacy & Security

Routed prioritizes user privacy with:

- Consent-based information sharing
- Secure authentication
- Controlled visibility of trip details
- User-managed privacy settings

## License

This project is developed as part of ECE 651 coursework.

## Contributing

This is an academic project. For questions or suggestions, please contact the development team.

