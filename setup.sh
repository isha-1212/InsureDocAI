#!/bin/bash

echo "========================================"
echo "Setting up Mediclaim System..."
echo "========================================"

# Check if Docker is running
if ! docker version > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env files exist
# Backend .env should be configured manually

if [ ! -f "frontend/.env" ]; then
    echo "Setting up frontend environment..."
    cp "frontend/.env.example" "frontend/.env"
    echo "NOTE: Please edit frontend/.env with your Supabase credentials"
fi

echo "Building and starting services..."
docker-compose up --build -d

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "Admin Panel: http://localhost:8000/admin"
echo "========================================"
echo "Note: If this is your first time running,"
echo "please configure the .env files with proper credentials"
echo "========================================"