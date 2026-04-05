import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

type Currency = "uzs" | "usd";
type TabType = "parda" | "dike" | "jalousie" | "karniiz";

const TABS: { key: TabType; label: string }[] = [
  { key: "parda", label: "Parda" },
  { key: "dike", label: "Dike" },
  { key: "jalousie", label: "Jalousie" },
  { key: "karniiz", label: "Karniiz" },
];

function useFmt(currency: Currency, rate: number) {
  return (uzs: number) => {
    if (currency === "usd") {
      return `$${(uzs / rate).toFixed(2)}`;
    }
    return `${new Intl.NumberFormat("uz-UZ").format(Math.round(uzs))} so'm`;
  };
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function NInput({
  label, value, onChange, suffix, C,
}: { label: string; value: string; onChange: (v: string) => void; suffix?: string; C: any }) {
  return (
    <View style={ninStyles.wrap}>
      <Text style={[ninStyles.label, { color: C.textSecondary }]}>{label}</Text>
      <View style={[ninStyles.row, { borderColor: C.border, backgroundColor: C.surface }]}>
        <TextInput
          style={[ninStyles.input, { color: C.text }]}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={C.textSecondary}
        />
        {suffix && <Text style={[ninStyles.suffix, { color: C.textSecondary }]}>{suffix}</Text>}
      </View>
    </View>
  );
}

const ninStyles = StyleSheet.create({
  wrap: { gap: 5 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 10, height: 44, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", height: 44 },
  suffix: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

function SelInput({ label, value, onChange, options, C }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; C: any }) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={[ninStyles.label, { color: C.textSecondary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {options.map(o => (
            <TouchableOpacity
              key={o.v}
              onPress={() => onChange(o.v)}
              style={[{
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5,
                borderColor: value === o.v ? C.primary : C.border,
                backgroundColor: value === o.v ? C.primary + "18" : C.surface,
              }]}
            >
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: value === o.v ? C.primary : C.textSecondary }}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Tog({ label, value, onChange, C }: { label: string; value: boolean; onChange: () => void; C: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: C.text, flex: 1 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.border, true: C.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function SHead({ title, C }: { title: string; C: any }) {
  return <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 }}>{title}</Text>;
}

function ResultView({ fmt, rows, total, C }: { fmt: (v: number) => string; rows: { l: string; v: number; acc?: boolean }[]; total: number; C: any }) {
  return (
    <View style={[rvStyles.card, { backgroundColor: C.primary }]}>
      <Text style={rvStyles.totLabel}>Umumiy narx</Text>
      <Text style={rvStyles.totVal}>{fmt(total)}</Text>
      <View style={rvStyles.divider} />
      {rows.map((r, i) => (
        <View key={i} style={rvStyles.row}>
          <Text style={rvStyles.rLabel}>{r.l}</Text>
          <Text style={[rvStyles.rVal, r.acc && { color: "#FDE68A" }]}>{fmt(r.v)}</Text>
        </View>
      ))}
    </View>
  );
}

const rvStyles = StyleSheet.create({
  card: { borderRadius: 20, padding: 20, gap: 8 },
  totLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  totVal: { fontSize: 28, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold", marginBottom: 4 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", flex: 1 },
  rVal: { fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" },
});

// ─── Parda ─────────────────────────────────────────────────────────────────
function PardaForm({ fmt, C }: { fmt: (v: number) => string; C: any }) {
  const [f, setF] = useState({
    windowWidth: "250", windowHeight: "270",
    fabricWidth: "280",
    fabricPrice: "90000", seamAllowance: "18",
    sewingPrice: "25000", profitPercent: "20",
    hasLining: false, liningPrice: "40000",
    hasRings: false, ringsCount: "16", ringPrice: "3000",
    hasInstall: false, installPrice: "80000",
  });
  const s = (k: keyof typeof f) => (v: any) => setF(p => ({ ...p, [k]: v }));

  const wW = parseFloat(f.windowWidth) || 0;
  const wH = parseFloat(f.windowHeight) || 0;
  const fW = parseFloat(f.fabricWidth) || 280;
  const fP = parseFloat(f.fabricPrice) || 0;
  const seam = parseFloat(f.seamAllowance) || 18;
  const sewP = parseFloat(f.sewingPrice) || 0;
  const profit = parseFloat(f.profitPercent) || 0;
  const lP = parseFloat(f.liningPrice) || 0;
  const rC = parseFloat(f.ringsCount) || 0;
  const rP = parseFloat(f.ringPrice) || 0;
  const instP = parseFloat(f.installPrice) || 0;

  const totalWidth = wW + 8; // 8cm side seams
  const numWidths = Math.ceil(totalWidth / fW);
  const runningM = numWidths * (wH + seam) / 100;
  const fabricCost = runningM * fP;
  const liningCost = f.hasLining ? runningM * lP : 0;
  const sewingCost = (wW / 100) * sewP;
  const ringsCost = f.hasRings ? rC * rP : 0;
  const installCost = f.hasInstall ? instP : 0;
  const sub = fabricCost + liningCost + sewingCost + ringsCost + installCost;
  const profitVal = sub * profit / 100;
  const total = sub + profitVal;

  const rows = [
    { l: `Mato (${runningM.toFixed(2)} m)`, v: fabricCost },
    ...(f.hasLining ? [{ l: `Astar (${runningM.toFixed(2)} m)`, v: liningCost }] : []),
    { l: "Tikuv", v: sewingCost },
    ...(f.hasRings ? [{ l: `Halqalar (${rC} ta)`, v: ringsCost }] : []),
    ...(f.hasInstall ? [{ l: "O'rnatish", v: installCost }] : []),
    { l: `Foyda (${profit}%)`, v: profitVal, acc: true },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={gs.infoRow}>
        <View style={gs.infoBadge}><Text style={gs.infoText}>Mato: {numWidths} ta polotno · {runningM.toFixed(2)} m</Text></View>
      </View>
      <SHead title="O'lchamlar" C={C} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="Oyna eni" value={f.windowWidth} onChange={s("windowWidth")} suffix="cm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Oyna bo'yi" value={f.windowHeight} onChange={s("windowHeight")} suffix="cm" C={C} /></View>
      </View>
      <SHead title="Mato" C={C} />
      <SelInput label="Mato eni (zavod)" value={f.fabricWidth} onChange={s("fabricWidth")} C={C} options={[
        { v: "150", l: "150 cm" }, { v: "280", l: "280 cm" }, { v: "300", l: "300 cm" }, { v: "320", l: "320 cm" }
      ]} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="Mato narxi (1m)" value={f.fabricPrice} onChange={s("fabricPrice")} suffix="so'm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Em (cm, jami)" value={f.seamAllowance} onChange={s("seamAllowance")} suffix="cm" C={C} /></View>
      </View>
      <SHead title="Tikuv va foyda" C={C} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="Tikuv (1m/narx)" value={f.sewingPrice} onChange={s("sewingPrice")} suffix="so'm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Foyda %" value={f.profitPercent} onChange={s("profitPercent")} suffix="%" C={C} /></View>
      </View>
      <SHead title="Qo'shimchalar" C={C} />
      <Tog label="Astarlash" value={f.hasLining} onChange={() => s("hasLining")(!f.hasLining)} C={C} />
      {f.hasLining && <NInput label="Astar narxi (1m)" value={f.liningPrice} onChange={s("liningPrice")} suffix="so'm" C={C} />}
      <Tog label="Halqalar/kruçkalar" value={f.hasRings} onChange={() => s("hasRings")(!f.hasRings)} C={C} />
      {f.hasRings && (
        <View style={gs.twoCol}>
          <View style={{ flex: 1 }}><NInput label="Soni" value={f.ringsCount} onChange={s("ringsCount")} suffix="ta" C={C} /></View>
          <View style={{ flex: 1 }}><NInput label="1 ta narxi" value={f.ringPrice} onChange={s("ringPrice")} suffix="so'm" C={C} /></View>
        </View>
      )}
      <Tog label="O'rnatish xizmati" value={f.hasInstall} onChange={() => s("hasInstall")(!f.hasInstall)} C={C} />
      {f.hasInstall && <NInput label="O'rnatish narxi" value={f.installPrice} onChange={s("installPrice")} suffix="so'm" C={C} />}
      <ResultView fmt={fmt} rows={rows} total={total} C={C} />
    </View>
  );
}

// ─── Dike parda ────────────────────────────────────────────────────────────
function DikeForm({ fmt, C }: { fmt: (v: number) => string; C: any }) {
  const [f, setF] = useState({
    width: "120", height: "200", type: "rolik",
    fabricPrice: "70000", stiffenerPrice: "15000",
    mechanismPrice: "45000", chainLength: "250", chainPrice: "8000",
    sewingPrice: "60000", profitPercent: "25",
    hasInstall: false, installPrice: "60000",
  });
  const s = (k: keyof typeof f) => (v: any) => setF(p => ({ ...p, [k]: v }));

  const wM = (parseFloat(f.width) + 4) / 100;
  const hM = (parseFloat(f.height) + 10) / 100;
  const sqm = wM * hM;
  const stiffCnt = Math.ceil(parseFloat(f.height) / 30);
  const fabricCost = sqm * (parseFloat(f.fabricPrice) || 0);
  const stiffCost = stiffCnt * (parseFloat(f.width) / 100) * (parseFloat(f.stiffenerPrice) || 0);
  const mechCost = parseFloat(f.mechanismPrice) || 0;
  const chainCost = (parseFloat(f.chainLength) / 100) * (parseFloat(f.chainPrice) || 0);
  const sewCost = sqm * (parseFloat(f.sewingPrice) || 0);
  const instCost = f.hasInstall ? parseFloat(f.installPrice) || 0 : 0;
  const sub = fabricCost + stiffCost + mechCost + chainCost + sewCost + instCost;
  const profitVal = sub * (parseFloat(f.profitPercent) || 0) / 100;
  const total = sub + profitVal;

  const rows = [
    { l: `Mato (${sqm.toFixed(3)} m²)`, v: fabricCost },
    { l: `Ustun (${stiffCnt}ta × ${(parseFloat(f.width) / 100).toFixed(2)}m)`, v: stiffCost },
    { l: "Mexanizm", v: mechCost },
    { l: `Zanjir (${(parseFloat(f.chainLength) / 100).toFixed(2)} m)`, v: chainCost },
    { l: "Tikuv", v: sewCost },
    ...(f.hasInstall ? [{ l: "O'rnatish", v: instCost }] : []),
    { l: `Foyda (${f.profitPercent}%)`, v: profitVal, acc: true },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={gs.infoRow}>
        <View style={[gs.infoBadge, { backgroundColor: "#EDE9FE" }]}>
          <Text style={[gs.infoText, { color: "#7C3AED" }]}>Maydon: {sqm.toFixed(3)} m² · Ustunlar: {stiffCnt} ta</Text>
        </View>
      </View>
      <SHead title="O'lchamlar" C={C} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="Eni" value={f.width} onChange={s("width")} suffix="cm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Bo'yi" value={f.height} onChange={s("height")} suffix="cm" C={C} /></View>
      </View>
      <SelInput label="Turi" value={f.type} onChange={s("type")} C={C} options={[
        { v: "rolik", l: "Rolik" }, { v: "roman", l: "Rimskiy" }, { v: "panel", l: "Panel" }
      ]} />
      <SHead title="Mato va materiallar" C={C} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="Mato (1 m²)" value={f.fabricPrice} onChange={s("fabricPrice")} suffix="so'm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Ustun (1 m)" value={f.stiffenerPrice} onChange={s("stiffenerPrice")} suffix="so'm" C={C} /></View>
      </View>
      <SHead title="Mexanizm" C={C} />
      <NInput label="Mexanizm narxi" value={f.mechanismPrice} onChange={s("mechanismPrice")} suffix="so'm" C={C} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="Zanjir uzunligi" value={f.chainLength} onChange={s("chainLength")} suffix="cm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Zanjir (1m)" value={f.chainPrice} onChange={s("chainPrice")} suffix="so'm" C={C} /></View>
      </View>
      <SHead title="Tikuv va foyda" C={C} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="Tikuv (1 m²)" value={f.sewingPrice} onChange={s("sewingPrice")} suffix="so'm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Foyda %" value={f.profitPercent} onChange={s("profitPercent")} suffix="%" C={C} /></View>
      </View>
      <Tog label="O'rnatish xizmati" value={f.hasInstall} onChange={() => s("hasInstall")(!f.hasInstall)} C={C} />
      {f.hasInstall && <NInput label="O'rnatish narxi" value={f.installPrice} onChange={s("installPrice")} suffix="so'm" C={C} />}
      <ResultView fmt={fmt} rows={rows} total={total} C={C} />
    </View>
  );
}

// ─── Jalousie ─────────────────────────────────────────────────────────────
function JalousieForm({ fmt, C }: { fmt: (v: number) => string; C: any }) {
  const [f, setF] = useState({
    width: "120", height: "160", type: "gorizontal",
    pricePerSqm: "120000", profitPercent: "20",
    hasValance: true, valancePrice: "20000",
    hasInstall: false, installPrice: "50000",
  });
  const s = (k: keyof typeof f) => (v: any) => setF(p => ({ ...p, [k]: v }));

  const sqm = (parseFloat(f.width) / 100) * (parseFloat(f.height) / 100);
  const jalCost = sqm * (parseFloat(f.pricePerSqm) || 0);
  const valCost = f.hasValance ? (parseFloat(f.width) / 100) * (parseFloat(f.valancePrice) || 0) : 0;
  const instCost = f.hasInstall ? parseFloat(f.installPrice) || 0 : 0;
  const sub = jalCost + valCost + instCost;
  const profitVal = sub * (parseFloat(f.profitPercent) || 0) / 100;
  const total = sub + profitVal;

  const rows = [
    { l: `Jalousie (${sqm.toFixed(3)} m²)`, v: jalCost },
    ...(f.hasValance ? [{ l: `Valyans (${(parseFloat(f.width) / 100).toFixed(2)} m)`, v: valCost }] : []),
    ...(f.hasInstall ? [{ l: "O'rnatish", v: instCost }] : []),
    { l: `Foyda (${f.profitPercent}%)`, v: profitVal, acc: true },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={gs.infoRow}>
        <View style={[gs.infoBadge, { backgroundColor: "#FEF3C7" }]}>
          <Text style={[gs.infoText, { color: "#D97706" }]}>Maydon: {sqm.toFixed(3)} m²</Text>
        </View>
      </View>
      <SHead title="O'lchamlar" C={C} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="Eni" value={f.width} onChange={s("width")} suffix="cm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Bo'yi" value={f.height} onChange={s("height")} suffix="cm" C={C} /></View>
      </View>
      <SelInput label="Turi" value={f.type} onChange={s("type")} C={C} options={[
        { v: "gorizontal", l: "Gorizontal" }, { v: "vertikal", l: "Vertikal" }, { v: "zebra", l: "Zebra" },
        { v: "den_noch", l: "Den-noch" }, { v: "kassetniy", l: "Kassetniy" }
      ]} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="1 m² narxi" value={f.pricePerSqm} onChange={s("pricePerSqm")} suffix="so'm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Foyda %" value={f.profitPercent} onChange={s("profitPercent")} suffix="%" C={C} /></View>
      </View>
      <Tog label="Valyans" value={f.hasValance} onChange={() => s("hasValance")(!f.hasValance)} C={C} />
      {f.hasValance && <NInput label="Valyans narxi (1m)" value={f.valancePrice} onChange={s("valancePrice")} suffix="so'm" C={C} />}
      <Tog label="O'rnatish xizmati" value={f.hasInstall} onChange={() => s("hasInstall")(!f.hasInstall)} C={C} />
      {f.hasInstall && <NInput label="O'rnatish narxi" value={f.installPrice} onChange={s("installPrice")} suffix="so'm" C={C} />}
      <ResultView fmt={fmt} rows={rows} total={total} C={C} />
    </View>
  );
}

// ─── Karniiz ─────────────────────────────────────────────────────────────
function KarniizForm({ fmt, C }: { fmt: (v: number) => string; C: any }) {
  const [f, setF] = useState({
    length: "250", type: "plastic_2",
    pricePerM: "35000", profitPercent: "20",
    hasFinials: true, finialsPrice: "15000",
    hasBrackets: true, bracketsCount: "3", bracketPrice: "5000",
    hasInstall: false, installPrice: "40000",
  });
  const s = (k: keyof typeof f) => (v: any) => setF(p => ({ ...p, [k]: v }));

  const lenM = parseFloat(f.length) / 100;
  const cornCost = lenM * (parseFloat(f.pricePerM) || 0);
  const finCost = f.hasFinials ? parseFloat(f.finialsPrice) || 0 : 0;
  const brCost = f.hasBrackets ? (parseFloat(f.bracketsCount) || 0) * (parseFloat(f.bracketPrice) || 0) : 0;
  const instCost = f.hasInstall ? parseFloat(f.installPrice) || 0 : 0;
  const sub = cornCost + finCost + brCost + instCost;
  const profitVal = sub * (parseFloat(f.profitPercent) || 0) / 100;
  const total = sub + profitVal;

  const rows = [
    { l: `Karniiz (${lenM.toFixed(2)} m)`, v: cornCost },
    ...(f.hasFinials ? [{ l: "Boshliklar (2 ta)", v: finCost }] : []),
    ...(f.hasBrackets ? [{ l: `Kronshteynlar (${f.bracketsCount} ta)`, v: brCost }] : []),
    ...(f.hasInstall ? [{ l: "O'rnatish", v: instCost }] : []),
    { l: `Foyda (${f.profitPercent}%)`, v: profitVal, acc: true },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={gs.infoRow}>
        <View style={[gs.infoBadge, { backgroundColor: "#F1F5F9" }]}>
          <Text style={[gs.infoText, { color: "#475569" }]}>Uzunlik: {lenM.toFixed(2)} m</Text>
        </View>
      </View>
      <SHead title="O'lcham va tur" C={C} />
      <NInput label="Uzunligi" value={f.length} onChange={s("length")} suffix="cm" C={C} />
      <SelInput label="Karniiz turi" value={f.type} onChange={s("type")} C={C} options={[
        { v: "plastic_1", l: "1-yo'llik" }, { v: "plastic_2", l: "2-yo'llik" }, { v: "plastic_3", l: "3-yo'llik" },
        { v: "metal_1", l: "Metall 1" }, { v: "metal_2", l: "Metall 2" }, { v: "bagetli", l: "Bagetli" }, { v: "potolok", l: "Shift" },
      ]} />
      <View style={gs.twoCol}>
        <View style={{ flex: 1 }}><NInput label="1 metr narxi" value={f.pricePerM} onChange={s("pricePerM")} suffix="so'm" C={C} /></View>
        <View style={{ flex: 1 }}><NInput label="Foyda %" value={f.profitPercent} onChange={s("profitPercent")} suffix="%" C={C} /></View>
      </View>
      <Tog label="Boshliklar (finials)" value={f.hasFinials} onChange={() => s("hasFinials")(!f.hasFinials)} C={C} />
      {f.hasFinials && <NInput label="Boshliklar narxi (juft)" value={f.finialsPrice} onChange={s("finialsPrice")} suffix="so'm" C={C} />}
      <Tog label="Kronshteynlar" value={f.hasBrackets} onChange={() => s("hasBrackets")(!f.hasBrackets)} C={C} />
      {f.hasBrackets && (
        <View style={gs.twoCol}>
          <View style={{ flex: 1 }}><NInput label="Soni" value={f.bracketsCount} onChange={s("bracketsCount")} suffix="ta" C={C} /></View>
          <View style={{ flex: 1 }}><NInput label="1 ta narxi" value={f.bracketPrice} onChange={s("bracketPrice")} suffix="so'm" C={C} /></View>
        </View>
      )}
      <Tog label="O'rnatish xizmati" value={f.hasInstall} onChange={() => s("hasInstall")(!f.hasInstall)} C={C} />
      {f.hasInstall && <NInput label="O'rnatish narxi" value={f.installPrice} onChange={s("installPrice")} suffix="so'm" C={C} />}
      <ResultView fmt={fmt} rows={rows} total={total} C={C} />
    </View>
  );
}

const gs = StyleSheet.create({
  twoCol: { flexDirection: "row", gap: 10 },
  infoRow: { flexDirection: "row" },
  infoBadge: { backgroundColor: "#EFF6FF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  infoText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1D4ED8" },
});

// ─── Main ─────────────────────────────────────────────────────────────────
export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();
  const C = Colors.light;
  const [activeTab, setActiveTab] = useState<TabType>("parda");
  const [currency, setCurrency] = useState<Currency>("uzs");
  const [rate, setRate] = useState("12700");

  const fmt = useFmt(currency, parseFloat(rate) || 12700);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: C.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 20 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: C.text }]}>Kalkulyator</Text>

      {/* Currency toggle */}
      <View style={styles.currRow}>
        <TouchableOpacity
          onPress={() => setCurrency("uzs")}
          style={[styles.currBtn, currency === "uzs" && { backgroundColor: C.primary }]}
        >
          <Text style={[styles.currText, currency === "uzs" ? { color: "#fff" } : { color: C.textSecondary }]}>🇺🇿 So'm</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrency("usd")}
          style={[styles.currBtn, currency === "usd" && { backgroundColor: "#16A34A" }]}
        >
          <Text style={[styles.currText, currency === "usd" ? { color: "#fff" } : { color: C.textSecondary }]}>$ Dollar</Text>
        </TouchableOpacity>
        {currency === "usd" && (
          <View style={[styles.rateWrap, { borderColor: C.border, backgroundColor: C.surface }]}>
            <Text style={{ fontSize: 11, color: C.textSecondary }}>1$=</Text>
            <TextInput
              style={{ fontSize: 13, color: "#16A34A", fontFamily: "Inter_600SemiBold", width: 60 }}
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
            />
          </View>
        )}
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[styles.tab, activeTab === t.key && { backgroundColor: C.primary, borderColor: C.primary }]}
            >
              <Text style={[styles.tabTxt, { color: activeTab === t.key ? "#fff" : C.textSecondary }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Forms */}
      {activeTab === "parda" && <PardaForm fmt={fmt} C={C} />}
      {activeTab === "dike" && <DikeForm fmt={fmt} C={C} />}
      {activeTab === "jalousie" && <JalousieForm fmt={fmt} C={C} />}
      {activeTab === "karniiz" && <KarniizForm fmt={fmt} C={C} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 12 },
  currRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  currBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: "#F1F5F9" },
  currText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rateWrap: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  tabTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
