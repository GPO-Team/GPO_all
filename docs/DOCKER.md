# Docker и полный запуск

Полностью контейнерный режим с Webots и gateway описан в [FULL-CONTAINER.md](FULL-CONTAINER.md).
Этот документ описывает альтернативный гибридный запуск с Windows Webots.

## Размещение

Windows запускает Webots и gateway. Gateway слушает порт 9004 и защищён токеном;
Docker Desktop предоставляет клиентам адрес `host.docker.internal`.
Planning, route и telemetry работают отдельными Node-процессами в контейнерах
от пользователя `node`, с read-only корнем, `/tmp` в памяти и без Linux capabilities.
Route единолично владеет volume `gpo-stack_missions`. Файлы Webots не монтируются
в сервисные контейнеры. Frontend обслуживается nginx на localhost:8080.
Порты 9001–9003 также опубликованы только на localhost для браузерных клиентов.
Порт localhost:9005 удерживается launcher как блокировка повторного запуска.
Это конфигурация локальной рабочей станции, не публичного сервера.

## Запуск

Установите Node.js 22.19+, Docker Desktop (Linux Engine), Webots и Visual Studio
2022 Build Tools с C++. В корне проекта выполните `npm ci`, затем `npm start`.
Для нестандартной установки Webots задайте `WEBOTS_HOME`.
`npm start -- --no-build` использует уже собранные образы и контроллер.
`npm start -- --headless` запускает физическую симуляцию без отрисовки в fast mode.
`npm start -- --no-webots` запускает только сервисы (для диагностики).

Launcher использует отдельный проект Compose `gpo-stack`. Если после аварийного
выхода остались контейнеры, выполните `docker compose -p gpo-stack down`, затем
повторите запуск. Не добавляйте `-v`: этот флаг удаляет данные миссий.
При штатном Ctrl+C launcher завершает только собственный Webots, делает Compose
down без удаления volume и закрывает gateway. Принудительное закрытие Windows
терминала не гарантирует cleanup. После этого проверьте процессы и контейнеры.

Контроллер пересобирается перед обычным запуском. Webots открывает рабочую копию
мира и контроллера в `WEB_STATE_DIR/runtime-project`; она обновляется при запуске.
Постоянные изменения мира вносите в `webots/worlds/youbot_only.wbt`. Пока сборка/запуск не завершены,
сообщение `Stack ready` не выводится. Health checks проверяют solver, хранилище
миссий и доступность gateway; после открытия Webots launcher также ждёт свежую
телеметрию. Healthcheck unhealthy сам по себе не перезапускает контейнер;
restart policy действует при выходе процесса.

## Конфигурация и данные

Для полного launcher задаются `STACK_TOKEN_FILE` (по умолчанию
`secrets/gateway-token`) и `STACK_WEB_STATE_DIR` (по умолчанию `WEB_STATE_DIR`).
Эти значения передаются gateway явно; отдельный `GATEWAY_TOKEN` из `.env` в этом
режиме не используется. Launcher создаёт временную копию секрета в приватном каталоге и передаёт её
в Compose как file secret. Файл в контейнере доступен UID пользователя `node`,
исходный файл остаётся приватным. Это совместимо с read-only корнем контейнера.
Frontend и planning секрет не получают. Временная копия удаляется после остановки;
при аварии launcher она может остаться в системном temp до ручной очистки.
Сохраните файл секрета между запусками.
Gateway слушает 0.0.0.0 для доступа Docker: ограничьте порт 9004 доверенной
сетью в Windows Firewall. Launcher не меняет правила firewall.

Сервисные логи: `docker compose -p gpo-stack logs --tail 100 -f`.
Docker ограничивает хранение четырьмя файлами по 5 МиБ на контейнер.
Gateway пишет в терминал launcher. Контейнеры получают SIGTERM и 15 секунд
для завершения (внутренний лимит сервисов — 10 секунд).

### Перенос старого локального хранилища миссий

Остановите локальные сервисы и Webots. Сохраните полный набор согласно
OPERATIONS.md. Для первого переноса SQLite в новый volume можно использовать
копию всего остановленного каталога `data/missions`; WAL-файлы должны идти вместе
с базой. Не копируйте файлы работающей базы. Не объединяйте базы разных запусков.
Таблица owner после штатного закрытия пуста. После копирования проверьте историю
миссий до отправки новой команды. Автоматической миграции в launcher нет.

Для копии volume после остановки стека (PowerShell, из корня проекта):

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker run --rm --user 0 --mount type=volume,source=gpo-stack_missions,target=/data,readonly --mount "type=bind,source=$PWD/backups,target=/backup" gpo-service:local tar -czf /backup/missions.tar.gz -C /data .
```

Имя архива выбирайте новым для каждой копии. Для переноса старого остановленного
локального каталога в **новый пустой** `gpo-stack_missions`:

```powershell
docker volume create gpo-stack_missions
docker run --rm --user 0 --mount "type=bind,source=$PWD/data/missions,target=/source,readonly" --mount type=volume,source=gpo-stack_missions,target=/target gpo-service:local sh -c 'test -z "$(ls -A /target)" && cp -a /source/. /target/ && chown -R 1000:1000 /target'
```

Команда отказывается копировать в непустой volume. Используйте её до первого
запуска стека; проверьте код завершения. Для восстановления архива выбирайте
новый volume и сохраняйте прежний до проверки результата. Одновременно
сохраняйте `WEB_STATE_DIR` и секрет: одна база миссий без журнала gateway не
составляет полную копию. Данные не включены в образы.

## Проверки

`npm run test:docker` создаёт временный Compose-проект и файловый gateway,
проверяет frontend, native solver, завершение миссии, SIGKILL/restart route,
идемпотентность, отмену и WebSocket-телеметрию. Это не физический тест.

`npm run test:docker -- --physics` использует настоящий Windows Webots;
проверяет завершение маршрута и отсутствие движения после отмены.
Оба теста занимают порты 8080 и 9001–9004; перед ними остановите рабочий стек.
Тесты удаляют только собственный временный volume, данные `gpo-stack` не затрагивают.

Старый `simulation` профиль из Compose удалён: headless Linux Webots не входит
в выбранную схему. Файл `docker/webots.Dockerfile` оставлен как прежний эксперимент
и не используется полной командой запуска.
