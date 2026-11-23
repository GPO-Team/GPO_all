# Native Solver

Нативный слой внутри `GPO-main` считает порядок обхода точек на C++.

## Что здесь лежит

- `include/tsp` — типы, RNG, операции над турами, local search и population API
- `include/gpo` — публичные типы и интерфейсы route-solver service layer
- `src` — алгоритмы, построение задачи, solver service и текстовый протокол
- `apps/gpo_route_solver.cpp` — тонкая CLI-точка композиции
- `tests` — автономные C++-тесты service layer
- `route_solver_sources.txt` — единый список исходников core для сборочных систем
- `build_msvc.bat` — сборка под MSVC
- `CMakeLists.txt` — переносимая сборка для Linux и Docker

## Сборка

Из корня `GPO-main`:

```powershell
cd native
.\build_msvc.bat
```

После сборки должен появиться файл:

```text
native\build\gpo_route_solver.exe
```

В Linux или Docker:

```bash
npm run native:build:linux
```

После сборки появится:

```text
native/build/gpo_route_solver
```

## Как это используется

1. `Dashboard.jsx` отправляет точки, задачу и параметры на `http://127.0.0.1:9003/api/solve-route`
2. `ws-bridge.cjs` маппит UI-параметры на нативные параметры solver
3. `gpo_route_solver.exe` возвращает оптимальный порядок обхода
4. `Dashboard.jsx` поверх этого строит безопасный маршрут с обходом forbidden zones через `zonePlanner.js`

## Тесты

На Windows тесты собирают core, CLI и семь независимых test executable:

```powershell
npm run native:test
```

Для CMake используйте `ctest` после сборки с `BUILD_TESTING=ON`.

## Запуск полного контура

```powershell
npm install
npm run native:build
npm run bridge
npm run dev
```
