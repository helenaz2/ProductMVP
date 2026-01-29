import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Papa from "papaparse";
import { InventoryProvider, useInventory, SkuItem } from "../components/inventory/InventoryStore";

type SortMode = "SKU" | "NUM";

function InventoryHomeInner() {
  const router = useRouter();
  const { state, importFromRows, updatePositionCount } = useInventory();

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("SKU");

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [selectedSku, setSelectedSku] = useState<SkuItem | null>(null);

  const items = useMemo(() => {
    const all = Object.values(state.itemsBySku);
    const q = search.trim().toLowerCase();

    const filtered = q ? all.filter((it) => it.sku.toLowerCase().includes(q)) : all;

    const sorted = [...filtered].sort((a, b) => {
      const aZero = (a.total ?? 0) === 0;
      const bZero = (b.total ?? 0) === 0;

      // 1) Always push zeros to bottom
      if (aZero !== bZero) return aZero ? 1 : -1;

      // 2) Then apply chosen sort
      if (sortMode === "NUM") {
        return (b.total ?? 0) - (a.total ?? 0) || a.sku.localeCompare(b.sku);
      }
      return a.sku.localeCompare(b.sku);
    });


    return sorted;
  }, [state.itemsBySku, search, sortMode]);

  const onUploadCsv = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "application/vnd.ms-excel", "application/csv"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;

    const file = res.assets[0];
    const text = await FileSystem.readAsStringAsync(file.uri);

    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    // Expect columns: SKU, NUM (case-insensitive)
    const rows = (parsed.data as any[]).map((r) => ({
      sku: String(r.SKU ?? r.sku ?? "").trim(),
      num: Number(r.NUM ?? r.num ?? 0),
    }));

    importFromRows(rows);
  };

  const onDownloadCsv = async () => {
    const rows = items.map((it) => ({ SKU: it.sku, NUM: it.total }));
    const csv = Papa.unparse(rows);

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) throw new Error("No writable directory available");

    const filename = `inventory_${Date.now()}.csv`;
    const uri = baseDir + filename;

    await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
    });

    // 2) Share / save outward
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
        // On web this is often false
        alert(`Saved locally at:\n${uri}`);
        return;
    }

    await Sharing.shareAsync(uri, {
        mimeType: "text/csv",
        dialogTitle: "Export inventory",
        UTI: "public.comma-separated-values-text", // helps iOS recognize it
    });
  };

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => { /* later: go back to workspace list */ }} style={styles.backBtn}>
          <Text style={styles.backText}>{"<"}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{state.workspace.workspaceName}</Text>

        <TouchableOpacity onPress={() => setWorkspaceOpen(true)} style={styles.infoBtn}>
          <Text style={styles.infoText}>i</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/scanner")}>
          <Text style={styles.actionText}>📷  Start Scanning</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onUploadCsv}>
          <Text style={styles.actionText}>⬆️  Upload CSV</Text>
        </TouchableOpacity>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search SKU"
            placeholderTextColor="#777"
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* Sort + Download */}
      <View style={styles.metaRow}>
        <TouchableOpacity onPress={() => setSortOpen(true)} style={styles.metaBtn}>
          <Text style={styles.metaBtnText}>Sort By</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onDownloadCsv} style={styles.metaBtn}>
          <Text style={styles.metaBtnText}>Download CSV ⬇️</Text>
        </TouchableOpacity>
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 1 }]}>SKU</Text>
        <Text style={[styles.th, { width: 70, textAlign: "right" }]}>NUM</Text>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(it) => it.sku}
        renderItem={({ item }) => {
        const isZero = item.total === 0;

        return (
            <TouchableOpacity
            style={[styles.row, isZero && styles.rowZero]}
            onPress={() => setSelectedSku(item)}
            >
            <Text style={[styles.cellSku, isZero && styles.textZero]}>
                {item.sku}
            </Text>
            <Text style={[styles.cellNum, isZero && styles.textZero]}>
                {item.total}
            </Text>
            </TouchableOpacity>
        );
        }}

        ListEmptyComponent={<Text style={styles.empty}>No items yet. Scan something!</Text>}
      />

      {/* Workspace info modal (picture 2) */}
      <Modal visible={workspaceOpen} transparent animationType="fade" onRequestClose={() => setWorkspaceOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setWorkspaceOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalLine}>Time Created: {formatTime(state.workspace.createdAt)}</Text>
            <Text style={styles.modalLine}>Created By: {state.workspace.createdBy}</Text>
            <Text style={styles.modalLine}>Retailer: {state.workspace.retailer || ""}</Text>
            <Text style={styles.modalLine}>Descriptions: {state.workspace.description || ""}</Text>
          </View>
        </Pressable>
      </Modal>

      {/* Sort modal */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setSortOpen(false)}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => { setSortMode("SKU"); setSortOpen(false); }}>
              <Text style={styles.modalLine}>Sort by SKU</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSortMode("NUM"); setSortOpen(false); }}>
              <Text style={styles.modalLine}>Sort by NUM</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* SKU details modal (picture 3) */}
      <Modal visible={!!selectedSku} transparent animationType="slide" onRequestClose={() => setSelectedSku(null)}>
        <View style={styles.sheetBg}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedSku?.sku}</Text>
              <TouchableOpacity onPress={() => setSelectedSku(null)}><Text style={styles.close}>Close</Text></TouchableOpacity>
            </View>

            {selectedSku && (
              <>
                <Text style={styles.sheetLine}>Time Scanned: {selectedSku.scans[0]?.scannedAt ? formatTime(selectedSku.scans[0].scannedAt) : ""}</Text>
                <Text style={styles.sheetLine}>Scanned By: {selectedSku.scans[0]?.scannedBy ?? ""}</Text>

                <Text style={styles.sectionTitle}>Positions:</Text>
                {Object.keys(selectedSku.positions).length === 0 ? (
                  <Text style={styles.dim}>No positions added yet.</Text>
                ) : (
                  Object.entries(selectedSku.positions).map(([pos, count]) => (
                    <View key={pos} style={styles.posRow}>
                      <Text style={styles.posText}>{pos}</Text>

                      <TouchableOpacity onPress={() => updatePositionCount(selectedSku.sku, pos, +1)} style={styles.pmBtn}>
                        <Text style={styles.pmText}>+</Text>
                      </TouchableOpacity>

                      <Text style={styles.posCount}>{count}</Text>

                      <TouchableOpacity onPress={() => updatePositionCount(selectedSku.sku, pos, -1)} style={styles.pmBtn}>
                        <Text style={styles.pmText}>−</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <Text style={styles.sectionTitle}>Picture:</Text>
                {selectedSku.firstImageUri ? (
                  <Image source={{ uri: selectedSku.firstImageUri }} style={styles.preview} />
                ) : (
                  <Text style={styles.dim}>No picture.</Text>
                )}

                <Text style={styles.sectionTitle}>Descriptions:</Text>
                <Text style={styles.dim}>{selectedSku.description || ""}</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function InventoryHome() {
  // Wrap the page so state persists and is shared with ScanInfo later
  return <InventoryHomeInner />;
}

function formatTime(iso: string) {
  // simple display; later you can use date-fns
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}  ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff", paddingTop: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
  backBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 18 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600" },
  infoBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  infoText: { fontWeight: "700" },

  actions: { padding: 16, gap: 10 },
  actionBtn: { backgroundColor: "#ddd", padding: 12, borderRadius: 8, alignItems: "center" },
  actionText: { fontSize: 16 },

  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16 },

  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  metaBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  metaBtnText: { textDecorationLine: "underline" },

  tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#ccc" },
  th: { fontWeight: "700" },

  row: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  cellSku: { flex: 1 },
  cellNum: { width: 70, textAlign: "right", fontWeight: "600" },

  empty: { padding: 16, color: "#777" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", paddingTop: 80, paddingHorizontal: 16 },
  modalCard: { backgroundColor: "#eee", borderRadius: 10, padding: 14 },
  modalLine: { fontSize: 14, marginBottom: 10 },

  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#eee", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "85%" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  close: { textDecorationLine: "underline" },
  sheetLine: { fontSize: 14, marginBottom: 10 },

  sectionTitle: { marginTop: 16, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  dim: { color: "#444" },

  posRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  posText: { flex: 1 },
  pmBtn: { width: 32, height: 32, borderRadius: 6, backgroundColor: "#ddd", alignItems: "center", justifyContent: "center" },
  pmText: { fontSize: 18, fontWeight: "700" },
  posCount: { width: 24, textAlign: "center", fontWeight: "700" },

  preview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#ccc" },

  rowZero: {backgroundColor: "#f2f2f2"},
  textZero: {color: "#999"},
});
