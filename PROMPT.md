# ИТСМИ — Контекст проекта

## Что это
ИТСМИ — социальная сеть на русском языке. Бэкенд на Node.js + Express + sql.js (SQLite в памяти с сохранением на диск). Фронтенд — чистый HTML/CSS/JS (SPA без фреймворков). Реальтайм через WebSockets.

## Стек
- **Бэкенд:** Node.js, Express, PostgreSQL (pg), bcryptjs, jsonwebtoken, multer, ws, helmet, express-rate-limit, xss, dotenv
- **Фронтенд:** Vanilla JS, CSS переменные
- **Auth:** JWT (access 15мин + refresh 30дней, ротация)
- **Файлы:** Multer → base64 в PostgreSQL (media_url TEXT)

## Структура
```
itsmi/
├── server/
│   ├── index.js          # Express сервер, middleware, роуты
│   ├── db.js             # sql.js база данных, схема, миграции
│   ├── ws.js             # WebSocket сервер, broadcast
│   ├── middleware/
│   │   ├── auth.js       # JWT middleware (requireAuth, requireAdmin)
│   │   └── upload.js     # Multer конфиг
│   └── routes/
│       ├── auth.js       # /api/auth/*
│       ├── posts.js      # /api/posts/*
│       ├── users.js      # /api/users/*
│       ├── channels.js   # /api/channels/*
│       ├── admin.js      # /api/admin/*
│       ├── reports.js    # /api/reports/*
│       └── verification.js # /api/verification/*
├── public/
│   ├── index.html        # SPA оболочка
│   ├── css/
│   │   ├── main.css      # Все стили, CSS переменные темы
│   │   ├── components.css
│   │   └── animations.css
│   └── js/
│       ├── api.js        # fetch обёртка с авто-рефрешем токена
│       ├── ws.js         # WebSocket клиент
│       ├── ui.js         # renderPost, renderComment, toast, modal, skeleton
│       ├── app.js        # Роутер, App.navigateTo(), App.init()
│       └── pages/
│           ├── auth.js   # Логин/регистрация
│           ├── feed.js   # Лента постов
│           ├── channels.js # Каналы
│           ├── profile.js  # Профиль, вкладки, верификация
│           ├── settings.js # Настройки, смена темы/аватара
│           └── admin.js    # Админ панель
└── data/
    └── itsmi.db          # SQLite база (sql.js)
```

## Таблицы БД
- `users` — id, username, display_name, bio, avatar_url, password_hash, verified, role, banned, last_seen, created_at
- `posts` — id, author_id, channel_id, text, media_url, deleted, created_at
- `post_likes` — post_id, user_id
- `reposts` — post_id, user_id, created_at
- `comments` — id, post_id, author_id, text, deleted, created_at
- `comment_likes` — comment_id, user_id
- `channels` — id, owner_id, name, description, avatar_url, verified, banned, created_at
- `channel_subscriptions` — channel_id, user_id
- `follows` — follower_id, following_id
- `refresh_tokens` — id, user_id, token, expires_at
- `reports` — id, reporter_id, post_id, reason, status, created_at
- `verification_requests` — id, user_id, reason, status, reviewed_at, cooldown_until, created_at

## Ключевые детали
- Тема: тёмная по умолчанию, переключается в настройках. CSS переменные: `--bg`, `--bg2`, `--bg3`, `--accent: #5865f2`, `--danger`, `--success`
- Радиусы: `--radius: 20px`, `--radius-sm: 14px`
- Админ аккаунт: `@Egor`, пароль `Egor123!`, role='admin', verified=1
- Минимум никнейма: 5 символов (у Egor 4 — исключение)
- Верифицированный бейдж: SVG зубчатый щит синего цвета `#5865F2`
- WebSocket broadcast при новых постах, лайках, комментариях, удалениях
- Репосты отображаются в ленте с плашкой "Репост от @username"
- Онлайн-статус: точка на аватаре (зелёная = онлайн < 5 мин, серая = оффлайн)
- Верификация: нужно 3+ дня на платформе и 3+ поста. Кулдаун 14 дней после отказа.

## Запуск
```bash
cd itsmi
npm install --ignore-scripts
node server/index.js
# → http://localhost:3000
```

## Для Render (деплой)
- Build: `npm install`
- Start: `node server/index.js`
- Persistent disk смонтировать в `/data` чтобы БД не терялась при рестарте
- Переменная окружения: `JWT_SECRET=...` (обязательно сменить)
- `better-sqlite3` не используется (нет Python/C++ на сборке) — используется `sql.js` (pure JS)

## GitHub репозиторий
Название репозитория на GitHub: **itsmi**
