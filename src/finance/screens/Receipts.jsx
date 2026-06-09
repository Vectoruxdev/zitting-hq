import React from 'react';
/* Receipts — receipt capture inbox (coming soon). */

function ZHQReceipts() {
  const { EmptyState } = window.ZittingHQDesignSystem_c9e528;
  return (
    <EmptyState
      icon="receipt"
      title="No receipts yet"
      body="Snap a photo of a receipt and we'll extract the line items and match it to a transaction. Receipt capture is coming soon."
    />
  );
}

// Kept for the mobile capture flow once receipts are wired up.
function ZHQCaptureFlow() {
  return null;
}

Object.assign(window, { ZHQReceipts, ZHQCaptureFlow });
