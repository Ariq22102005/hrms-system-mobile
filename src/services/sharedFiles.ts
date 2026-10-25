import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { fromByteArray } from 'base64-js';
import { api, createRequestId, FileDto } from './api';

export async function saveSharedFile(file: FileDto): Promise<void> {
  let temporaryUri: string | undefined;
  try {
    const { bytes } = await api.getBinary(file.url, 10 * 1024 * 1024);
    const filename = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'file';
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([bytes]));
      const link = document.createElement('a'); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error('Penyimpanan file belum tersedia di perangkat ini.');
      temporaryUri = `${FileSystem.cacheDirectory}${createRequestId()}-${filename}`;
      await FileSystem.writeAsStringAsync(temporaryUri, fromByteArray(bytes), { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(temporaryUri, { dialogTitle: file.name });
    }
  } finally {
    if (temporaryUri) await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
  }
}
