import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Vibration, Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";

const C = Colors.light;

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("auth_token");
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) throw new Error("Server sozlanmagan");
  const res = await fetch(`https://${domain}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("API xato");
  return res.json();
}

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  pricePerUnit: number;
  buyingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  category: string;
  description: string | null;
  rang: string | null;
  material: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm";
}

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const lastScanned = useRef<string | null>(null);

  const handleBarcode = async ({ data }: { type: string; data: string }) => {
    if (scanned || loading || data === lastScanned.current) return;
    lastScanned.current = data;
    setScanned(true);
    setLoading(true);
    setError(null);
    setProduct(null);
    if (Platform.OS !== "web") Vibration.vibrate(100);
    try {
      const res = await apiGet(`/api/products?barcode=${encodeURIComponent(data)}`);
      const list: Product[] = res.products || res || [];
      if (list.length > 0) {
        setProduct(list[0]);
      } else {
        setError(`Barcode topilmadi:\n${data}`);
      }
    } catch {
      setError("Server bilan bog'lanishda xato.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScanned(false);
    setProduct(null);
    setError(null);
    lastScanned.current = null;
  };

  if (!permission) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[s.center, { backgroundColor: C.background, paddingHorizontal: 32 }]}>
        <View style={[s.permIcon, { backgroundColor: C.surface }]}>
          <Feather name="camera-off" size={36} color={C.primary} />
        </View>
        <Text style={[s.permTitle, { color: C.text }]}>Kamera ruxsati kerak</Text>
        <Text style={[s.permDesc, { color: C.textSecondary }]}>
          Barcode skanerlash uchun kameraga ruxsat bering
        </Text>
        <TouchableOpacity style={[s.bigBtn, { backgroundColor: C.primary }]} onPress={requestPermission}>
          <Feather name="camera" size={18} color="#fff" />
          <Text style={s.bigBtnTxt}>Ruxsat berish</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 12, paddingVertical: 8 }} onPress={() => router.back()}>
          <Text style={[{ fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" }]}>Orqaga</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stockColor = !product ? C.text
    : product.stock <= 0 ? "#DC2626"
    : product.stock <= product.minStock ? "#D97706"
    : "#059669";

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.circle} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.topTitle}>Barcode Skaner</Text>
          <Text style={s.topSub}>Mahsulot barcodni skanerlang</Text>
        </View>
        <TouchableOpacity style={s.circle} onPress={reset}>
          <Feather name="refresh-ccw" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Camera */}
      <View style={s.cameraWrap}>
        {!scanned ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "qr", "code39", "upc_a", "upc_e"] }}
            onBarcodeScanned={handleBarcode}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#111" }]} />
        )}

        {/* Scan frame */}
        <View style={s.overlay}>
          <View style={s.frame}>
            <View style={[s.corner, s.cTL]} />
            <View style={[s.corner, s.cTR]} />
            <View style={[s.corner, s.cBL]} />
            <View style={[s.corner, s.cBR]} />
            {!scanned && <View style={s.scanLine} />}
          </View>
          <Text style={s.hint}>Barcodni ramka ichiga yo'naltiring</Text>
        </View>

        {loading && (
          <View style={s.loadOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={s.loadTxt}>Tekshirilmoqda...</Text>
          </View>
        )}
      </View>

      {/* Result */}
      <View style={s.panel}>
        {product ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Product header */}
            <View style={s.prodHeader}>
              <View style={[s.prodIcon, { backgroundColor: C.surface }]}>
                <Feather name="package" size={28} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.prodName, { color: C.text }]}>{product.name}</Text>
                <Text style={[s.prodCat, { color: C.textSecondary }]}>{product.category}</Text>
                {(product.rang || product.material) && (
                  <Text style={[s.prodMeta, { color: C.textSecondary }]}>
                    {[product.rang, product.material].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
            </View>

            {/* Stats: 3 boxes */}
            <View style={s.statsRow}>
              <View style={[s.statBox, { backgroundColor: "#F0FDF4" }]}>
                <Feather name="tag" size={18} color="#059669" />
                <Text style={[s.statLbl, { color: "#6B7280" }]}>Sotuv narxi</Text>
                <Text style={[s.statVal, { color: "#059669" }]}>{fmt(product.pricePerUnit)}</Text>
                <Text style={[s.statUnit, { color: "#9CA3AF" }]}>/ {product.unit}</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: "#EEF2FF" }]}>
                <Feather name="shopping-cart" size={18} color={C.primary} />
                <Text style={[s.statLbl, { color: "#6B7280" }]}>Xarid narxi</Text>
                <Text style={[s.statVal, { color: C.primary }]}>{fmt(product.buyingPrice)}</Text>
                <Text style={[s.statUnit, { color: "#9CA3AF" }]}>/ {product.unit}</Text>
              </View>
              <View style={[s.statBox, {
                backgroundColor: product.stock <= 0 ? "#FEF2F2" : product.stock <= product.minStock ? "#FFFBEB" : "#F0FDF4",
              }]}>
                <Feather name="archive" size={18} color={stockColor} />
                <Text style={[s.statLbl, { color: "#6B7280" }]}>Omborda</Text>
                <Text style={[s.statVal, { color: stockColor }]}>
                  {parseFloat((product.stock || 0).toFixed(2))}
                </Text>
                <Text style={[s.statUnit, { color: "#9CA3AF" }]}>{product.unit}</Text>
              </View>
            </View>

            {/* Min stock warning */}
            {product.stock > 0 && product.stock <= product.minStock && (
              <View style={[s.banner, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
                <Feather name="alert-triangle" size={15} color="#D97706" />
                <Text style={[s.bannerTxt, { color: "#D97706" }]}>
                  Minimal qoldiqga yetdi! Min: {product.minStock} {product.unit}
                </Text>
              </View>
            )}
            {product.stock <= 0 && (
              <View style={[s.banner, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Feather name="alert-circle" size={15} color="#DC2626" />
                <Text style={[s.bannerTxt, { color: "#DC2626" }]}>Mahsulot tugagan!</Text>
              </View>
            )}

            {/* Barcode */}
            {product.barcode && (
              <View style={[s.barcodeRow, { backgroundColor: "#F3F4F6" }]}>
                <Feather name="bar-chart-2" size={14} color="#9CA3AF" />
                <Text style={s.barcodeVal}>{product.barcode}</Text>
                <Text style={[s.barcodeUnit, { color: C.textSecondary }]}>barcode</Text>
              </View>
            )}

            {/* Description */}
            {product.description ? (
              <Text style={[s.desc, { color: C.textSecondary }]}>{product.description}</Text>
            ) : null}

            {/* Margin calculation */}
            {product.pricePerUnit > 0 && product.buyingPrice > 0 && (
              <View style={[s.marginCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Feather name="trending-up" size={15} color={C.primary} />
                <Text style={[s.marginTxt, { color: C.text }]}>
                  Foyda: <Text style={{ color: C.primary, fontFamily: "Inter_700Bold" }}>
                    {fmt(product.pricePerUnit - product.buyingPrice)}
                  </Text>
                  {"  "}
                  <Text style={{ color: C.textSecondary }}>
                    ({Math.round(((product.pricePerUnit - product.buyingPrice) / product.pricePerUnit) * 100)}%)
                  </Text>
                </Text>
              </View>
            )}

            <TouchableOpacity style={[s.bigBtn, { backgroundColor: C.primary, marginTop: 16 }]} onPress={reset}>
              <Feather name="camera" size={18} color="#fff" />
              <Text style={s.bigBtnTxt}>Yana skanerlash</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : error ? (
          <View style={s.stateWrap}>
            <View style={[s.stateIcon, { backgroundColor: "#FEF2F2" }]}>
              <Feather name="x-circle" size={32} color="#DC2626" />
            </View>
            <Text style={[s.stateTxt, { color: "#DC2626" }]}>{error}</Text>
            <TouchableOpacity style={[s.bigBtn, { backgroundColor: C.primary }]} onPress={reset}>
              <Feather name="camera" size={18} color="#fff" />
              <Text style={s.bigBtnTxt}>Qayta urinish</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.stateWrap}>
            <View style={[s.stateIcon, { backgroundColor: C.surface }]}>
              <Feather name="maximize" size={28} color={C.primary} />
            </View>
            <Text style={[s.stateTxt, { color: C.textSecondary }]}>Barcode skanerlash kutilmoqda</Text>
            <Text style={[s.stateHint, { color: C.textSecondary }]}>
              Mahsulot barcodni yuqoridagi kameraga ko'rsating
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const CORNER_SZ = 22;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },

  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#0A0A0A",
  },
  circle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  topTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  topSub: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  cameraWrap: { height: 270, position: "relative", overflow: "hidden" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: 240, height: 150, position: "relative" },
  corner: { position: "absolute", width: CORNER_SZ, height: CORNER_SZ, borderColor: "#fff", borderWidth: 3 },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: {
    position: "absolute", top: "50%", left: 4, right: 4, height: 2,
    backgroundColor: "#4ADE80", opacity: 0.9,
  },
  hint: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 14, fontFamily: "Inter_400Regular" },
  loadOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center", gap: 10,
  },
  loadTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  panel: {
    flex: 1, backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, marginTop: -4,
  },

  prodHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 16 },
  prodIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  prodName: { fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 22 },
  prodCat: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  prodMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 3 },
  statLbl: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  statUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },

  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10,
  },
  bannerTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },

  barcodeRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  barcodeVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", flex: 1 },
  barcodeUnit: { fontSize: 11, fontFamily: "Inter_400Regular" },

  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 10 },

  marginCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4,
  },
  marginTxt: { fontSize: 13, fontFamily: "Inter_400Regular" },

  bigBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 16,
  },
  bigBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  stateWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  stateIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  stateTxt: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  stateHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 240 },

  permIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  permTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  permDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 8 },
});
