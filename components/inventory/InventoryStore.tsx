import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ScanRecord = {
  id: string;
  sku: string;
  scannedAt: string; // ISO
  scannedBy: string; // username
  position?: string;
  description?: string;
  imageUri?: string; // first image for SKU can come from first scan that has image
};

export type SkuItem = {
  sku: string;
  total: number;
  positions: Record<string, number>; // { "Shelf A-1": 3, "Shelf B-2": 1 }
  firstImageUri?: string | null;
  description?: string; // you can decide: latest description or first non-empty
  scans: ScanRecord[]; // history (optional, but helpful)
};

export type WorkspaceMeta = {
  workspaceName: string;
  createdBy: string;
  createdAt: string; // ISO
  retailer?: string;
  description?: string;
};

type State = {
  workspace: WorkspaceMeta;
  itemsBySku: Record<string, SkuItem>;
};

type Ctx = {
  state: State;
  addScan: (input: {
    sku: string;
    scannedBy: string;
    position?: string;
    description?: string;
    imageUri?: string | null;
    scannedAt?: string;
  }) => void;
  updatePositionCount: (sku: string, position: string, delta: number) => void;
  importFromRows: (rows: Array<{ sku: string; num: number }>) => void;
  clearAll: () => void;
};

const STORAGE_KEY = "inventory_state_v1";

const defaultState: State = {
  workspace: {
    workspaceName: "Space Name",
    createdBy: "Display Name",
    createdAt: new Date().toISOString(),
    retailer: "",
    description: "",
  },
  itemsBySku: {},
};

const InventoryContext = createContext<Ctx | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(defaultState);
  const [loaded, setLoaded] = useState(false);

  // load once, original code
//   useEffect(() => {
//     (async () => {
//       const raw = await AsyncStorage.getItem(STORAGE_KEY);
//       if (raw) setState(JSON.parse(raw));
//       setLoaded(true);
//     })();
//   }, []);

/* restore data every time opens a new expo */
useEffect(() => {
  (async () => {
    // DEV ONLY: always start fresh on app launch
    if (__DEV__) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setState(defaultState);
      setLoaded(true);
      return;
    }

    // PROD: load persisted data
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) setState(JSON.parse(raw));
    setLoaded(true);
  })();
}, []);
/* Dev only mode ends, delete this later */

  // persist
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 300); // smoother UI

    return () => clearTimeout(t);
  }, [state, loaded]);

  const api: Ctx = useMemo(() => {
    return {
      state,

      addScan: ({ sku, scannedBy, position, description, imageUri, scannedAt }) => {
        const at = scannedAt ?? new Date().toISOString();
        setState((prev) => {
          const existing = prev.itemsBySku[sku];

          const scan: ScanRecord = {
            id: `${sku}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            sku,
            scannedAt: at,
            scannedBy,
            position: position?.trim() ? position.trim() : undefined,
            description: description?.trim() ? description.trim() : undefined,
            imageUri: imageUri ?? undefined,
          };

          const next: SkuItem = existing
            ? {
                ...existing,
                total: existing.total + 1,
                positions: {
                  ...existing.positions,
                  ...(scan.position
                    ? { [scan.position]: (existing.positions[scan.position] ?? 0) + 1 }
                    : {}),
                },
                // keep first image if already set; else use this one (if provided)
                firstImageUri: existing.firstImageUri ?? (imageUri || null),
                // choose: keep existing description; else set first non-empty
                description: existing.description ?? scan.description,
                scans: [scan, ...existing.scans],
              }
            : {
                sku,
                total: 1,
                positions: scan.position ? { [scan.position]: 1 } : {},
                firstImageUri: imageUri || null,
                description: scan.description,
                scans: [scan],
              };

          return {
            ...prev,
            itemsBySku: { ...prev.itemsBySku, [sku]: next },
          };
        });
      },

      updatePositionCount: (sku, position, delta) => {
        const pos = position.trim();
        if (!pos) return;

        setState((prev) => {
          const item = prev.itemsBySku[sku];
          if (!item) return prev;

          const current = item.positions[pos] ?? 0;
          const nextVal = Math.max(0, current + delta);

          // recompute total as sum of positions if positions exist, else adjust total
          const nextPositions = { ...item.positions, [pos]: nextVal };
          // remove if 0 to keep UI clean
          if (nextVal === 0) delete nextPositions[pos];

          const totalFromPositions =
            Object.values(nextPositions).reduce((a, b) => a + b, 0); // fallback

          const nextItem: SkuItem = {
            ...item,
            positions: nextPositions,
            total: totalFromPositions,
          };

          return { ...prev, itemsBySku: { ...prev.itemsBySku, [sku]: nextItem } };
        });
      },

      importFromRows: (rows) => {
        setState((prev) => {
          const itemsBySku = { ...prev.itemsBySku };

          for (const r of rows) {
            const sku = (r.sku ?? "").trim();
            const num = Number(r.num ?? 0);
            if (!sku || !Number.isFinite(num) || num <= 0) continue;

            const existing = itemsBySku[sku];
            if (!existing) {
              itemsBySku[sku] = {
                sku,
                total: num,
                positions: {},
                firstImageUri: null,
                description: undefined,
                scans: [],
              };
            } else {
              itemsBySku[sku] = { ...existing, total: existing.total + num };
            }
          }

          return { ...prev, itemsBySku };
        });
      },

      clearAll: () => setState(defaultState),
    };
  }, [state]);

  return <InventoryContext.Provider value={api}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside InventoryProvider");
  return ctx;
}
