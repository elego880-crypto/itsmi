<div align="center">
  <img src="public/assets/logo.png" alt="ИТСМИ" width="260" />
  <br/><br/>

  <p><strong>Русскоязычная социальная сеть нового поколения</strong></p>

  <p>
    <a href="https://итсми.site"><img src="https://img.shields.io/badge/сайт-итсми.site-5865f2?style=flat-square" alt="Website"/></a>
    <img src="https://img.shields.io/badge/версия-1.3.0-5865f2?style=flat-square" alt="Version"/>
    <img src="https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"/>
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
    <img src="https://img.shields.io/badge/лицензия-MIT-green?style=flat-square" alt="License"/>
  </p>
</div>

---

## О проекте

**ИТСМИ** — это полноценная русскоязычная социальная сеть с лентой, каналами, подписками, уведомлениями в реальном времени и продуманным интерфейсом. Написана с нуля командой **Aethel Dev** без тяжёлых фреймворков — только Node.js на бэкенде и чистый Vanilla JS на фронтенде.

Проект работает на [итсми.site](https://итсми.site) и обслуживает реальных пользователей.

---

## Возможности

### Пользователи
- Регистрация и авторизация с JWT (access 15 мин + refresh 30 дней, ротация)
- Профиль с аватаром, именем, биографией и онлайн-статусом
- Верификация аккаунта (синий зубчатый щит)
- Подписки и лента подписок
- Система бана

### Контент
- Публикация постов с изображениями (до 5 в день)
- Лайки, репосты, комментарии
- @упоминания с автоматическими уведомлениями
- Редактирование и удаление своих постов
- Закладки

### Каналы
- Создание тематических каналов
- Подписка на каналы
- Верифицированные каналы

### Коммуникация
- Уведомления в реальном времени (WebSocket): лайки, комментарии, подписки, упоминания
- Push-обновления ленты без перезагрузки страницы

### Поиск
- Полнотекстовый поиск по постам и пользователям
- Фильтрация по типу результата

### Интерфейс
- SPA без фреймворков, мгновенная навигация
- Тёмная и светлая тема
- Адаптивный дизайн: сайдбар на десктопе, glassmorphism-панель снизу на мобиле
- Свайп-навигация на мобильных устройствах
- Плавные переходы: fade+slide на десктопе, горизонтальный слайд при свайпе

### Администрирование
- Полная панель управления: пользователи, каналы, посты, жалобы
- Система жалоб с модерацией
- Управление верификацией заявок
- Мониторинг базы данных (использование медиа, статистика)

---

## Стек технологий

| Слой | Технологии |
|------|-----------|
| **Backend** | Node.js, Express 4, PostgreSQL, `pg` |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **Real-time** | WebSocket (`ws`) |
| **Медиа** | Multer, Sharp (сжатие до 1 MB, base64 в БД) |
| **Безопасность** | Helmet, express-rate-limit, XSS-фильтрация |
| **Frontend** | Vanilla JS, CSS Variables, Inter (Google Fonts) |
| **Деплой** | PM2, Caddy (HTTPS + Let's Encrypt), Ubuntu 24.04 |

---

## Структура проекта

```
itsmi/
├── server/
│   ├── index.js              # Точка входа, middleware, маршруты
│   ├── db.js                 # PostgreSQL pool, схема, миграции
│   ├── ws.js                 # WebSocket сервер (broadcast, sendToUser)
│   ├── notif.js              # Создание уведомлений, обработка упоминаний
│   ├── middleware/
│   │   ├── auth.js           # JWT middleware (requireAuth, requireAdmin)
│   │   └── upload.js         # Multer + Sharp (compressToBase64)
│   └── routes/
│       ├── auth.js           # /api/auth/*
│       ├── posts.js          # /api/posts/*
│       ├── users.js          # /api/users/*
│       ├── channels.js       # /api/channels/*
│       ├── search.js         # /api/search/*
│       ├── notifications.js  # /api/notifications/*
│       ├── bookmarks.js      # /api/bookmarks/*
│       ├── reports.js        # /api/reports/*
│       ├── verification.js   # /api/verification/*
│       └── admin.js          # /api/admin/*
└── public/
    ├── index.html            # SPA оболочка
    ├── css/
    │   ├── main.css          # Переменные темы, базовые стили
    │   ├── components.css    # Компоненты UI
    │   └── animations.css    # Анимации и переходы
    └── js/
        ├── api.js            # fetch-обёртка с авторефрешем токена
        ├── ws.js             # WebSocket клиент
        ├── ui.js             # renderPost, toast, modal, skeleton
        ├── app.js            # Роутер, App.navigateTo(), свайп
        └── pages/
            ├── auth.js
            ├── feed.js
            ├── channels.js
            ├── profile.js
            ├── settings.js
            ├── search.js
            ├── notifications.js
            ├── bookmarks.js
            └── admin.js
```

---

## Схема базы данных

```
users               — аккаунты пользователей
posts               — публикации
post_likes          — лайки к постам
reposts             — репосты
comments            — комментарии
comment_likes       — лайки к комментариям
channels            — каналы
channel_subscriptions — подписки на каналы
follows             — подписки между пользователями
refresh_tokens      — токены обновления
reports             — жалобы на контент
verification_requests — заявки на верификацию
bookmarks           — закладки
notifications       — уведомления (like/comment/follow/mention)
```

---

## Быстрый старт

### Требования

- Node.js 20+
- PostgreSQL 14+

### Установка

```bash
git clone https://github.com/elego880-crypto/itsmi.git
cd itsmi
npm install
```

### Настройка окружения

```bash
cp .env.example .env
```

Отредактируй `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/itsmi_db
JWT_SECRET=your_long_random_secret_here
NODE_ENV=development
ADMIN_USERNAME=Egor
ADMIN_PASSWORD=your_admin_password
PORT=3000
```

### Запуск

```bash
# Разработка (с авторестартом)
npm run dev

# Продакшн
npm start
```

Открой [http://localhost:3000](http://localhost:3000)

> При первом запуске сервер автоматически создаёт все таблицы и аккаунт администратора.

---

## Деплой на продакшн

Проект развёрнут на VPS [aeza.net](https://aeza.net) (Ubuntu 24.04).

### Стек деплоя

- **PM2** — управление процессом Node.js
- **Caddy** — реверс-прокси с автоматическим HTTPS

### Caddyfile

```
{
    email admin@итсми.site
}

xn--h1aalte.site {
    reverse_proxy localhost:3000
}
```

### Обновление

```bash
ssh root@your-server-ip
cd /var/www/itsmi
git pull
pm2 restart itsmi
```

---

## Переменные окружения

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `DATABASE_URL` | URL подключения к PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Секрет для подписи JWT токенов | Случайная строка 64+ символа |
| `NODE_ENV` | Окружение (`development` / `production`) | `production` |
| `ADMIN_USERNAME` | Никнейм администратора | `Egor` |
| `ADMIN_PASSWORD` | Пароль администратора | Надёжный пароль |
| `PORT` | Порт сервера | `3000` |

---

## Безопасность

- Все запросы к API защищены JWT
- Rate limiting: 20 запросов/15 мин на авторизацию, 120 запросов/мин на API
- Helmet с настроенным CSP
- XSS-фильтрация пользовательского контента
- Пароли хешируются через bcrypt
- Изображения проходят через sharp перед сохранением

---

## Авторы

<table>
  <tr>
    <td align="center">
      <strong>Melnik Egor</strong><br/>
      <sub>Founder & Lead Developer</sub><br/>
      <sub>Aethel Dev</sub>
    </td>
  </tr>
</table>

---

## Лицензия

MIT © 2025–2026 Melnik Egor, Aethel Dev
