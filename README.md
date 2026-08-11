# Precision Weather

Aplicativo de previsão meteorológica multi-modelo, com backend de agregação e app mobile Expo/React Native.

## Objetivo

Combinar previsões de vários modelos e provedores, normalizar as variáveis, detectar divergência entre modelos e produzir um consenso probabilístico. O sistema foi desenhado para aceitar fontes sem chave (Open-Meteo/modelos públicos) e fontes opcionais com chave (Meteoblue, OpenWeather, WeatherAPI).

## Fontes suportadas

- Open-Meteo: ECMWF IFS/AIFS, DWD ICON, NOAA GFS, Météo-France, entre outros conforme disponibilidade da API.
- OpenWeather One Call, opcional.
- WeatherAPI, opcional.
- Meteoblue, opcional.

A precisão real depende da qualidade/localização das fontes, resolução do terreno, assimilação de observações, horizonte de previsão e condições atmosféricas. O aplicativo não promete precisão perfeita; ele calcula consenso e confiança e mostra divergências.

## Executar

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### App

```bash
cd app
npm install
npx expo start
```

Defina `EXPO_PUBLIC_API_URL` apontando para o backend.

## Variáveis opcionais

- `METEOBLUE_API_KEY`
- `OPENWEATHER_API_KEY`
- `WEATHERAPI_KEY`

O backend funciona sem essas três chaves, usando os modelos públicos do Open-Meteo.
