@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
call "%SCRIPT_DIR%build_msvc.bat"
if errorlevel 1 exit /b 1

set "VCVARS="
if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
if not defined VCVARS if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if not defined VCVARS exit /b 1
call "%VCVARS%" >nul
if errorlevel 1 exit /b 1
where cl >nul 2>nul
if errorlevel 1 exit /b 1

set "OBJ_DIR=%SCRIPT_DIR%build\obj"
set "TEST_DIR=%SCRIPT_DIR%build\tests"
if not exist "%TEST_DIR%" mkdir "%TEST_DIR%"

set "OBJECTS="
for /f "usebackq delims=" %%S in ("%SCRIPT_DIR%route_solver_sources.txt") do set "OBJECTS=!OBJECTS! "%OBJ_DIR%\%%~nS.obj""

for %%T in (route_solver_protocol_test route_problem_test route_solver_service_test random_test tour_operations_test local_search_test population_test) do (
  echo [native-test] %%T.cpp
  cl /nologo /std:c++20 /EHsc /W4 /I"%SCRIPT_DIR%include" "%SCRIPT_DIR%tests\%%T.cpp" !OBJECTS! /Fo"%TEST_DIR%\%%T.obj" /Fe:"%TEST_DIR%\%%T.exe"
  if errorlevel 1 exit /b 1
  "%TEST_DIR%\%%T.exe"
  set "TEST_EXIT=!ERRORLEVEL!"
  if not "!TEST_EXIT!"=="0" exit /b 1
)

echo [native-test] 7 tests passed
