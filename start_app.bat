@echo off

echo Starting Japanese Learning System...
echo.

:: Check if Node.js is available
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found in PATH. Searching for Node.js installation...
    
    :: Check common Node.js installation paths
    set "NODE_FOUND="
    
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_PATH=C:\Program Files\nodejs"
        set "NODE_FOUND=1"
    ) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
        set "NODE_PATH=C:\Program Files (x86)\nodejs"
        set "NODE_FOUND=1"
    ) else if exist "%USERPROFILE%\AppData\Roaming\nvm" (
        :: Check for nvm installations
        for /d %%i in ("%USERPROFILE%\AppData\Roaming\nvm\v*") do (
            if exist "%%i\node.exe" (
                set "NODE_PATH=%%i"
                set "NODE_FOUND=1"
                goto :node_found
            )
        )
    ) else if exist "%USERPROFILE%\AppData\Local\Programs\nodejs\node.exe" (
        set "NODE_PATH=%USERPROFILE%\AppData\Local\Programs\nodejs"
        set "NODE_FOUND=1"
    ) else if exist "%ProgramFiles%\nodejs\node.exe" (
        set "NODE_PATH=%ProgramFiles%\nodejs"
        set "NODE_FOUND=1"
    )
    
    :node_found
    if defined NODE_FOUND (
        echo Found Node.js at: %NODE_PATH%
        echo Adding to PATH for this session...
        set "PATH=%NODE_PATH%;%PATH%"
        echo.
    ) else (
        echo.
        echo ===================================================
        echo  ERROR: Node.js not found!
        echo ===================================================
        echo Please install Node.js from: https://nodejs.org
        echo After installation, restart this script.
        echo ===================================================
        pause
        exit /b 1
    )
) else (
    echo Node.js found in PATH.
    echo.
)
echo.

:: Check and install backend dependencies
echo Checking backend dependencies...
if not exist "server\node_modules\" (
    echo Backend dependencies not found. Installing...
    cd server
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install backend dependencies!
        echo Please make sure Node.js and npm are installed.
        pause
        exit /b 1
    )
    cd ..
    echo Backend dependencies installed successfully!
) else (
    echo Backend dependencies found.
)

echo.

:: Check and install frontend dependencies
echo Checking frontend dependencies...
if not exist "client\node_modules\" (
    echo Frontend dependencies not found. Installing...
    cd client
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install frontend dependencies!
        echo Please make sure Node.js and npm are installed.
        pause
        exit /b 1
    )
    cd ..
    echo Frontend dependencies installed successfully!
) else (
    echo Frontend dependencies found.
)

echo.
echo All dependencies are ready!
echo.

:: Find Node path for explicit usage
for /f "tokens=*" %%i in ('where node') do set NODE_EXE=%%i
if not defined NODE_EXE (
    if defined NODE_PATH set NODE_EXE=%NODE_PATH%\node.exe
)

:: Start Backend
echo Starting Backend Server...
start "JP Backend" cmd /c "cd server && echo [Session Started %date% %time%] >> ..\server.out.log && "%NODE_EXE%" server.js >> ..\server.out.log 2>> ..\server.err.log"

:: Start Frontend
echo Starting Frontend Server...
start "JP Frontend" cmd /c "cd client && echo [Session Started %date% %time%] >> ..\client.out.log && "%NODE_EXE%" node_modules/vite/bin/vite.js --open >> ..\client.out.log 2>> ..\client.err.log"

:: Wait for servers to initialize
echo Waiting for servers to start...
timeout /t 5 >nul

:: Open Browser
echo Opening Application...
:: Browser is opened automatically by Vite (--open flag)

echo.
echo ===================================================
echo  System Started!
echo  Please keep the two new command windows open.
echo ===================================================
pause
