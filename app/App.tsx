import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

type Weather = any;

function fmtHour(iso: string) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function fmtDay(iso: string) { return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }); }

export default function App() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState({ lat: -27.815, lon: -50.326, elevation: 900 });

  async function load(p = point) {
    try {
      setError(null);
      const r = await fetch(`${API}/v1/weather?lat=${p.lat}&lon=${p.lon}&elevation=${p.elevation}`);
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      setWeather(await r.json());
    } catch (e: any) { setError(e.message || 'Falha ao carregar previsão'); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function useLocation() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, elevation: pos.coords.altitude ?? undefined };
    setPoint(p as any); setLoading(true); await load(p as any);
  }

  useEffect(() => { load(); }, []);

  const hourly = useMemo(() => (weather?.hourly ?? []).slice(0, 24), [weather]);
  const daily = useMemo(() => { const map = new Map<string, any>(); for (const h of weather?.hourly ?? []) { const day = String(h.time).slice(0,10); const old = map.get(day); if (!old) map.set(day, { ...h, min: h.tempC, max: h.tempC }); else { old.min = Math.min(old.min ?? h.tempC, h.tempC ?? old.min); old.max = Math.max(old.max ?? h.tempC, h.tempC ?? old.max); old.prob = Math.max(old.prob ?? 0, h.precipProbability ?? 0); old.confidence = Math.min(old.confidence ?? 100, h.confidence ?? 100); } } return Array.from(map.values()).slice(0,10); }, [weather]);
  const sourceText = (weather?.sources ?? []).map((x: any) => x.model.toUpperCase()).join(' • ');

  return <SafeAreaView style={styles.safe}><StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} />}>
      <View style={styles.header}><View><Text style={styles.brand}>PRECISION WEATHER</Text><Text style={styles.subtitle}>{point.lat.toFixed(3)}, {point.lon.toFixed(3)}</Text></View><TouchableOpacity style={styles.locBtn} onPress={useLocation}><Text style={styles.locText}>Minha localização</Text></TouchableOpacity></View>
      {loading ? <ActivityIndicator size="large" style={{ marginTop: 80 }} /> : error ? <View style={styles.card}><Text style={styles.error}>{error}</Text><TouchableOpacity onPress={()=>load()} style={styles.retry}><Text>Recarregar</Text></TouchableOpacity></View> : weather && <>
        <View style={styles.hero}><Text style={styles.heroLabel}>CONSENSO DOS MODELOS</Text><Text style={styles.temp}>{Math.round(weather.current?.tempC ?? 0)}°</Text><Text style={styles.feel}>Sensação {Math.round(weather.current?.feelsC ?? 0)}° • Umidade {Math.round(weather.current?.humidity ?? 0)}%</Text><View style={styles.confRow}><Text style={styles.conf}>Confiança {weather.current?.confidence ?? 0}%</Text><Text style={styles.detail}>Chuva {Math.round(weather.current?.precipProbability ?? 0)}%</Text></View></View>
        <Text style={styles.section}>Próximas 24 horas</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{hourly.map((h:any)=><View key={h.time} style={styles.hourCard}><Text style={styles.hour}>{fmtHour(h.time)}</Text><Text style={styles.hourTemp}>{Math.round(h.tempC ?? 0)}°</Text><Text style={styles.rain}>☂ {Math.round(h.precipProbability ?? 0)}%</Text><Text style={styles.wind}>↗ {Math.round(h.windKmh ?? 0)} km/h</Text><Text style={styles.mini}>conf. {h.confidence}%</Text></View>)}</ScrollView>
        <Text style={styles.section}>Resumo diário</Text>{daily.map((h:any, d:number)=><View key={d} style={styles.dayRow}><Text style={styles.day}>{fmtDay(h.time)}</Text><Text style={styles.dayTemp}>{Math.round(h.max ?? h.tempC ?? 0)}°/{Math.round(h.min ?? h.tempC ?? 0)}°</Text><Text style={styles.dayRain}>Chuva {Math.round(h.prob ?? h.precipProbability ?? 0)}%</Text><Text style={styles.dayConf}>{Math.round(h.confidence ?? 0)}%</Text></View>)}
        <View style={styles.card}><Text style={styles.cardTitle}>Fontes utilizadas</Text><Text style={styles.sources}>{sourceText}</Text><Text style={styles.explain}>A previsão é formada por consenso ponderado e sinaliza a divergência entre modelos. Ela não substitui alertas oficiais.</Text></View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#08111F'}, container:{padding:18,paddingBottom:40}, header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20}, brand:{color:'#C9D8EA',fontWeight:'800',fontSize:13,letterSpacing:1.6}, subtitle:{color:'#7F91A8',marginTop:4}, locBtn:{padding:10,borderWidth:1,borderColor:'#2C4865',borderRadius:12},locText:{color:'#B9D2EB',fontSize:12}, hero:{backgroundColor:'#102137',padding:22,borderRadius:24,borderWidth:1,borderColor:'#1E3B5D'},heroLabel:{color:'#7EA4C7',fontSize:12,fontWeight:'700'},temp:{color:'#F4F8FC',fontSize:72,fontWeight:'200',marginTop:4},feel:{color:'#AEBED0'},confRow:{flexDirection:'row',justifyContent:'space-between',marginTop:18},conf:{color:'#9CE3B1',fontWeight:'700'},detail:{color:'#B9C7D5'},section:{color:'#EAF1F8',fontSize:20,fontWeight:'700',marginTop:28,marginBottom:12},hourCard:{width:106,backgroundColor:'#0E1C2D',padding:13,borderRadius:18,marginRight:10,borderWidth:1,borderColor:'#203950'},hour:{color:'#7F91A8',fontSize:12},hourTemp:{color:'#F2F7FB',fontSize:28,fontWeight:'600',marginVertical:6},rain:{color:'#9FC5E5'},wind:{color:'#B9C5D2',fontSize:12,marginTop:7},mini:{color:'#6D86A0',fontSize:10,marginTop:8},dayRow:{flexDirection:'row',alignItems:'center',paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#15263A'},day:{width:100,color:'#AFC0D0',textTransform:'capitalize'},dayTemp:{color:'#F4F8FC',fontSize:18,width:60},dayRain:{color:'#9FB6C9',width:110},dayConf:{color:'#90D5A3'},card:{backgroundColor:'#0E1C2D',padding:16,borderRadius:18,marginTop:24,borderWidth:1,borderColor:'#1B334A'},cardTitle:{color:'#EFF5FA',fontWeight:'700'},sources:{color:'#9DB5CB',marginTop:8,fontSize:11},explain:{color:'#70869D',marginTop:12,lineHeight:18,fontSize:12},error:{color:'#F3A6A6'},retry:{marginTop:12,backgroundColor:'#DDE9F5',padding:10,borderRadius:10,alignSelf:'flex-start'}
});
