"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeInputProps {
  onScan: (code: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Identifica el campo en la pantalla que lo usa (label ↔ input y autotests). */
  id?: string;
}

export default function BarcodeInput({
  onScan,
  placeholder = "Escanear código de barras...",
  label = "Código de Barras",
  disabled = false,
  autoFocus = true,
  id = "codigo-barras",
}: BarcodeInputProps) {
  const [value, setValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef(0);
  const buffer = useRef("");
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current && !cameraActive) {
      inputRef.current.focus();
    }
  }, [autoFocus, cameraActive]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    setCameraError("");
    setCameraActive(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Small delay to ensure DOM element exists
      await new Promise((r) => setTimeout(r, 100));

      const scannerId = "barcode-scanner-region";
      const scanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Got a barcode!
          setIsScanning(true);
          onScan(decodedText);
          setValue("");
          setTimeout(() => setIsScanning(false), 500);
          stopCamera();
        },
        () => {
          // Ignore scan failures (just means no barcode in frame yet)
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al acceder a la cámara";
      setCameraError(msg);
      setCameraActive(false);
    }
  }

  async function stopCamera() {
    try {
      const scanner = html5QrCodeRef.current as { stop?: () => Promise<void>; clear?: () => void } | null;
      if (scanner?.stop) {
        await scanner.stop();
      }
      if (scanner?.clear) {
        scanner.clear();
      }
    } catch {
      // ignore
    }
    html5QrCodeRef.current = null;
    setCameraActive(false);
  }

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

    if (timeDiff < 50 && buffer.current.length > 2) {
      // barcode scanner detected
    }

    lastKeyTime.current = now;
    buffer.current += e.key;
  }

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
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
          id={id}
          name={id}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || cameraActive}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-10 pr-20 py-3 border-2 rounded-lg text-lg font-mono transition-colors ${
            isScanning
              ? "border-green-500 bg-green-50"
              : "border-gray-300 focus:border-blue-500"
          } focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {isScanning && (
            <span className="text-green-600 text-sm font-semibold animate-pulse">OK</span>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={cameraActive ? stopCamera : startCamera}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                cameraActive ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-blue-100 text-blue-600 hover:bg-blue-200"
              }`}
              title={cameraActive ? "Cerrar cámara" : "Escanear con cámara"}
            >
              {cameraActive ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Camera view */}
      {cameraActive && (
        <div className="mt-3 rounded-xl overflow-hidden border-2 border-blue-300 bg-black">
          <div id="barcode-scanner-region" ref={scannerRef} />
          <p className="text-center text-xs text-blue-300 py-2 bg-gray-900">Apunta la cámara al código de barras</p>
        </div>
      )}

      {cameraError && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {cameraError}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-1">
        Escanea con la pistola, escribe el código y presiona Enter, o usa el botón de cámara
      </p>
    </div>
  );
}
