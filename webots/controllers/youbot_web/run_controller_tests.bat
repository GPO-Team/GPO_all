@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "VCVARS="
if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
if not defined VCVARS if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if not defined VCVARS (
  echo Failed to locate vcvars64.bat. Install Visual Studio 2022 with Desktop development with C++.
  exit /b 1
)

call "%VCVARS%" >nul
if errorlevel 1 exit /b 1

if not defined WEBOTS_HOME (
  if exist "D:\DS\Programs\Webots\include\controller\c\webots\robot.h" (
    set "WEBOTS_HOME=D:\DS\Programs\Webots"
  ) else if exist "C:\Program Files\Webots\include\controller\c\webots\robot.h" (
    set "WEBOTS_HOME=C:\Program Files\Webots"
  )
)

if not exist "%WEBOTS_HOME%\include\controller\c\webots\robot.h" (
  echo Failed to locate Webots headers in "%WEBOTS_HOME%".
  echo Set WEBOTS_HOME to your Webots installation directory and rerun the tests.
  exit /b 1
)

set "WEBOTS_INCLUDE=%WEBOTS_HOME%\include\controller\c"
set "WEBOTS_LIBRARY=%WEBOTS_HOME%\lib\controller"
set "PATH=%WEBOTS_LIBRARY%;%PATH%"
set "CONTROLLER_DIR=%~dp0"
set "OUTPUT_DIR=%CONTROLLER_DIR%build\tests"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

set "SOURCES="
set "OBJECT_LIST=%OUTPUT_DIR%\controller-objects.rsp"
type nul >"%OBJECT_LIST%"
for /f "usebackq delims=" %%S in ("%CONTROLLER_DIR%controller_sources.txt") do (
  if /I not "%%S"=="youbot_web.cpp" (
    set "SOURCES=!SOURCES! %%S"
    echo "%OUTPUT_DIR%\%%~nS.obj">>"%OBJECT_LIST%"
  )
)
set /a PASSED=0
set "TEST_PATTERN=controller_*_test.cpp"
if defined CONTROLLER_TEST_FILTER set "TEST_PATTERN=%CONTROLLER_TEST_FILTER%"

pushd "%CONTROLLER_DIR%"
set "PRODUCTION_BUILD_LOG=%OUTPUT_DIR%\controller-production-build.log"
cl /nologo /std:c++20 /EHsc /O2 /I"%WEBOTS_INCLUDE%" /c !SOURCES! /Fo:"%OUTPUT_DIR%\\" >"!PRODUCTION_BUILD_LOG!" 2>&1
if errorlevel 1 (
  type "!PRODUCTION_BUILD_LOG!"
  echo [webots-test] production compile failed
  goto :test_failed
)
del /q "!PRODUCTION_BUILD_LOG!"

for %%F in (!TEST_PATTERN!) do (
  echo [webots-test] %%F
  set "TEST_BUILD_LOG=%OUTPUT_DIR%\%%~nF-build.log"
  cl /nologo /std:c++20 /EHsc /O2 /I"%WEBOTS_INCLUDE%" /c "%%F" /Fo:"%OUTPUT_DIR%\%%~nF.obj" >"!TEST_BUILD_LOG!" 2>&1
  if not errorlevel 1 cl /nologo /Fe:"%OUTPUT_DIR%\%%~nF.exe" "%OUTPUT_DIR%\%%~nF.obj" @"%OBJECT_LIST%" /link /LIBPATH:"%WEBOTS_LIBRARY%" Controller.lib >>"!TEST_BUILD_LOG!" 2>&1
  if errorlevel 1 (
    type "!TEST_BUILD_LOG!"
    echo [webots-test] compile failed: %%F
    goto :test_failed
  )
  del /q "!TEST_BUILD_LOG!"
  "%OUTPUT_DIR%\%%~nF.exe"
  set "TEST_EXIT=!ERRORLEVEL!"
  if not "!TEST_EXIT!"=="0" (
    echo [webots-test] failed: %%F
    goto :test_failed
  )
  set /a PASSED+=1
)
popd

echo [webots-test] !PASSED! tests passed
exit /b 0

:test_failed
popd
exit /b 1
