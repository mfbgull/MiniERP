#!/bin/bash

echo "===================================="
echo "Starting Mini ERP System..."
echo "===================================="
echo ""

echo "[1/2] Starting Backend Server..."
cd server
npm start &
BACKEND_PID=$!
sleep 3

echo "[2/2] Starting Frontend..."
cd ../client
npm run dev &
FRONTEND_PID=$!
sleep 2

echo ""
echo "===================================="
echo "Mini ERP Started Successfully!"
echo "===================================="
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo "===================================="
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
