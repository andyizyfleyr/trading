import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Svg, { Line, Rect } from 'react-native-svg';
import bigInt from 'big-integer';
import { otcPriceAt } from './otc';

const SITE = 'https://tradefacile-sand.vercel.app';
const GAMES = [{ id:'EURUSDOTC',name:'Lucky 7',color:'#FBBF24' },{ id:'GBPUSDOTC',name:'Jackpot',color:'#A78BFA' },{ id:'USDJPYOTC',name:'Turbo',color:'#F472B6' }];
const DURATIONS = [3,10,30,60,300];
const CURRENCIES = { USD:['$',2,'1','1'], EUR:['€',2,'92','100'], XOF:['₣',0,'60348044','100000'], GBP:['£',2,'79','100'], NGN:['₦',0,'1530','1'], GHS:['₵',0,'152','10'] };
const KEY = 'tradefacile_session';
const durationLabel = n => n >= 60 ? `${n/60} min` : `${n} s`;
const gameName = id => GAMES.find(g => g.id === id)?.name || id;

// La division entière est volontaire : l'affichage coupe les décimales sans arrondir.
function money(value, exact, currency='USD') {
  const [symbol, places, rateN, rateD] = CURRENCIES[currency] || CURRENCIES.USD;
  let n, d;
  if (exact && /^-?\d+$/.test(exact.numerator) && /^\d+$/.test(exact.denominator)) {
    n = bigInt(exact.numerator); d = bigInt(exact.denominator);
  } else {
    const num = String(Number(value) || 0); const parts = num.split('.');
    if (/[eE]/.test(num)) return '—';
    n = bigInt(parts.join('')); d = bigInt(10).pow((parts[1] || '').length);
  }
  if (d.isZero()) return '—';
  const scaled = n.multiply(rateN).multiply(bigInt(10).pow(places)).divide(d.multiply(rateD));
  const neg = scaled.isNegative(); const digits = scaled.abs().toString().padStart(places + 1, '0');
  const whole = places ? digits.slice(0,-places) : digits;
  return `${neg ? '−' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${places ? ',' + digits.slice(-places) : ''} ${symbol}`;
}

async function request(path, token, body, method) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(SITE + path, { method:method || (body === undefined ? 'GET' : 'POST'), headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:body === undefined ? undefined : JSON.stringify(body), signal:ctrl.signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(json.error?.message || 'Une erreur est survenue.'); err.status = res.status; throw err; }
    return json.data;
  } catch (e) { if (e.name === 'AbortError') throw new Error('Le serveur met trop longtemps à répondre.'); throw e; }
  finally { clearTimeout(timer); }
}

