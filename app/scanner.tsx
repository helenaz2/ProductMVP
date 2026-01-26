import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Inventory
async function addOrIncrementProduct(workspaceId: string, code: string) {
  console.log("Update inventory for workspace:", workspaceId, "code:", code);
}

// Main function
export default function BarcodeScannerPage() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();

    const [scanned, setScanned] = useState(false);
    const [lastCode, setLastCode] = useState<string | null>(null);

    // Ask for permission (back usually so mayb not testing out on simulator)
    const defaultFacing = useMemo(() => (Platform.OS === "web" ? "front" : "back"), []);
    const [facing, setFacing] = useState<"front" | "back">(defaultFacing);

    useEffect(() => {
        if (permission && !permission.granted) requestPermission();
    }, [permission, requestPermission]);

    const onBarcodeScanned = async (result: BarcodeScanningResult) => {
        if (scanned) return;

    // Test to see if mobile works
        console.log("Code detected:", result.data);

        const code = String(result.data ?? "").trim();
        if (!code) return;

    setScanned(true);
    setLastCode(code);

    // Lead to scaninfo page, store data
    router.push({
      pathname: "/scaninfo",
      params: { code: code } 
    });

    // Example usage
    await addOrIncrementProduct("demo-workspace", code);
    };

    // while waiting for permission show loading
    if (!permission) {
        return (
        <View style={styles.center}>
            <Text>Loading…</Text>
        </View>
        );
    }

    // If no permission ask again
    if (!permission.granted) {
        return (
        <View style={styles.center}>
            <Text style={{ marginBottom: 12 }}>Camera permission required</Text>
            <TouchableOpacity onPress={requestPermission} style={styles.btn}>
            <Text style={styles.btnText}>Grant permission</Text>
            </TouchableOpacity>
        </View>
        );
    }

    // Camera view and buttons
    return (
        <View style={styles.container}>
        <CameraView
            style={styles.camera}
            facing={facing}
            barcodeScannerSettings={{
            // Types of codes 
            barcodeTypes: ["qr", "ean13", "code128", "upc_a", "upc_e",],
            }}
            onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
        />

        <View style={styles.bottom}>
            <View style={styles.row}>
            <TouchableOpacity
                style={styles.btn}
                onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
            >
                <Text style={styles.btnText}>Flip camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.btn}
                onPress={() => {
                setScanned(false);
                setLastCode(null);
                }}
            >
                <Text style={styles.btnText}>Scan again</Text>
            </TouchableOpacity>
            </View>

            {lastCode && <Text style={styles.codeText}>Last scan: {lastCode}</Text>}
        </View>
        </View>
    );
    }

// CSS styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 30,
    alignItems: "center",
    gap: 10,
  },
  row: { flexDirection: "row", gap: 12 },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  btnText: { color: "white", fontSize: 16 },
  codeText: { color: "white", marginTop: 8 },
});
