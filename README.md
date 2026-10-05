# ShopPOS Pro

ShopPOS Pro is a modern, reliable, local-first retail Point of Sale (POS), inventory management, and digital Khata ledger system built for real-world retail shops. Built with React 19, TypeScript, Vite, Tailwind CSS, and packaged for Android using Capacitor.

## Features

- **Fast POS Billing**: Barcode scanning, custom line items, discounts, GST calculation, split & credit payments.
- **Inventory & Stock Management**: Low-stock alerts, batch expiry tracking, barcode label printing, and stock adjustments.
- **Customer Khata Ledger**: Udhaar tracking, payment reminders, and transaction histories.
- **Supplier & Purchase Bills**: Purchase entry, inwards management, and supplier accounts.
- **Thermal & PDF Printing**: Native Bluetooth and ESC/POS thermal printing (58mm/80mm) as well as A4 invoices with jsPDF.
- **Android Ready**: Native barcode scanning with Google Play Services MLKit, hardware back button navigation, and offline IndexedDB persistence.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

### 3. Build for Production

```bash
npm run build
```

### 4. Sync to Android (Capacitor)

```bash
npx cap sync android
```

Or using the convenience script:

```bash
npm run cap:sync
```
