'use client';
import { useState } from 'react';
import { exportDetections } from '../../../lib/api/client';
import type { ExportFormat, QueryOptions } from '../../../lib/api/types';
import { downloadBlob } from '../../../lib/format';
import { errorMessage } from '../../../lib/api/errors';
import { useConsole } from '../../layout/providers';
import { c } from '../../../lib/styles';
export function ExportActions({ options }: { options?: QueryOptions }) {
  const { admin, openLogin, toast } = useConsole();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  async function download(format: ExportFormat) {
    if (!admin) {
      openLogin();
      return;
    }
    setBusy(format);
    try {
      downloadBlob(await exportDetections(format, options), `detections.${format}`);
      toast(`${format.toUpperCase()} export downloaded.`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      {(['csv', 'geojson'] as const).map((format) => (
        <button
          key={format}
          className={c('btn', format === 'geojson' ? 'solid' : 'quiet')}
          disabled={!!busy}
          onClick={() => void download(format)}
        >
          {busy === format ? 'Downloading…' : format === 'csv' ? 'CSV' : 'GeoJSON'}
          {!admin ? ' · GHA' : ''}
        </button>
      ))}
    </>
  );
}
