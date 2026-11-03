# RevenShare

Лендинг и админка заявок. Сайт: [revenshare.ru](https://revenshare.ru)

## Локально

Node.js 20+. Скопируй `.env.example` → `.env.local`, задай `ADMIN_PATH` и `ADMIN_PASSWORD`.

```bash
npm install
npm run dev
```

http://localhost:3041 · админка: `/a/<ADMIN_PATH>`

## Прод

```bash
npm ci
npm run build
npm start
```

Секреты только в `.env.local` на сервере. В репозитории — код сайта и админки, без договоров и демо-проектов.
