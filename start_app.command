#!/bin/bash

# Change directory to the folder containing this script
cd "$(dirname "$0")"

echo "Starting Japanese Learning System..."

# Function to check if a command exists
command_exists () {
    type "$1" &> /dev/null ;
}

# Check for Node.js
if ! command_exists node ; then
    echo "Node.js not found in PATH. Checking common locations..."
    # Try to find node in common locations
    if [ -f "/usr/local/bin/node" ]; then
        export PATH=$PATH:/usr/local/bin
        echo "Found Node.js at /usr/local/bin/node"
    elif [ -f "/opt/homebrew/bin/node" ]; then
        export PATH=$PATH:/opt/homebrew/bin
        echo "Found Node.js at /opt/homebrew/bin/node"
    elif [ -f "$HOME/.nvm/nvm.sh" ]; then
        echo "Loading NVM..."
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    else
        echo "Error: Node.js is not installed."
        echo "Please install Node.js from https://nodejs.org/"
        read -p "Press Enter to close..."
        exit 1
    fi
fi

# Check backend dependencies
if [ ! -d "server/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd server
    npm install
    cd ..
fi

# Check frontend dependencies
if [ ! -d "client/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd client
    npm install
    cd ..
fi

echo "Starting Backend Server..."
cd server
# Start backend in background, redirecting output
node server.js > ../server.out.log 2> ../server.err.log &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

echo "Starting Frontend Server..."
cd client
# Start frontend in background
# 'npm run dev' runs 'vite'. passing -- --open to open browser
npm run dev -- --open >/dev/null 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..

echo "==================================================="
echo " System Started!"
echo " Backend running on background PID $BACKEND_PID"
echo " Frontend running on background PID $FRONTEND_PID"
echo " Close this window to stop the servers."
echo "==================================================="

# Function to handle cleanup
cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

# Trap signals to cleanup
trap cleanup INT TERM EXIT

# Wait indefinitely so the script doesn't exit (and close the terminal)
wait $BACKEND_PID $FRONTEND_PID
