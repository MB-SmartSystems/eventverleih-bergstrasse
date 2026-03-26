"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (name: string, price: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.name === name);
      if (existing) {
        return prev.map((i) =>
          i.name === name ? { ...i, quantity: i.quantity + 1 } : i
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
          i.name === name ? { ...i, quantity: i.quantity - 1 } : i
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
        prev.map((i) => (i.name === name ? { ...i, quantity } : i))
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
