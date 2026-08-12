import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

const API_URL = 'https://api.open-meteo.com/v1/forecast';

type Point = {
  lat: number;
  lon: number;
  elevation?: number;
};

type WeatherHour = {
  time: string;
  tempC: number;
  feelsC: number;
  humidity: number;
  precipProbability: number;
  windKmh: number;
  windDirection: number;
};

type WeatherDay = {
  date: string;
  max: number;
  min: number;
  rain: number;
};

type Weather = {
  current: {
    tempC: number;
    feelsC: number;
    humidity: number;
    precipProbability: number;
    windKmh: number;
    windDirection: number;
  };
  hourly: WeatherHour[];
  daily: WeatherDay[];
};

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
  });
}

function windDirection(degrees: number) {
  const directions = [
    'N',
    'NE',
    'L',
    'SE',
    'S',
    'SO',
    'O',
    'NO',
  ];

  return directions[Math.round(degrees / 45) % 8];
}

async function fetchWeather(point: Point): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(point.lat),
    longitude: String(point.lon),
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation_probability',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
    ].join(','),
    timezone: 'auto',
    forecast_days: '10',
  });

  if (point.elevation != null) {
    params.set('elevation', String(Math.round(point.elevation)));
  }

  const response = await fetch(`${API_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Erro da API: ${response.status}`);
  }

  const data = await response.json();

  if (!data.current || !data.hourly || !data.daily) {
    throw new Error('Resposta inválida da API meteorológica');
  }

  const hourly: WeatherHour[] = data.hourly.time.map(
    (time: string, index: number) => ({
      time,
      tempC: data.hourly.temperature_2m[index] ?? 0,
      feelsC: data.hourly.apparent_temperature[index] ?? 0,
      humidity: data.hourly.relative_humidity_2m[index] ?? 0,
      precipProbability:
        data.hourly.precipitation_probability[index] ?? 0,
      windKmh: data.hourly.wind_speed_10m[index] ?? 0,
      windDirection: data.hourly.wind_direction_10m[index] ?? 0,
    })
  );

  const daily: WeatherDay[] = data.daily.time.map(
    (date: string, index: number) => ({
      date,
      max: data.daily.temperature_2m_max[index] ?? 0,
      min: data.daily.temperature_2m_min[index] ?? 0,
      rain: data.daily.precipitation_probability_max[index] ?? 0,
    })
  );

  return {
    current: {
      tempC: data.current.temperature_2m ?? 0,
      feelsC: data.current.apparent_temperature ?? 0,
      humidity: data.current.relative_humidity_2m ?? 0,
      precipProbability: 0,
      windKmh: data.current.wind_speed_10m ?? 0,
      windDirection: data.current.wind_direction_10m ?? 0,
    },
    hourly,
    daily,
  };
}