function Button({ title, onPress, color='#0270D1', disabled=false, small=false }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,{backgroundColor:color,opacity:disabled ? 0.5 : 1},small && s.buttonSmall]}><Text style={s.buttonText}>{title}</Text></TouchableOpacity>;
}
function Field({ value, onChangeText, placeholder, secureTextEntry=false, keyboardType='default' }) {
  return <TextInput style={s.input} placeholder={placeholder} placeholderTextColor="#8E93A7" value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} autoCapitalize="none" keyboardType={keyboardType} />;
}
function Card({children}) { return <View style={s.card}>{children}</View>; }
function Chart({candles}) {
  if (!candles.length) return <View style={s.chartEmpty}><Text style={s.muted}>Chargement du graphique…</Text></View>;
  const data = candles.slice(-42), hi = Math.max(...data.map(c => c.high)), lo = Math.min(...data.map(c => c.low)), range = hi-lo || 1;
  const y = v => 12 + (hi-v)/range*166, step=340/data.length;
  return <View style={s.chart}><Svg viewBox="0 0 340 200" width="100%" height="200" preserveAspectRatio="none">
    {[0,1,2,3,4].map(i=><Line key={i} x1="0" x2="340" y1={12+i*41.5} y2={12+i*41.5} stroke="#3D4356" strokeWidth="0.5" />)}
    {data.map((c,i)=>{ const x=i*step+step/2, up=c.close>=c.open, color=up?'#0CAF56':'#E55D4F'; return <React.Fragment key={c.time}><Line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1" /><Rect x={x-step*.32} y={Math.min(y(c.open),y(c.close))} width={step*.64} height={Math.max(1,Math.abs(y(c.open)-y(c.close)))} fill={color}/></React.Fragment>; })}
  </Svg></View>;
}

export default function App() {
  const [token,setToken] = useState(null), [user,setUser]=useState(null), [loading,setLoading]=useState(true), [authMode,setAuthMode]=useState('login');
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [busy,setBusy]=useState(false), [screen,setScreen]=useState('Trader');
  const [symbol,setSymbol]=useState(GAMES[0].id), [duration,setDuration]=useState(60), [amount,setAmount]=useState(''), [candles,setCandles]=useState([]), [price,setPrice]=useState(null);
  const [trades,setTrades]=useState([]), [stats,setStats]=useState(null), [currencyBusy,setCurrencyBusy]=useState(false), [clock,setClock]=useState(Date.now()), [offset,setOffset]=useState(null), [interval,setIntervalName]=useState('1m');
  const [scheduled,setScheduled]=useState(false), [signal,setSignal]=useState(null);
  const requestBusy=useRef(false); const currency=user?.currency || 'USD';
  const showError=e=>Alert.alert('TradeFacile',e.message || 'Connexion impossible. Vérifie Internet.');
  const api=useCallback((path,body,method)=>request(path,token,body,method),[token]);
  const loadAccount=useCallback(async t=>{ const data=await request('/api/me',t); setUser(data.user); },[]);
  useEffect(()=>{ let live=true; (async()=>{ try {const saved=await SecureStore.getItemAsync(KEY); if(saved){ await loadAccount(saved); if(live)setToken(saved); }} catch(e){ if(e.status===401) await SecureStore.deleteItemAsync(KEY); } finally {if(live)setLoading(false);} })(); return ()=>{live=false}; },[loadAccount]);
  useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(t)},[]);
  const refresh=useCallback(async()=>{
    if(!token || requestBusy.current)return; requestBusy.current=true;
    try { const [settled,list,stat] = await Promise.all([api('/api/trades/settle',{}),api('/api/trades?status=all&limit=100'),api('/api/me/stats')]); setTrades(list.trades); setStats(stat.stats); setUser(u=>u ? {...u,balance:settled.balance,balanceExact:settled.balanceExact}:u); }
    catch(e){ if(e.status===401){await SecureStore.deleteItemAsync(KEY);setToken(null);setUser(null);Alert.alert('Session expirée','Reconnecte-toi.');} }
    finally { requestBusy.current=false; }
  },[api,token]);
  useEffect(()=>{ if(!token)return; refresh(); const t=setInterval(refresh,10000); return()=>clearInterval(t); },[token,refresh]);
  useEffect(()=>{let live=true; const load=async()=>{try {const [c,p]=await Promise.all([request(`/api/candles?symbol=${symbol}&interval=${interval}&limit=80`),request(`/api/price?symbol=${symbol}`)]);if(live){setCandles(c.candles);setPrice(p.price);setOffset(p.time-Date.now());}}catch(e){if(live)setCandles([])}};load();const t=setInterval(load,5000);return()=>{live=false;clearInterval(t)}},[symbol,interval]);
  const authenticate=async()=>{if(busy)return;setBusy(true);try{const data=await request('/api/auth/'+(authMode==='login'?'login':'register'),null,{email:email.trim(),password});await SecureStore.setItemAsync(KEY,data.token);setUser(data.user);setToken(data.token);setPassword('');}catch(e){showError(e)}finally{setBusy(false)}};
  const logout=async()=>{await SecureStore.deleteItemAsync(KEY);setToken(null);setUser(null);setTrades([]);setScreen('Trader');};
  const run=async fn=>{if(busy)return;setBusy(true);try{await fn();await refresh()}catch(e){showError(e)}finally{setBusy(false)}};
  const nextSlot=()=>{const now=clock+(offset||0);let v=(Math.floor(now/60000)+1)*60;if(v*1000-now<8000)v+=60;return v};
  const place=(direction,slot)=>run(async()=>{const body={symbol,direction,durationSec:duration,localAmount:amount.replace(',','.'),localCurrency:currency}; if(slot)body.slot=slot; await api(slot?'/api/scheduled':'/api/trades',body); setSignal(null);setScheduled(false);Alert.alert('Mise enregistrée',slot?'Ta mise est programmée.':'Ta prédiction est en cours.');});
  const active=trades.filter(t=>t.status==='OPEN'); const finished=trades.filter(t=>t.status==='SETTLED');
  if(loading)return <SafeAreaView style={s.root}><ActivityIndicator color="#2E99FB" style={{flex:1}}/></SafeAreaView>;
  if(!token || !user)return <SafeAreaView style={s.root}><StatusBar backgroundColor="#1C1F2E" barStyle="light-content"/><ScrollView contentContainerStyle={s.auth}><Text style={s.logo}><Text style={{color:'#0CAF56'}}>▲</Text><Text style={{color:'#E55D4F'}}>▼</Text> TradeFacile</Text><Text style={s.title}>{authMode==='login'?'Bon retour !':'Créer un compte'}</Text><Text style={s.muted}>Jeu de prédiction • Argent fictif uniquement</Text><Card><Field placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address"/><Field placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry/><Button title={busy?'Patiente…':authMode==='login'?'Se connecter':"S’inscrire"} onPress={authenticate} disabled={busy}/></Card><TouchableOpacity onPress={()=>setAuthMode(authMode==='login'?'register':'login')}><Text style={s.link}>{authMode==='login'?'Créer un compte':'Déjà inscrit ? Se connecter'}</Text></TouchableOpacity></ScrollView></SafeAreaView>;
  return <SafeAreaView style={s.root}><StatusBar backgroundColor="#1C1F2E" barStyle="light-content"/><View style={s.header}><TouchableOpacity onPress={()=>setScreen('Trader')}><Text style={s.logo}><Text style={{color:'#0CAF56'}}>▲</Text><Text style={{color:'#E55D4F'}}>▼</Text> TradeFacile</Text></TouchableOpacity><TouchableOpacity onPress={()=>setScreen('Profil')}><Text style={s.balance}>▣ {money(user.balance,user.balanceExact,currency)}</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    {screen==='Trader' && <>
      <View style={s.row}>{GAMES.map(g=><TouchableOpacity key={g.id} onPress={()=>{setSymbol(g.id);setSignal(null);}} style={[s.chip,symbol===g.id&&s.selected]}><Text style={s.text}>{g.name}</Text></TouchableOpacity>)}</View>
      <View style={s.row}><Text style={s.heading}>{gameName(symbol)} <Text style={s.tag}>JEU</Text></Text><Text style={s.price}>{price==null?'…':price}</Text></View>
      <View style={s.row}>{['1m','5m','15m'].map(v=><TouchableOpacity key={v} onPress={()=>setIntervalName(v)} style={[s.chip,interval===v&&s.selected]}><Text style={s.text}>{v}</Text></TouchableOpacity>)}</View><Chart candles={candles}/>
      <Card><View style={s.row}><Text style={s.heading}>Ta prédiction</Text><Text style={s.good}>+85 %</Text></View><Text style={s.label}>Durée</Text><View style={s.rowWrap}>{DURATIONS.map(n=><TouchableOpacity key={n} onPress={()=>{setDuration(n);setSignal(null);}} style={[s.chip,n===duration&&s.selected]}><Text style={s.text}>{durationLabel(n)}</Text></TouchableOpacity>)}</View><Text style={s.label}>Mise ({CURRENCIES[currency]?.[0] || '$'})</Text><Field value={amount} onChangeText={setAmount} placeholder="Montant" keyboardType="decimal-pad"/>
      <View style={s.row}><Text style={s.muted}>Argent fictif uniquement</Text><TouchableOpacity onPress={()=>{setScheduled(!scheduled);setSignal(null);}}><Text style={s.link}>{scheduled?'Immédiat':'Programmer'}</Text></TouchableOpacity></View>{scheduled&&<Text style={s.muted}>Prochain créneau : {new Date((signal?.slot || nextSlot())*1000).toLocaleTimeString()}</Text>}
      <View style={s.row}><View style={s.flex}><Button title="▲ Hausse" color="#0CAF56" disabled={busy||!amount} onPress={()=>{if(signal && signal.direction!=='UP') return Alert.alert('Signal','Ce signal indique Baisse.'); if(signal && signal.slot*1000<=clock+(offset||0)+8000) return Alert.alert('Créneau expiré','Choisis un nouveau signal.'); place('UP',scheduled?(signal?.slot||nextSlot()):null)}}/></View><View style={s.flex}><Button title="▼ Baisse" color="#DC4633" disabled={busy||!amount} onPress={()=>{if(signal && signal.direction!=='DOWN') return Alert.alert('Signal','Ce signal indique Hausse.'); if(signal && signal.slot*1000<=clock+(offset||0)+8000) return Alert.alert('Créneau expiré','Choisis un nouveau signal.'); place('DOWN',scheduled?(signal?.slot||nextSlot()):null)}}/></View></View></Card>
      <Text style={s.heading}>En cours ({active.length})</Text>{active.length===0?<Text style={s.muted}>Aucune prédiction en cours.</Text>:active.map(t=><TradeRow key={t.id} trade={t} currency={currency} now={clock} onCancel={()=>run(()=>api(`/api/scheduled/${t.id}`,undefined,'DELETE'))}/>)}
    </>}
    {screen==='Signaux' && <><Text style={s.title}>Signaux casino</Text><Text style={s.muted}>Jeu simulé • Choisis un jeu et une durée.</Text><View style={s.rowWrap}>{GAMES.map(g=><TouchableOpacity key={g.id} onPress={()=>{setSymbol(g.id);setSignal(null);}} style={[s.chip,symbol===g.id&&s.selected]}><Text style={s.text}>{g.name}</Text></TouchableOpacity>)}</View><View style={s.rowWrap}>{DURATIONS.map(n=><TouchableOpacity key={n} onPress={()=>{setDuration(n);setSignal(null);}} style={[s.chip,n===duration&&s.selected]}><Text style={s.text}>{durationLabel(n)}</Text></TouchableOpacity>)}</View>{offset===null?<Text style={s.muted}>Synchronisation avec le serveur…</Text>:Array.from({length:8},(_,i)=>{const slot=nextSlot()+i*60, a=otcPriceAt(symbol,slot), b=otcPriceAt(symbol,slot+duration), dir=b>a?'UP':b<a?'DOWN':null;return <Card key={slot}><View style={s.row}><Text style={s.text}>{new Date(slot*1000).toLocaleTimeString()} · {gameName(symbol)}</Text><Text style={dir==='UP'?s.good:dir==='DOWN'?s.bad:s.text}>{dir==='UP'?'▲ Hausse':dir==='DOWN'?'▼ Baisse':'Égalité'}</Text></View><Text style={s.muted}>Dans {Math.max(0,Math.ceil((slot*1000-clock-offset)/1000))} s</Text>{dir&&<Button small title="Préparer cette mise" onPress={()=>{setSignal({slot,direction:dir});setScreen('Trader');setScheduled(true);}}/>}</Card>})}</>}
    {screen==='Historique' && <><Text style={s.title}>Historique</Text>{stats&&<Card><Text style={s.heading}>Tes statistiques</Text><View style={s.row}><Text style={s.muted}>Prédictions : {stats.settled}</Text><Text style={s.muted}>Réussite : {stats.winRate} %</Text></View><Text style={s.text}>Gains nets : {money(stats.pnl,stats.pnlExact,currency)}</Text></Card>}{finished.length===0?<Text style={s.muted}>Aucune prédiction terminée.</Text>:finished.map(t=><TradeRow key={t.id} trade={t} currency={currency} now={clock}/>)}</>}
    {screen==='Profil' && <><Text style={s.title}>Mon profil</Text><Card><Text style={s.muted}>{user.email}</Text><Text style={s.balanceBig}>{money(user.balance,user.balanceExact,currency)}</Text><Text style={s.muted}>Solde fictif • Aucun paiement réel</Text></Card><Card><Text style={s.heading}>Ajouter ou retirer</Text><Text style={s.muted}>Montants en dollars, comme sur le site.</Text><Field value={amount} onChangeText={setAmount} placeholder="Montant en USD" keyboardType="decimal-pad"/><View style={s.row}><View style={s.flex}><Button title="Ajouter" disabled={busy||!amount} onPress={()=>run(async()=>{const r=await api('/api/me/deposit',{amount:Number(amount.replace(',','.'))});setUser(r.user)})}/></View><View style={s.flex}><Button title="Retirer" color="#424554" disabled={busy||!amount} onPress={()=>run(async()=>{const r=await api('/api/me/withdraw',{amount:Number(amount.replace(',','.'))});setUser(r.user)})}/></View></View></Card><Card><Text style={s.heading}>Devise</Text><View style={s.rowWrap}>{Object.keys(CURRENCIES).map(c=><TouchableOpacity key={c} disabled={currencyBusy} style={[s.chip,c===currency&&s.selected]} onPress={async()=>{setCurrencyBusy(true);try{const r=await api('/api/me/currency',{currency:c},'PUT');setUser(r.user)}catch(e){showError(e)}finally{setCurrencyBusy(false)}}}><Text style={s.text}>{c} {CURRENCIES[c][0]}</Text></TouchableOpacity>)}</View></Card><Button title="Se déconnecter" color="#424554" onPress={logout}/></>}
    </ScrollView><View style={s.nav}>{['Trader','Signaux','Historique','Profil'].map(item=><TouchableOpacity accessibilityRole="button" key={item} style={s.navItem} onPress={()=>setScreen(item)}><Text style={item===screen?s.navActive:s.navText}>{({Trader:'▥',Signaux:'◉',Historique:'◷',Profil:'●'})[item]}</Text><Text style={item===screen?s.navActive:s.navText}>{item}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}
function TradeRow({trade:t,currency,now,onCancel}) { const future=t.status==='OPEN'&&new Date(t.openedAt).getTime()>now; return <Card><View style={s.row}><Text style={s.heading}>{gameName(t.symbol)} · {t.direction==='UP'?'Hausse ▲':'Baisse ▼'}</Text><Text style={t.result==='WIN'?s.good:t.result==='LOSS'?s.bad:s.muted}>{t.status==='OPEN'?(future?'Programmée':'En cours'):t.result==='WIN'?'Gagné':t.result==='LOSS'?'Perdu':'Égalité'}</Text></View><Text style={s.text}>Mise : {money(t.amount,t.amountExact,currency)} · {durationLabel(t.durationSec)}</Text>{t.payout!=null&&<Text style={s.text}>Versé : {money(t.payout,t.payoutExact,currency)}</Text>}<Text style={s.muted}>{new Date(t.openedAt).toLocaleString()}</Text>{future&&onCancel&&<Button small color="#424554" title="Annuler" onPress={onCancel}/>}</Card> }
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#1C1F2E'},header:{paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:'#3D4356'},logo:{fontSize:19,fontWeight:'800',color:'#F0F0F0'},balance:{color:'#F0F0F0',backgroundColor:'#2A3040',padding:9,borderRadius:14,fontWeight:'700'},balanceBig:{color:'#F0F0F0',fontSize:30,fontWeight:'800',marginVertical:10},content:{padding:14,paddingBottom:30,gap:12},auth:{flexGrow:1,justifyContent:'center',padding:24,gap:16},title:{fontSize:25,fontWeight:'800',color:'#F0F0F0'},heading:{fontSize:16,fontWeight:'700',color:'#F0F0F0'},text:{fontSize:14,color:'#F0F0F0'},muted:{color:'#8E93A7',fontSize:13,lineHeight:20},label:{color:'#8E93A7',fontSize:13,marginTop:8},card:{backgroundColor:'#2A3040',borderRadius:14,padding:14,gap:10},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},rowWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},flex:{flex:1},chip:{paddingVertical:9,paddingHorizontal:12,borderRadius:9,backgroundColor:'#2A3040'},selected:{backgroundColor:'#0270D1'},input:{borderWidth:1,borderColor:'#3D4356',borderRadius:10,paddingHorizontal:12,paddingVertical:11,color:'#F0F0F0',backgroundColor:'#1C1F2E',fontSize:16},button:{borderRadius:10,paddingVertical:14,paddingHorizontal:12,alignItems:'center',marginTop:6},buttonSmall:{paddingVertical:9},buttonText:{color:'#fff',fontWeight:'700',fontSize:15},link:{color:'#2E99FB',fontWeight:'700'},good:{color:'#0CAF56',fontWeight:'700'},bad:{color:'#E55D4F',fontWeight:'700'},price:{color:'#2E99FB',fontWeight:'800',fontSize:18},tag:{fontSize:11,color:'#7AA2FF'},chart:{backgroundColor:'#202432',borderRadius:12,overflow:'hidden'},chartEmpty:{height:200,justifyContent:'center',alignItems:'center',backgroundColor:'#202432'},nav:{flexDirection:'row',borderTopWidth:1,borderColor:'#3D4356',backgroundColor:'#1C1F2E',paddingVertical:8},navItem:{flex:1,alignItems:'center',gap:2},navText:{fontSize:11,color:'#8E93A7'},navActive:{fontSize:11,color:'#2E99FB',fontWeight:'700'}});
