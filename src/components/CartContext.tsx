"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  name: string;
  price: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (name: string, price: string) => void;
  removeItem: (name: string) => void;
  updateQuantity: (name: string, quantity: number) => void;
  getQuantity: (name: string) => number;
  clearCart: () => void;
  totalItems: number;
  cartSummaryText: () => string;
  rangeVon: string | null;
  rangeBis: string | null;
  setRange: (von: string | null, bis: string | null) => void;
  clearRange: () => void;
  hydrated: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  aufbauKomplett: boolean;
  setAufbauKomplett: (v: boolean) => void;
  // Lieferung / Abholung
  lieferungGewuenscht: boolean;
  abholungGewuenscht: boolean;
  setLieferungGewuenscht: (v: boolean) => void;
  setAbholungGewuenscht: (v: boolean) => void;
  lieferStrasse: string;
  lieferHausnr: string;
  setLieferAdresse: (strasse: string, hausnr: string) => void;
  distanceKm: number | null;
  setDistanceKm: (v: number | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const STORAGE_KEY = "eve-cart-v1";

interface PersistedState {
  items: CartItem[];
  rangeVon: string | null;
  rangeBis: string | null;
  aufbauKomplett: boolean;
  lieferungGewuenscht: boolean;
  abholungGewuenscht: boolean;
  lieferStrasse: string;
  lieferHausnr: string;
  distanceKm: number | null;
}

function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function loadInitial(): PersistedState {
  const empty: PersistedState = {
    items: [],
    rangeVon: null,
    rangeBis: null,
    aufbauKomplett: false,
    lieferungGewuenscht: false,
    abholungGewuenscht: false,
    lieferStrasse: "",
    lieferHausnr: "",
    distanceKm: null,
  };
  if (typeof window === "undefined") return empty;

  let urlVon: string | null = null;
  let urlBis: string | null = null;
  try {
    const u = new URL(window.location.href);
    const v = u.searchParams.get("von");
    const b = u.searchParams.get("bis");
    if (isIsoDate(v) && isIsoDate(b) && v <= b) {
      urlVon = v;
      urlBis = b;
    }
  } catch {
    // ignore
  }

  let storedItems: CartItem[] = [];
  let storedVon: string | null = null;
  let storedBis: string | null = null;
  let storedAufbau = false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState> & { aufbauItems?: unknown };
      if (Array.isArray(parsed.items)) {
        storedItems = parsed.items.filter(
          (i): i is CartItem =>
            !!i &&
            typeof i.name === "string" &&
            typeof i.price === "string" &&
            typeof i.quantity === "number" &&
            i.quantity > 0,
        );
      }
      if (isIsoDate(parsed.rangeVon) && isIsoDate(parsed.rangeBis) && parsed.rangeVon <= parsed.rangeBis) {
        storedVon = parsed.rangeVon;
        storedBis = parsed.rangeBis;
      }
      if (typeof parsed.aufbauKomplett === "boolean") {
        storedAufbau = parsed.aufbauKomplett;
      } else if (Array.isArray(parsed.aufbauItems) && parsed.aufbauItems.length > 0) {
        // Legacy-Migration: alter Per-Item-Toggle-State → wenn mind. ein Item Aufbau hatte,
        // wird der neue Komplettpaket-Toggle aktiviert. Sonst kein Aufbau.
        storedAufbau = true;
      }
      if (typeof parsed.lieferungGewuenscht === "boolean") empty.lieferungGewuenscht = parsed.lieferungGewuenscht;
      if (typeof parsed.abholungGewuenscht === "boolean") empty.abholungGewuenscht = parsed.abholungGewuenscht;
      if (typeof parsed.lieferStrasse === "string") empty.lieferStrasse = parsed.lieferStrasse;
      if (typeof parsed.lieferHausnr === "string") empty.lieferHausnr = parsed.lieferHausnr;
      if (typeof parsed.distanceKm === "number" && parsed.distanceKm > 0) empty.distanceKm = parsed.distanceKm;
    }
  } catch {
    // ignore
  }

  return {
    items: storedItems,
    rangeVon: urlVon ?? storedVon,
    rangeBis: urlBis ?? storedBis,
    aufbauKomplett: storedAufbau,
    lieferungGewuenscht: empty.lieferungGewuenscht,
    abholungGewuenscht: empty.abholungGewuenscht,
    lieferStrasse: empty.lieferStrasse,
    lieferHausnr: empty.lieferHausnr,
    distanceKm: empty.distanceKm,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [rangeVon, setRangeVon] = useState<string | null>(null);
  const [rangeBis, setRangeBis] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aufbauKomplett, setAufbauKomplett] = useState(false);
  const [lieferungGewuenscht, setLieferungGewuenscht] = useState(false);
  const [abholungGewuenscht, setAbholungGewuenscht] = useState(false);
  const [lieferStrasse, setLieferStrasse] = useState("");
  const [lieferHausnr, setLieferHausnr] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const setLieferAdresse = (strasse: string, hausnr: string) => {
    setLieferStrasse(strasse);
    setLieferHausnr(hausnr);
    // Adresse hat sich geaendert → Distance neu berechnen lassen
    setDistanceKm(null);
  };

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  // Hydration: lade aus localStorage + URL nach Mount
  useEffect(() => {
    const init = loadInitial();
    setItems(init.items);
    setRangeVon(init.rangeVon);
    setRangeBis(init.rangeBis);
    setAufbauKomplett(init.aufbauKomplett);
    setLieferungGewuenscht(init.lieferungGewuenscht);
    setAbholungGewuenscht(init.abholungGewuenscht);
    setLieferStrasse(init.lieferStrasse);
    setLieferHausnr(init.lieferHausnr);
    setDistanceKm(init.distanceKm);
    setHydrated(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          items,
          rangeVon,
          rangeBis,
          aufbauKomplett,
          lieferungGewuenscht,
          abholungGewuenscht,
          lieferStrasse,
          lieferHausnr,
          distanceKm,
        }),
      );
    } catch {
      // ignore quota errors
    }
  }, [
    items,
    rangeVon,
    rangeBis,
    aufbauKomplett,
    lieferungGewuenscht,
    abholungGewuenscht,
    lieferStrasse,
    lieferHausnr,
    distanceKm,
    hydrated,
  ]);

  // Wenn Cart leer wird, Aufbau-Toggle zurueck (kein verwaister State)
  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0 && aufbauKomplett) setAufbauKomplett(false);
  }, [items, aufbauKomplett, hydrated]);

  // URL-Sync (Deep-Link bleibt aktuell)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const u = new URL(window.location.href);
      if (rangeVon && rangeBis) {
        u.searchParams.set("von", rangeVon);
        u.searchParams.set("bis", rangeBis);
      } else {
        u.searchParams.delete("von");
        u.searchParams.delete("bis");
      }
      window.history.replaceState(null, "", u.toString());
    } catch {
      // ignore
    }
  }, [rangeVon, rangeBis, hydrated]);

  const addItem = (name: string, price: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.name === name);
      if (existing) {
        return prev.map((i) =>
          i.name === name ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { name, price, quantity: 1 }];
    });
  };

  const removeItem = (name: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.name === name);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.name === name ? { ...i, quantity: i.quantity - 1 } : i,
        );
      }
      return prev.filter((i) => i.name !== name);
    });
  };

  const updateQuantity = (name: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.name !== name));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.name === name ? { ...i, quantity } : i)),
      );
    }
  };

  const getQuantity = (name: string) => {
    return items.find((i) => i.name === name)?.quantity || 0;
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  const cartSummaryText = () => {
    return items.map((i) => `${i.quantity}x ${i.name} (${i.price})`).join("\n");
  };

  const setRange = (von: string | null, bis: string | null) => {
    // Partial-Selection erlauben: react-day-picker emittiert (from, null)
    // nach dem ersten Tag-Klick. Wenn wir das beidseitig clearen, kommt
    // der User nie zu einem kompletten Range. URL-Sync + AvailabilityCounter
    // ignorieren Partial-State (prüfen rangeVon && rangeBis), insofern
    // ist Partial im Cart unschaedlich.
    if (!von) {
      setRangeVon(null);
      setRangeBis(null);
      return;
    }
    if (!isIsoDate(von)) {
      setRangeVon(null);
      setRangeBis(null);
      return;
    }
    if (!bis) {
      // Nur Start gesetzt — Pickers Range-Selection in Phase 1
      setRangeVon(von);
      setRangeBis(null);
      return;
    }
    if (!isIsoDate(bis) || von > bis) {
      // Invalide Bis → behandle wie Partial: Start behalten, Bis verwerfen
      setRangeVon(von);
      setRangeBis(null);
      return;
    }
    setRangeVon(von);
    setRangeBis(bis);
  };

  const clearRange = () => {
    setRangeVon(null);
    setRangeBis(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        getQuantity,
        clearCart,
        totalItems,
        cartSummaryText,
        rangeVon,
        rangeBis,
        setRange,
        clearRange,
        hydrated,
        drawerOpen,
        openDrawer,
        closeDrawer,
        aufbauKomplett,
        setAufbauKomplett,
        lieferungGewuenscht,
        abholungGewuenscht,
        setLieferungGewuenscht,
        setAbholungGewuenscht,
        lieferStrasse,
        lieferHausnr,
        setLieferAdresse,
        distanceKm,
        setDistanceKm,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
