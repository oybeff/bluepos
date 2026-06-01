import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useAuth } from "@/context/auth";
import { useColors } from "@/hooks/useColors";
import {
  getMyTodayAttendance,
  getMyAttendanceHistory,
  getShopLocation,
  clockAttendance,
  updateShopLocation,
  type AttendanceRecord,
} from "@/lib/api";
import { fmtDateNum, fmtTime } from "@/lib/date-utils";
import { useSafeAreaInsets } from "react-native-safe-area-context";

let WebView: any = null;
try {
  WebView = require("react-native-webview").WebView;
} catch {}

const ADMIN_ROLES = ["manager", "super_admin", "owner", "admin", "shop_owner"];

export default function DavomatScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLat, setSettingsLat] = useState("");
  const [settingsLng, setSettingsLng] = useState("");
  const [settingsRadius, setSettingsRadius] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);

  const isAdmin = user ? ADMIN_ROLES.includes(user.role) : false;

  const { data: todayData, refetch: refetchToday } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: getMyTodayAttendance,
    refetchInterval: 30000,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["attendance-history"],
    queryFn: getMyAttendanceHistory,
  });

  const { data: shopLocation } = useQuery({
    queryKey: ["shop-location"],
    queryFn: getShopLocation,
  });

  const record = todayData?.record;
  const history = historyData?.history ?? [];
  const linkedWorkerId = todayData?.linkedWorkerId ?? historyData?.linkedWorkerId;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchToday(), refetchHistory()]);
    setRefreshing(false);
  }, [refetchToday, refetchHistory]);

  useEffect(() => {
    if (showSettings && shopLocation) {
      setSettingsLat(shopLocation.latitude?.toString() ?? "");
      setSettingsLng(shopLocation.longitude?.toString() ?? "");
      setSettingsRadius((shopLocation.radiusMeters ?? 200).toString());
    }
  }, [showSettings, shopLocation]);

  const ensureLocationOn = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Joylashuv", "Ruxsat berilmagan. Sozlamalardan yoqing.", [
        { text: "Sozlamalar", onPress: () => Linking.openSettings() },
        { text: "Bekor", style: "cancel" },
      ]);
      return false;
    }
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      if (Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
          return true;
        } catch {
          Alert.alert("Joylashuv", "Joylashuvni yoqing: Sozlamalar → Joylashuv → Yoqish");
          return false;
        }
      }
      Alert.alert("Joylashuv", "GPS o'chirilgan. Sozlamalardan yoqing.", [
        { text: "Sozlamalar", onPress: () => Linking.openSettings() },
        { text: "Bekor", style: "cancel" },
      ]);
      return false;
    }
    return true;
  };

  const getBestLocation = async (): Promise<Location.LocationObject | null> => {
    const last = await Location.getLastKnownPositionAsync();
    if (last) return last;
    try {
      return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
    } catch {}
    try {
      return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch {}
    return null;
  };

  const detectGPS = async () => {
    setGpsDetecting(true);
    try {
      if (!(await ensureLocationOn())) return;
      const loc = await getBestLocation();
      if (loc) {
        setSettingsLat(loc.coords.latitude.toFixed(6));
        setSettingsLng(loc.coords.longitude.toFixed(6));
      } else {
        Alert.alert("Xato", "Joylashuv aniqlanmadi. Wi-Fi yoki GPS yoqing.");
      }
    } catch {
      Alert.alert("Xato", "Joylashuvni aniqlab bo'lmadi.");
    } finally {
      setGpsDetecting(false);
    }
  };

  const saveSettings = async () => {
    const lat = parseFloat(settingsLat);
    const lng = parseFloat(settingsLng);
    const rad = parseInt(settingsRadius, 10);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert("Xato", "Koordinatalar noto'g'ri");
      return;
    }
    if (isNaN(rad) || rad < 50 || rad > 5000) {
      Alert.alert("Xato", "Radius 50-5000 metr orasida bo'lishi kerak");
      return;
    }
    setSettingsSaving(true);
    try {
      await updateShopLocation({ latitude: lat, longitude: lng, radiusMeters: rad });
      await qc.invalidateQueries({ queryKey: ["shop-location"] });
      Alert.alert("Tayyor", "Lokatsiya va radius saqlandi");
      setShowSettings(false);
    } catch (err: any) {
      Alert.alert("Xato", err?.message || "Saqlab bo'lmadi");
    } finally {
      setSettingsSaving(false);
    }
  };

  const mapHtml = useMemo(() => {
    const lat = parseFloat(settingsLat) || 41.311081;
    const lng = parseFloat(settingsLng) || 69.279737;
    const radius = parseInt(settingsRadius, 10) || 200;
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<script src="https://api-maps.yandex.ru/2.1/?apikey=7b503a74-6c22-4ad0-8d74-4778786633fc&lang=uz"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  #map { width: 100%; height: 100vh; }
  .controls {
    position: absolute; top: 8px; left: 8px; right: 8px; z-index: 1000;
    display: flex; gap: 6px;
  }
  .search-input {
    flex: 1; padding: 8px 12px; border-radius: 10px;
    border: 1px solid #ddd; font-size: 14px; background: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15); outline: none;
  }
  .ctrl-btn {
    width: 36px; height: 36px; border-radius: 10px; border: 1px solid #ddd;
    background: #fff; font-size: 16px; cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    display: flex; align-items: center; justify-content: center;
  }
  .ctrl-btn:active { background: #f0f0f0; }
</style>
</head>
<body>
<div class="controls">
  <input id="search" class="search-input" placeholder="Manzil qidirish..." />
  <button id="searchBtn" class="ctrl-btn">\u{1F50D}</button>
  <button id="locateBtn" class="ctrl-btn">\u{1F4CD}</button>
</div>
<div id="map"></div>
<script>
ymaps.ready(function() {
  var lat = ${lat};
  var lng = ${lng};
  var radius = ${radius};

  var map = new ymaps.Map('map', {
    center: [lat, lng],
    zoom: 16,
    controls: ['zoomControl']
  });

  var circle = new ymaps.Circle([[lat, lng], radius], {}, {
    fillColor: '#4F46E520',
    strokeColor: '#4F46E5',
    strokeWidth: 2
  });

  var marker = new ymaps.Placemark([lat, lng], {}, {
    draggable: true,
    preset: 'islands#blueCircleDotIcon'
  });

  map.geoObjects.add(circle);
  map.geoObjects.add(marker);

  function moveMarker(coords) {
    marker.geometry.setCoordinates(coords);
    circle.geometry.setCoordinates(coords);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      latitude: coords[0].toFixed(6),
      longitude: coords[1].toFixed(6)
    }));
  }

  marker.events.add('dragend', function() {
    moveMarker(marker.geometry.getCoordinates());
  });

  map.events.add('click', function(e) {
    moveMarker(e.get('coords'));
  });

  document.getElementById('searchBtn').onclick = function() {
    var query = document.getElementById('search').value.trim();
    if (!query) return;
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=1')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.length > 0) {
          var coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          moveMarker(coords);
          map.setCenter(coords, 16);
        }
      });
  };

  document.getElementById('search').onkeydown = function(e) {
    if (e.key === 'Enter') document.getElementById('searchBtn').click();
  };

  document.getElementById('locateBtn').onclick = function() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        var coords = [pos.coords.latitude, pos.coords.longitude];
        moveMarker(coords);
        map.setCenter(coords, 16);
      });
    }
  };
});
</script>
</body>
</html>`;
  }, [settingsLat, settingsLng, settingsRadius]);

  const onMapMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.latitude) setSettingsLat(data.latitude);
      if (data.longitude) setSettingsLng(data.longitude);
    } catch {}
  }, []);

  const getLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (!(await ensureLocationOn())) return null;
    setLocationStatus("Joylashuv aniqlanmoqda...");
    try {
      const loc = await getBestLocation();
      setLocationStatus(null);
      if (!loc) return null;
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      setLocationStatus(null);
      Alert.alert("Xato", "Joylashuvni aniqlab bo'lmadi.");
      return null;
    }
  };

  const handleClock = async (action: "in" | "out") => {
    if (clockLoading) return;

    const label = action === "in" ? "Keldi" : "Ketdi";
    const confirmMsg = action === "in"
      ? "Ishga keldingiz deb belgilansinmi?"
      : "Ishdan ketdingiz deb belgilansinmi?";

    Alert.alert(label, confirmMsg, [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "Ha",
        onPress: async () => {
          setClockLoading(true);
          try {
            let coords: { latitude: number; longitude: number } | undefined;
            if (!isAdmin) {
              const loc = await getLocation();
              if (!loc) {
                setClockLoading(false);
                Alert.alert("Xato", "Joylashuv aniqlanmadi. GPS va Wi-Fi yoqilganligini tekshiring.");
                return;
              }
              coords = loc;
            }
            await clockAttendance(action, coords);
            await qc.invalidateQueries({ queryKey: ["attendance-today"] });
            await qc.invalidateQueries({ queryKey: ["attendance-history"] });
            await refetchToday();
          } catch (err: any) {
            const msg = err?.message || "Xatolik yuz berdi";
            Alert.alert("Xato", msg);
          } finally {
            setClockLoading(false);
          }
        },
      },
    ]);
  };

  const clockInTime = record?.clock_in ? fmtTime(record.clock_in) : null;
  const clockOutTime = record?.clock_out ? fmtTime(record.clock_out) : null;
  const hoursWorked = record?.hours_worked ? record.hours_worked.toFixed(1) : null;

  const todayStatus = !record
    ? "absent"
    : record.clock_out
      ? "done"
      : "working";

  const statusConfig = {
    absent: { label: "Kelmagan", color: C.danger, icon: "x-circle" as const, bg: C.danger + "15" },
    working: { label: "Ishdasan", color: C.success, icon: "check-circle" as const, bg: C.success + "15" },
    done: { label: "Tugallangan", color: C.primary, icon: "check-circle" as const, bg: C.primary + "15" },
  };

  const st = statusConfig[todayStatus];

  if (!linkedWorkerId && !isAdmin) {
    return (
      <View style={[s.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={[s.headerTitle, { color: C.text }]}>Davomat</Text>
        </View>
        <View style={[s.emptyCard, { backgroundColor: C.card }]}>
          <Feather name="alert-circle" size={48} color={C.textSecondary} />
          <Text style={[s.emptyText, { color: C.textSecondary }]}>
            Sizning hisobingiz xodimga bog'lanmagan.{"\n"}Admin bilan bog'laning.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={[s.headerTitle, { color: C.text }]}>Davomat</Text>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => setShowSettings(!showSettings)}
              style={[s.settingsBtn, { backgroundColor: showSettings ? C.primary + "15" : "transparent" }]}
              activeOpacity={0.7}
            >
              <Feather name="settings" size={20} color={showSettings ? C.primary : C.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {shopLocation?.name && (
          <Text style={[s.shopName, { color: C.textSecondary }]}>
            <Feather name="map-pin" size={12} /> {shopLocation.name}
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Admin Settings Panel */}
        {isAdmin && showSettings && (
          <View style={[s.card, { backgroundColor: C.card, marginBottom: 16 }]}>
            <View style={s.settingsHeader}>
              <Feather name="map-pin" size={18} color={C.primary} />
              <Text style={[s.settingsTitle, { color: C.text }]}>Lokatsiya sozlamalari</Text>
            </View>

            <TouchableOpacity
              style={[s.gpsBtn, { backgroundColor: C.primary }]}
              onPress={detectGPS}
              disabled={gpsDetecting}
              activeOpacity={0.7}
            >
              {gpsDetecting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="crosshair" size={18} color="#fff" />
                  <Text style={s.gpsBtnText}>Joriy joylashuvni aniqlash</Text>
                </>
              )}
            </TouchableOpacity>

            {WebView && (
              <View style={s.mapContainer}>
                <WebView
                  source={{ html: mapHtml }}
                  style={{ flex: 1 }}
                  onMessage={onMapMessage}
                  scrollEnabled={false}
                  nestedScrollEnabled={false}
                  javaScriptEnabled
                  domStorageEnabled
                  originWhitelist={["*"]}
                />
              </View>
            )}

            <View style={s.inputGroup}>
              <Text style={[s.inputLabel, { color: C.textSecondary }]}>Kenglik (latitude)</Text>
              <TextInput
                style={[s.input, { borderColor: C.border, color: C.text, backgroundColor: C.surface }]}
                value={settingsLat}
                onChangeText={setSettingsLat}
                keyboardType="numeric"
                placeholder="41.311081"
                placeholderTextColor={C.textSecondary}
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={[s.inputLabel, { color: C.textSecondary }]}>Uzunlik (longitude)</Text>
              <TextInput
                style={[s.input, { borderColor: C.border, color: C.text, backgroundColor: C.surface }]}
                value={settingsLng}
                onChangeText={setSettingsLng}
                keyboardType="numeric"
                placeholder="69.279737"
                placeholderTextColor={C.textSecondary}
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={[s.inputLabel, { color: C.textSecondary }]}>Radius (metr)</Text>
              <TextInput
                style={[s.input, { borderColor: C.border, color: C.text, backgroundColor: C.surface }]}
                value={settingsRadius}
                onChangeText={setSettingsRadius}
                keyboardType="numeric"
                placeholder="200"
                placeholderTextColor={C.textSecondary}
              />
              <Text style={[s.inputHint, { color: C.textSecondary }]}>50 dan 5000 metrgacha</Text>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: C.success }]}
              onPress={saveSettings}
              disabled={settingsSaving}
              activeOpacity={0.7}
            >
              {settingsSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Saqlash</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Today Status Card */}
        <View style={[s.card, { backgroundColor: C.card }]}>
          <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
            <Feather name={st.icon} size={18} color={st.color} />
            <Text style={[s.statusLabel, { color: st.color }]}>{st.label}</Text>
          </View>

          <View style={s.timeRow}>
            <View style={s.timeBlock}>
              <Feather name="log-in" size={18} color={C.success} />
              <Text style={[s.timeLabel, { color: C.textSecondary }]}>Keldi</Text>
              <Text style={[s.timeValue, { color: C.text }]}>
                {clockInTime ?? "—"}
              </Text>
            </View>
            <View style={[s.timeDivider, { backgroundColor: C.border }]} />
            <View style={s.timeBlock}>
              <Feather name="log-out" size={18} color={C.danger} />
              <Text style={[s.timeLabel, { color: C.textSecondary }]}>Ketdi</Text>
              <Text style={[s.timeValue, { color: C.text }]}>
                {clockOutTime ?? "—"}
              </Text>
            </View>
            <View style={[s.timeDivider, { backgroundColor: C.border }]} />
            <View style={s.timeBlock}>
              <Feather name="clock" size={18} color={C.primary} />
              <Text style={[s.timeLabel, { color: C.textSecondary }]}>Soat</Text>
              <Text style={[s.timeValue, { color: C.text }]}>
                {hoursWorked ? `${hoursWorked} s` : "—"}
              </Text>
            </View>
          </View>

          {/* Clock Buttons */}
          <View style={s.btnRow}>
            {todayStatus === "absent" && (
              <TouchableOpacity
                style={[s.clockBtn, { backgroundColor: C.success }]}
                onPress={() => handleClock("in")}
                disabled={clockLoading}
                activeOpacity={0.7}
              >
                {clockLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="log-in" size={20} color="#fff" />
                    <Text style={s.clockBtnText}>Keldim</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {todayStatus === "working" && (
              <TouchableOpacity
                style={[s.clockBtn, { backgroundColor: C.danger }]}
                onPress={() => handleClock("out")}
                disabled={clockLoading}
                activeOpacity={0.7}
              >
                {clockLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="log-out" size={20} color="#fff" />
                    <Text style={s.clockBtnText}>Ketdim</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {todayStatus === "done" && (
              <View style={[s.doneMsg, { backgroundColor: C.primary + "10" }]}>
                <Feather name="check" size={18} color={C.primary} />
                <Text style={[s.doneMsgText, { color: C.primary }]}>
                  Bugungi ish kuni tugallandi
                </Text>
              </View>
            )}
          </View>

          {locationStatus && (
            <View style={s.locationRow}>
              <ActivityIndicator size="small" color={C.primary} />
              <Text style={[s.locationText, { color: C.textSecondary }]}>{locationStatus}</Text>
            </View>
          )}

          {!isAdmin && (
            <View style={[s.geoNote, { backgroundColor: C.surface }]}>
              <Feather name="map-pin" size={14} color={C.textSecondary} />
              <Text style={[s.geoNoteText, { color: C.textSecondary }]}>
                Do'kondan {shopLocation?.radiusMeters ?? 200}m ichida bo'lishingiz kerak
              </Text>
            </View>
          )}
        </View>

        {/* History */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: C.text }]}>
            So'nggi 30 kun
          </Text>
        </View>

        {history.length === 0 ? (
          <View style={[s.card, { backgroundColor: C.card, alignItems: "center", paddingVertical: 32 }]}>
            <Feather name="calendar" size={36} color={C.textSecondary} />
            <Text style={[s.emptyText, { color: C.textSecondary, marginTop: 8 }]}>
              Davomat tarixi yo'q
            </Text>
          </View>
        ) : (
          <View style={[s.card, { backgroundColor: C.card, paddingHorizontal: 0 }]}>
            {history.map((item: AttendanceRecord, i: number) => {
              const ci = item.clock_in ? fmtTime(item.clock_in) : "—";
              const co = item.clock_out ? fmtTime(item.clock_out) : "—";
              const hrs = item.hours_worked ? `${item.hours_worked.toFixed(1)}s` : "—";
              const isPresent = item.status === "present" || item.status === "late";
              const statusColor = item.status === "late" ? C.warning : isPresent ? C.success : C.danger;

              return (
                <View
                  key={item.id}
                  style={[
                    s.historyRow,
                    i < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                  ]}
                >
                  <View style={s.historyDate}>
                    <View style={[s.historyDot, { backgroundColor: statusColor }]} />
                    <Text style={[s.historyDateText, { color: C.text }]}>
                      {fmtDateNum(item.date)}
                    </Text>
                  </View>
                  <Text style={[s.historyTime, { color: C.textSecondary }]}>
                    {ci} → {co}
                  </Text>
                  <Text style={[s.historyHours, { color: C.primary }]}>{hrs}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
  },
  shopName: {
    fontSize: 13,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  timeDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 8,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  timeValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  btnRow: {
    marginTop: 4,
  },
  clockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  clockBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  doneMsg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  doneMsgText: {
    fontSize: 15,
    fontWeight: "600",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  locationText: {
    fontSize: 13,
  },
  geoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  geoNoteText: {
    fontSize: 12,
    flex: 1,
  },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  historyDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyDateText: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyTime: {
    fontSize: 13,
    flex: 1,
    textAlign: "center",
  },
  historyHours: {
    fontSize: 14,
    fontWeight: "700",
    width: 50,
    textAlign: "right",
  },
  emptyCard: {
    margin: 20,
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  mapContainer: {
    height: 280,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  gpsBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputHint: {
    fontSize: 11,
    marginTop: 4,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