export default function App() {
  const [weather, setWeather] = useState<Weather | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [point, setPoint] = useState<Point>({
    lat: -27.830,
    lon: -50.349,
    elevation: 900,
  });

  async function load(p: Point = point) {
    try {
      setError(null);

      const result = await fetchWeather(p);

      setWeather(result);
    } catch (e: any) {
      console.log('Erro meteorológico:', e);

      setError(
        e?.message ||
          'Não foi possível carregar a previsão do tempo.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function useLocation() {
    try {
      setError(null);

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setError(
          'Permissão de localização não concedida.'
        );
        return;
      }

      const position =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const newPoint: Point = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        elevation:
          position.coords.altitude ?? undefined,
      };

      setPoint(newPoint);

      setLoading(true);

      await load(newPoint);
    } catch (e: any) {
      setError(
        e?.message ||
          'Não foi possível obter sua localização.'
      );

      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const hourly = useMemo(() => {
    if (!weather?.hourly) return [];

    const now = new Date();

    return weather.hourly
      .filter((item) => new Date(item.time) >= now)
      .slice(0, 24);
  }, [weather]);

  const sourceText =
    'Open-Meteo • modelos meteorológicos integrados';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>
              PRECISION WEATHER
            </Text>

            <Text style={styles.subtitle}>
              {point.lat.toFixed(3)}, {point.lon.toFixed(3)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.locBtn}
            onPress={useLocation}
          >
            <Text style={styles.locText}>
              Minha localização
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color="#B9D2EB"
            />

            <Text style={styles.loadingText}>
              Carregando previsão...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>
              {error}
            </Text>

            <TouchableOpacity
              onPress={() => load()}
              style={styles.retry}
            >
              <Text style={styles.retryText}>
                Recarregar
              </Text>
            </TouchableOpacity>
          </View>
        ) : weather ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>
                PREVISÃO ATUAL
              </Text>

              <Text style={styles.temp}>
                {Math.round(
                  weather.current.tempC
                )}
                °
              </Text>

              <Text style={styles.feel}>
                Sensação{' '}
                {Math.round(
                  weather.current.feelsC
                )}
                ° • Umidade{' '}
                {Math.round(
                  weather.current.humidity
                )}
                %
              </Text>

              <View style={styles.confRow}>
                <Text style={styles.conf}>
                  💧 Umidade{' '}
                  {Math.round(
                    weather.current.humidity
                  )}
                  %
                </Text>

                <Text style={styles.detail}>
                  💨{' '}
                  {Math.round(
                    weather.current.windKmh
                  )}{' '}
                  km/h
                </Text>
              </View>

              <Text style={styles.windDirection}>
                Vento{' '}
                {windDirection(
                  weather.current.windDirection
                )}{' '}
                •{' '}
                {Math.round(
                  weather.current.windDirection
                )}
                °
              </Text>
            </View>

            <Text style={styles.section}>
              Próximas 24 horas
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {hourly.map((h) => (
                <View
                  key={h.time}
                  style={styles.hourCard}
                >
                  <Text style={styles.hour}>
                    {fmtHour(h.time)}
                  </Text>

                  <Text style={styles.hourTemp}>
                    {Math.round(h.tempC)}°
                  </Text>

                  <Text style={styles.rain}>
                    ☂ {Math.round(
                      h.precipProbability
                    )}
                    %
                  </Text>

                  <Text style={styles.wind}>
                    ↗ {Math.round(h.windKmh)} km/h
                  </Text>

                  <Text style={styles.mini}>
                    💧 {Math.round(h.humidity)}%
                  </Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.section}>
              Previsão para 10 dias
            </Text>

            {weather.daily.map((day) => (
              <View
                key={day.date}
                style={styles.dayRow}
              >
                <Text style={styles.day}>
                  {fmtDay(day.date)}
                </Text>

                <Text style={styles.dayTemp}>
                  {Math.round(day.max)}° /{' '}
                  {Math.round(day.min)}°
                </Text>

                <Text style={styles.dayRain}>
                  Chuva {Math.round(day.rain)}%
                </Text>
              </View>
            ))}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Fontes utilizadas
              </Text>

              <Text style={styles.sources}>
                {sourceText}
              </Text>

              <Text style={styles.explain}>
                Os dados são obtidos diretamente
                através da API meteorológica do
                Open-Meteo. A previsão utiliza os
                modelos meteorológicos disponíveis
                para a localização selecionada.
              </Text>

              <Text style={styles.coordinates}>
                Localização:{' '}
                {point.lat.toFixed(4)},{' '}
                {point.lon.toFixed(4)}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#08111F',
  },

  container: {
    padding: 18,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  brand: {
    color: '#C9D8EA',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.6,
  },

  subtitle: {
    color: '#7F91A8',
    marginTop: 4,
  },

  locBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#2C4865',
    borderRadius: 12,
  },

  locText: {
    color: '#B9D2EB',
    fontSize: 12,
  },

  loading: {
    alignItems: 'center',
    marginTop: 100,
  },

  loadingText: {
    color: '#7F91A8',
    marginTop: 15,
  },

  hero: {
    backgroundColor: '#102137',
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E3B5D',
  },

  heroLabel: {
    color: '#7EA4C7',
    fontSize: 12,
    fontWeight: '700',
  },

  temp: {
    color: '#F4F8FC',
    fontSize: 72,
    fontWeight: '200',
    marginTop: 4,
  },

  feel: {
    color: '#AEBED0',
  },

  confRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },

  conf: {
    color: '#9CE3B1',
    fontWeight: '700',
  },

  detail: {
    color: '#B9C7D5',
  },

  windDirection: {
    color: '#8097AE',
    marginTop: 10,
    fontSize: 12,
  },

  section: {
    color: '#EAF1F8',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 28,
    marginBottom: 12,
  },

  hourCard: {
    width: 106,
    backgroundColor: '#0E1C2D',
    padding: 13,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#203950',
  },

  hour: {
    color: '#7F91A8',
    fontSize: 12,
  },

  hourTemp: {
    color: '#F2F7FB',
    fontSize: 28,
    fontWeight: '600',
    marginVertical: 6,
  },

  rain: {
    color: '#9FC5E5',
  },

  wind: {
    color: '#B9C5D2',
    fontSize: 12,
    marginTop: 7,
  },

  mini: {
    color: '#6D86A0',
    fontSize: 10,
    marginTop: 8,
  },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#15263A',
  },

  day: {
    width: 100,
    color: '#AFC0D0',
    textTransform: 'capitalize',
  },

  dayTemp: {
    color: '#F4F8FC',
    fontSize: 16,
    width: 100,
  },

  dayRain: {
    color: '#9FB6C9',
    flex: 1,
  },

  card: {
    backgroundColor: '#0E1C2D',
    padding: 16,
    borderRadius: 18,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#1B334A',
  },

  cardTitle: {
    color: '#EFF5FA',
    fontWeight: '700',
  },

  sources: {
    color: '#9DB5CB',
    marginTop: 8,
    fontSize: 11,
  },

  explain: {
    color: '#70869D',
    marginTop: 12,
    lineHeight: 18,
    fontSize: 12,
  },

  coordinates: {
    color: '#607891',
    marginTop: 12,
    fontSize: 11,
  },

  error: {
    color: '#F3A6A6',
    lineHeight: 20,
  },

  retry: {
    marginTop: 12,
    backgroundColor: '#DDE9F5',
    padding: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },

  retryText: {
    color: '#08111F',
    fontWeight: '600',
  },
});
