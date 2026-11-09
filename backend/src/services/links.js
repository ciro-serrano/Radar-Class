// Lee links que carga el docente como material de clase (páginas web o PDFs online).
// Sin dependencias extra. Incluye defensas SSRF: un link no puede apuntar a la red interna.
import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_HTML_BYTES = 2 * 1024 * 1024; // páginas: 2 MB
const MAX_PDF_BYTES = 10 * 1024 * 1024; // PDFs online: 10 MB
const MAX_REDIRECTS = 3;
const MAX_CHARS = 30_000; // texto que se le pasa a la IA por link
const TIMEOUT_MS = 12_000;

// ---------- Direcciones privadas / internas ----------
function ipv4Privada(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local (incluye metadata de la nube)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function esIpPrivada(ip) {
  if (net.isIPv4(ip)) return ipv4Privada(ip);
  if (!net.isIPv6(ip)) return true; // si no se puede interpretar, mejor bloquear
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  const mapeada = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeada) return ipv4Privada(mapeada[1]);
  const mapeadaHex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapeadaHex) {
    const hi = parseInt(mapeadaHex[1], 16), lo = parseInt(mapeadaHex[2], 16);
    return ipv4Privada(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return (
    v.startsWith('fc') || v.startsWith('fd') || // únicas locales
    /^fe[89ab]/.test(v) || // link-local
    v.startsWith('ff') || // multicast
    v.startsWith('64:ff9b:') || // NAT64
    v.startsWith('2001:db8')
  );
}

function parsear(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new Error('El link no es válido'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Solo se aceptan links http o https');
  if (u.username || u.password) throw new Error('El link no puede incluir usuario ni contraseña');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Solo se aceptan links a los puertos web estándar');
  return u;
}

async function validarDestino(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || /\.(localhost|local|internal|lan)$/.test(host)) {
    throw new Error('Ese link apunta a una dirección interna y no se puede leer');
  }
  let ips;
  if (net.isIP(host)) ips = [host];
  else {
    try { ips = (await dns.lookup(host, { all: true })).map((a) => a.address); }
    catch { throw new Error('No se pudo encontrar ese sitio'); }
  }
  if (!ips.length || ips.some(esIpPrivada)) throw new Error('Ese link apunta a una dirección interna y no se puede leer');
}

// ---------- HTML -> texto ----------
function quitarBloques(html, tags) {
  let out = html;
  for (const tag of tags) {
    const lower = out.toLowerCase();
    const abre = `<${tag}`;
    const cierra = `</${tag}>`;
    let desde = 0, res = '';
    for (;;) {
      // Buscar la etiqueta EXACTA (que <head no coincida con <header, ni <nav con <navigation)
      let ini = lower.indexOf(abre, desde);
      while (ini !== -1 && !/[\s>/]/.test(lower[ini + abre.length] || '>')) ini = lower.indexOf(abre, ini + 1);
      if (ini === -1) { res += out.slice(desde); break; }
      res += out.slice(desde, ini);
      const fin = lower.indexOf(cierra, ini);
      if (fin === -1) {
        // Sin cierre: se descarta solo la etiqueta de apertura, no el resto de la página
        const finApertura = lower.indexOf('>', ini);
        desde = finApertura === -1 ? out.length : finApertura + 1;
        continue;
      }
      desde = fin + cierra.length;
    }
    out = res;
  }
  return out;
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü' };
function decodificar(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, c) => {
    if (c[0] === '#') {
      const n = c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' ';
    }
    return ENTIDADES[c] ?? m;
  });
}

export function htmlATexto(html) {
  const titulo = decodificar((html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim());
  let t = quitarBloques(html.replace(/<!--[\s\S]*?-->/g, ' '), ['script', 'style', 'noscript', 'svg', 'template', 'iframe', 'head', 'nav', 'footer', 'form']);
  t = t.replace(/<\/?(p|div|br|li|ul|ol|h[1-6]|tr|table|section|article|header|blockquote|pre)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  t = decodificar(t).replace(/[ \t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { titulo, texto: t };
}

// ---------- Descarga con tope de tamaño ----------
async function leerCuerpo(res, max) {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) { await reader.cancel(); throw new Error('El contenido de ese link es demasiado grande'); }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

// Devuelve { tipo:'pdf', nombre, base64 } o { tipo:'texto', url, titulo, texto }. Lanza Error con mensaje para el docente.
export async function leerLink(raw) {
  let u = parsear(raw);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let res;
  for (let salto = 0; ; salto++) {
    await validarDestino(u);
    try {
      res = await fetch(u, {
        redirect: 'manual',
        signal,
        headers: { 'User-Agent': 'RadarClassBot/1.0 (material de clase)', Accept: 'text/html,text/plain,application/pdf;q=0.9,*/*;q=0.1' },
      });
    } catch (e) {
      if (e.name === 'TimeoutError') throw new Error('El sitio tardó demasiado en responder');
      throw new Error('No se pudo abrir el link');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (salto >= MAX_REDIRECTS) throw new Error('El link redirige demasiadas veces');
      u = parsear(new URL(res.headers.get('location'), u).href);
      continue;
    }
    break;
  }
  if (res.status === 401 || res.status === 403) throw new Error('Este sitio bloquea la lectura automática (aunque en tu navegador se vea normal). Guardá la página como PDF (Ctrl+P) y subila como PDF');
  if (!res.ok) throw new Error(`El sitio respondió ${res.status}`);

  const tipoMime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const declarado = Number(res.headers.get('content-length') || 0);

  if (tipoMime === 'application/pdf' || /\.pdf$/i.test(u.pathname)) {
    if (declarado > MAX_PDF_BYTES) throw new Error('El PDF de ese link es demasiado grande (máximo 10 MB)');
    const buf = await leerCuerpo(res, MAX_PDF_BYTES);
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Ese link no devolvió un PDF válido');
    const nombre = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || 'documento.pdf');
    return { tipo: 'pdf', nombre: nombre.slice(0, 120), base64: buf.toString('base64'), url: u.href };
  }
  if (!['text/html', 'application/xhtml+xml', 'text/plain', ''].includes(tipoMime)) {
    throw new Error('Ese link no es una página de texto ni un PDF');
  }
  const buf = await leerCuerpo(res, MAX_HTML_BYTES);
  const charset = (res.headers.get('content-type') || '').match(/charset=([\w-]+)/i)?.[1] || 'utf-8';
  let html;
  try { html = new TextDecoder(charset).decode(buf); } catch { html = buf.toString('utf8'); }
  const { titulo, texto } = tipoMime === 'text/plain' ? { titulo: '', texto: html.trim() } : htmlATexto(html);
  if (texto.length < 200) {
    throw new Error('No pude leer contenido en ese link (puede requerir iniciar sesión o cargarse con JavaScript). Probá con otro o subí el PDF');
  }
  return { tipo: 'texto', url: u.href, titulo: titulo.slice(0, 150), texto: texto.slice(0, MAX_CHARS) };
}
