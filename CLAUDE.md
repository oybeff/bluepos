# Bluepos — POS tizimi parda do'konlari uchun

Expo/React Native мобильное приложение для управления пардa до'конлари (магазинов штор): сделки, клиенты, продукты, склад, финансы, долги, отчёты, калькулятор раскроя.

## Dokumentatsiya

```
.claude/docs/
├── infrastructure/
│   └── arxitektura.md               — API client (apiReq), auth context, React Query, theming, date utils
├── navigation/
│   └── navigatsiya-va-ekranlar.md   — Expo Router, 5 видимых + 16 скрытых табов, stack/modal экраны, AuthGuard
├── auth/
│   └── autentifikatsiya.md          — Login, register, биометрика (Face ID/Touch ID), 401 auto-logout, role routing
├── deals/
│   └── bitimlar-pipeline.md         — 5-этапный pipeline (yangi→tikuvda→tayyor→ornatilmoqda→yopildi), kanban, CRUD
├── products/
│   └── mahsulotlar-va-ombor.md      — Продукты CRUD, категории, штрих-код, stock tracking, ombor-harakati
├── clients/
│   └── mijozlar-crm.md              — Клиенты: список, детали, CRM, SMS кампании, калькуляция "mijoz oldiga"
├── finance/
│   └── moliya-va-kassa.md           — Kassa со сменами, kirim-chiqim, расходы, личные расходы работников
├── debts/
│   └── qarz-daftar.md               — Долговая книга: olindi/berildi, частичные оплаты, SMS напоминания
├── reports/
│   └── hisobotlar.md                — Dashboard, отчёты по продажам/клиентам/кассе, PDF экспорт
├── workers/
│   └── xodimlar-va-panellar.md      — Сотрудники, chevar-panel, haydovchi-panel, расходы
├── notifications/
│   └── xabarnomalar-va-sms.md       — Уведомления (overdue/upcoming/debt/stock), SMS отправка
├── admin/
│   └── super-admin.md               — Мультитенант: магазины, серверы, SMS/Telegram, шаблоны, заявки
├── tools/
│   └── skaner-printer-utillar.md    — Сканер, термопринтер, калькулятор раскроя (5 табов), Payment QR
├── sales/
│   └── sotuv-va-buyurtmalar.md      — POS продажа, заказы, инвойсы, supplier orders
└── ui/
    └── ui-audit.md                  — Playwright UI аудит: 25 экранов, элементы, ошибки, дизайн система
```

## Arxitektura

- **Framework:** Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9
- **Routing:** Expo Router (file-based), React Navigation
- **State:** React Query (TanStack Query v5) для серверного состояния, useState для локального
- **API:** `apiReq<T>(path, options)` в `lib/api.ts` — Bearer JWT, auto 401 logout
- **Auth:** `context/auth.tsx` — AuthProvider + useAuth() hook, AsyncStorage для токена
- **Theming:** light/dark через `useColors()` hook, палитра в `constants/colors.ts`
- **Dates:** `lib/date-utils.ts` — узбекские форматы (fmtDate, fmtDateNum, fmtDateTime, fmtISO, fmtNum)
- **Validation:** Zod

## Foydalanuvchi rollari

| Rol | Redirect | Panel | Imkoniyatlar |
|-----|----------|-------|-------------|
| `super_admin` | `/super-admin` | Super Admin | Магазины, серверы, SMS, заявки, все данные |
| `manager` | `/(tabs)` | Основные табы | Полный доступ к CRM, финансам, отчётам |
| `seller` | `/(tabs)` | Основные табы | Продажи, клиенты |
| `tailor` | `/(tabs)` + `/chevar-panel` | Панель швеи | Свои задачи, статистика |
| `installer` | `/(tabs)` + `/haydovchi-panel` | Панель водителя | Доставки, навигация, звонки |

## Ishlab chiqish buyruqlari

```bash
# Dev server
npm start              # Expo dev server
npx expo start --web   # Web version

# Build
eas build -p android --profile apk     # Android APK
eas build -p android --profile production  # Android AAB (Play Store)
eas build -p ios --profile production      # iOS (App Store)

# OTA Update
eas update --branch production --message "описание"
```

## Server

- **IP:** `164.92.244.229` | SSH: `root`
- **API:** PM2 `blupos` — порт 3001
- **Domain:** `EXPO_PUBLIC_DOMAIN=http://164.92.244.229:3001`
- **DB:** PostgreSQL в Docker, database `blupos`

## EAS / App Store

- **Owner:** `oybeff` (iOS), `oybeff1` (Android Pro)
- **Project ID:** `59e39059-ffcc-4c39-b679-8402283584d0`
- **Bundle ID:** `com.uzbekpos.app`
- **Apple Team:** `4P562ALWLR`
- **OTA Branch:** `production`

## Fayl tuzilmasi

```
app/
├── _layout.tsx              — Root Stack + provider chain + AuthGuard
├── (tabs)/
│   ├── _layout.tsx          — Tab Navigator (5 visible + 16 hidden)
│   ├── index.tsx            — Dashboard/Statistika
│   ├── calculator.tsx       — Калькулятор раскроя (center button)
│   ├── mijoz-oldiga.tsx     — Клиенту навстречу (CRM + калькуляция)
│   ├── oldi-berdi.tsx       — Kirim (приход)
│   └── rasxodlar.tsx        — Расходы
├── login.tsx, register.tsx  — Auth экраны
├── new-deal.tsx             — Создание сделки (modal)
├── deal/[id]/               — Детали/редактирование сделки
├── super-admin.tsx          — Панель суперадмина
├── chevar-panel.tsx         — Панель швеи
├── haydovchi-panel.tsx      — Панель водителя
└── scanner.tsx              — Сканер штрих-кодов (modal)

lib/
├── api.ts                   — apiReq(), все API функции и TypeScript интерфейсы
├── api-client.ts            — setBaseUrl(), setAuthTokenGetter()
├── query-client.ts          — QueryClient instance
├── date-utils.ts            — Узбекские форматы дат
└── printer.ts               — Термопринтер: чеки, этикетки

context/
└── auth.tsx                 — AuthProvider, useAuth()

hooks/
└── useColors.ts             — Light/dark theme colors

constants/
└── colors.ts                — Color palettes
```

## Muhim eslatmalar

- API path всегда без `/api` префикса — `apiReq` добавляет сам: `apiReq("/clients")` → `GET {domain}/api/clients`
- Query keys: `["client-deals"]`, `["kanban"]`, `["products"]`, `["workers"]`, `["clients"]`
- Deal pipeline: `yangi` → `tikuvda` → `tayyor` → `ornatilmoqda` → `yopildi`
- Калькулятор: 5 табов (Xona, Parda, Dike, Jalousie, Karniiz) — каждый с уникальной формулой
- Биометрика: только для быстрого входа (не заменяет пароль), хранит флаг в AsyncStorage
- При 401 от API — автоматический logout с Alert "Sessiya tugadi"
