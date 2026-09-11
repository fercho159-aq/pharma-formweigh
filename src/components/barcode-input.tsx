"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeInputProps {
  onScan: (code: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function BarcodeInput({
  onScan,
  placeholder = "Escanear código de barras...",
  label = "Código de Barras",
  disabled = false,
  autoFocus = true,
}: BarcodeInputProps) {
  const [value, setValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef(0);
  const buffer = useRef("");

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const now = Date.now();
    const timeDiff = now - lastKeyTime.current;

    if (e.key === "Enter") {
      e.preventDefault();
      const code = value.trim();
      if (code) {
        setIsScanning(true);
        onScan(code);
        setValue("");
        buffer.current = "";
        setTimeout(() => setIsScanning(false), 500);
      }
      return;
    }

    // Detect rapid input (barcode scanner sends chars very fast)
    if (timeDiff < 50 && buffer.current.length > 2) {
      // This is likely a barcode scanner
    }

    lastKeyTime.current = now;
    buffer.current += e.key;
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            className={`w-5 h-5 ${isScanning ? "text-green-500 animate-pulse" : "text-gray-400"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg text-lg font-mono transition-colors ${
            isScanning
              ? "border-green-500 bg-green-50"
              : "border-gray-300 focus:border-blue-500"
          } focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed`}
        />
        {isScanning && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-green-600 text-sm font-semibold animate-pulse">Escaneado</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1">Escanea con la pistola o escribe el código y presiona Enter</p>
    </div>
  );
}
