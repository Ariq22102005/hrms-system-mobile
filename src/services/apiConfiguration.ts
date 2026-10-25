export type AppEnvironment = 'mock' | 'development' | 'staging' | 'production';
export function validateBaseUrl(baseUrl: string, environment: string): string {
  if (!['mock', 'development', 'staging', 'production'].includes(environment)) throw new Error('Environment API tidak dikenal.');
  let url: URL;
  try { url = new URL(baseUrl.trim()); } catch { throw new Error('URL API belum dikonfigurasi atau tidak valid.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('URL API tidak aman atau mengandung kredensial/query.');
  if (['staging', 'production'].includes(environment) && (url.protocol !== 'https:' || /(^|\.)(localhost|example\.(com|test|org))$/i.test(url.hostname) || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname === '[::1]')) throw new Error('Staging/production wajib menggunakan URL HTTPS backend perusahaan.');
  return url.toString().replace(/\/+$/, '');
}
export function sameOriginAssetUrl(baseUrl: string, path: string): string {
  const base = new URL(baseUrl);
  const asset = new URL(path, `${baseUrl.replace(/\/+$/, '')}/`);
  if (!['http:', 'https:'].includes(asset.protocol) || asset.origin !== base.origin || asset.username || asset.password) throw new Error('URL file/foto harus menggunakan origin API tanpa kredensial.');
  return asset.toString();
}
