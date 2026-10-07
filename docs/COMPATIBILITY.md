# Запуск и поддержка совместимости

## Весь проект в контейнерах

Нужны Docker Engine с Compose v2.24.4+ на Linux x86-64 либо Docker Desktop с Linux Engine/WSL2 на Windows, браузер с WebGL2. Webots и компилятор на хосте не нужны. Запуск без Node.js:

```sh
git clone --branch dev/nimmwee https://github.com/Vanchoys228/GPO_all.git
cd GPO_all
docker compose -p gpo-full -f compose.yaml -f compose.simulator.yaml up -d --build --wait --wait-timeout 180
```

Откройте http://127.0.0.1:8080/dashboard и нажмите «Показать симуляцию». Выберите перенос demo-box, задайте точку назначения на свободном полу и отправьте миссию. Захват требует контакта пальцев с ручкой; рука движется, груз поднимается и опускается на пол. Ограничения: [MANIPULATOR.md](MANIPULATOR.md).

Вариант с Node.js 22.19.0+:

```sh
npm ci
npm run start:container -- --cpu
```

Первый запуск скачивает образы и ресурсы Webots. CPU-режим использует Xvfb/Mesa и может быть медленным. GPU через WSLg зависит от драйверов: [FULL-CONTAINER.md](FULL-CONTAINER.md). Одновременный запуск `npm start` занимает те же порты.

Остановка с сохранением данных:

```sh
docker compose -p gpo-full -f compose.yaml -f compose.simulator.yaml down
```

## Зафиксированные версии

- Webots R2025a / Ubuntu 22.04 в `docker/webots.Dockerfile`.
- PROTO, mesh-ресурсы и браузерный viewer соответствуют R2025a; ресурсы симулятора кэшируются при сборке.
- npm устанавливается через `npm ci` по `package-lock.json`.
- GitHub Actions закреплены по SHA, CI использует Node.js 22.19.0.

Версионный Docker tag не является неизменяемым digest. APT-пакеты и базовые образы могут измениться при новой сборке. Для точного воспроизведения принятого релиза сохраняйте собранные образы в registry по digest вместе с commit SHA и отчётами проверок.

## Следующие Ubuntu

Контейнер сохраняет Ubuntu 22.04 и библиотеки Webots внутри образа при обновлении Ubuntu на хосте. Ядро, Docker, видеодрайвер и браузер остаются внешними зависимостями. Гарантировать Ubuntu 27/28 до проверки нельзя. ARM64 сейчас не заявлен: выбранный Webots рассчитан на Linux x86-64.

Официальная документация R2025a заявляет Ubuntu LTS 22.04/24.04 и OpenGL 3.3; описывает Docker и headless-запуск через Xvfb:

- [System requirements](https://github.com/cyberbotics/webots/blob/R2025a/docs/guide/system-requirements.md)
- [Installation / Docker](https://github.com/cyberbotics/webots/blob/R2025a/docs/guide/installation-procedure.md#installing-the-docker-image)

## Регулярная поддержка

Workflow `Service portability` проверяет push/PR, поддерживает ручной и еженедельный запуск. Сервисы проверяются на Ubuntu 22.04/24.04; отдельная задача собирает полный контейнерный стек и проверяет камеру, W3D/WASM, маршруты, восстановление сервисов и физический захват/подъём/перенос/отпускание. Это не сертификация будущих Ubuntu или всех видеокарт.

GitHub выполняет scheduled workflow из default branch: еженедельные проверки заработают после интеграции workflow в default branch. Конфигурацию Dependabot также нужно интегрировать в default branch. Она задаёт ежемесячные npm/Docker/Actions обновления отдельными PR в dev/nimmwee; автоматического слияния нет.

Перед обновлением Ubuntu или Webots:

1. Сохранить commit SHA, образы и резервную копию volumes. Сначала обновлять отдельный стенд.
2. Проверить требования новых Docker/Webots. При смене Webots вместе обновить Dockerfile, EXTERNPROTO/mesh URL, viewer и кэш ресурсов.
   Для Node.js выбирать поддерживаемую LTS; при смене согласованно обновить Dockerfile, CI, `engines` и lockfile. Закреплённая версия тоже требует обновлений безопасности.
3. На Linux выполнить `npm ci`, `npm test`, `npm run lint`, `npm run build`, `npm run native:build:linux`, `npm run test:services`.
4. Собрать `docker compose -f compose.yaml -f compose.simulator.yaml build`, выполнить `npm run test:container` при свободных портах 8080/9001/9002/9003/1234. Проверка удаляет только свой временный стек и его volumes.
5. На новой Ubuntu проверить CPU-режим, браузерную сцену, камеру, захват/перенос/отмену; отдельно GPU, если используется. Добавить новую Ubuntu в CI после появления подходящего runner.
6. Принимать обновление с успешными проверками; при регрессии вернуть сохранённые образы и совместимые данные. Миграции данных проверять заранее.

Неуспешные CI-запуски и PR обновлений требуют разбора: Dockerfile не заменяет регулярное обслуживание.
