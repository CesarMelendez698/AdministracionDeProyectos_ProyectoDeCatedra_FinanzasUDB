import AsyncStorage from '@react-native-async-storage/async-storage';

const UDB_SEARCH_URL_PRIMARY = 'https://www.udb.edu.sv/udb/index.php/noticias/buscar';
const UDB_SEARCH_URL_SECONDARY = 'https://www.udb.edu.sv/udb/noticias/buscar';
const CACHE_KEY = '@udb_cached_news';

/**
 * Normaliza y limpia los elementos de noticia devueltos por la API de la UDB
 */
function normalizeNewsItem(item, index) {
  const receptor = item.Receptor || 'noticia';
  const enlace = item.Enlace || '';
  const fullUrl = `https://www.udb.edu.sv/udb/${receptor}/${enlace}`;
  
  return {
    id: item.Enlace || `udb-news-${index}-${Date.now()}`,
    titulo: (item.Nombre || item.Descripcion || 'Noticia Institucional UDB').trim(),
    descripcion: (item.Descripcion || item.Nombre || '').trim(),
    resumen: (item.Resultado || '').trim(),
    fecha: item.Resultado && item.Resultado.match(/^\d{2}-\d{2}-\d{4}$/) ? item.Resultado : 'Reciente',
    imagenThumb: item.Noticia || null,
    imagenFull: item.New_full || item.Noticia || null,
    url: fullUrl,
    receptor: receptor,
    enlace: enlace,
  };
}

/**
 * Datos semilla de alta fidelidad si el dispositivo no tiene internet en su primera apertura
 */
const SEED_FALLBACK_NEWS = [
  {
    id: 'seed-1',
    titulo: 'Observatorio Micro Macro de la UDB recibe el primer Campamento Aeroespacial “Frontera Marte”',
    descripcion: 'Observatorio Micro Macro de la UDB recibe el primer Campamento Aeroespacial “Frontera Marte”',
    resumen: '02-10-2026',
    fecha: '02-10-2026',
    imagenThumb: 'https://www.udb.edu.sv/udb_files/recursos_noticias/2530/thumb.jpg',
    imagenFull: 'https://www.udb.edu.sv/udb_files/recursos_noticias/2530/facebook.jpg',
    url: 'https://www.udb.edu.sv/udb/noticia/observatorio-micro-macro-de-la-udb-recibe-el-primer-campamento-aeroespacial--frontera-marte-',
  },
  {
    id: 'seed-2',
    titulo: 'Fotociencia 2026: una mirada a la ciencia desde la creatividad',
    descripcion: 'Fotociencia 2026: una mirada a la ciencia desde la creatividad',
    resumen: '01-10-2026',
    fecha: '01-10-2026',
    imagenThumb: 'https://www.udb.edu.sv/udb_files/recursos_noticias/2529/thumb.jpg',
    imagenFull: 'https://www.udb.edu.sv/udb_files/recursos_noticias/2529/facebook.jpg',
    url: 'https://www.udb.edu.sv/udb/noticia/fotociencia-2026--una-mirada-a-la-ciencia-desde-la-creatividad',
  },
  {
    id: 'seed-3',
    titulo: 'Inscripción de Asignaturas y Horarios Ciclo 01-2026',
    descripcion: 'Proceso de asesoría académica y matrícula habilitado en el Portal Web UDB.',
    resumen: 'Comunidad Universitaria',
    fecha: 'Institucional',
    imagenThumb: 'https://www.udb.edu.sv/udb/public/img/recursos/udb_texturas_sitio_web.svg',
    imagenFull: null,
    url: 'https://www.udb.edu.sv/udb/noticias',
  }
];

/**
 * Consulta la API de noticias de la Universidad Don Bosco
 * @param {string} query Texto a buscar (opcional)
 * @param {string|number} year Año específico o '0' para todos
 * @param {string|number} month Mes específico o '0' para todos
 * @returns {Promise<{ news: Array, fromCache: boolean, total: number }>}
 */
export async function fetchUDBNews(query = '', year = '0', month = '0') {
  const formData = new URLSearchParams();
  formData.append('frm-search-new', query || '');
  formData.append('frm-search-year', String(year || '0'));
  formData.append('frm-search-month', String(month || '0'));

  const endpoints = [UDB_SEARCH_URL_PRIMARY, UDB_SEARCH_URL_SECONDARY];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
        },
        body: formData.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawData = await response.json();

      if (Array.isArray(rawData)) {
        const normalized = rawData.map(normalizeNewsItem);

        // Guardamos en caché las noticias generales (cuando la búsqueda no tiene filtros estrechos)
        if (!query && (year === '0' || !year) && (month === '0' || !month)) {
          try {
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(normalized.slice(0, 100)));
          } catch (cacheErr) {
            console.warn('Error guardando caché de noticias:', cacheErr);
          }
        }

        return {
          news: normalized,
          fromCache: false,
          total: normalized.length,
        };
      }
    } catch (err) {
      lastError = err;
      // Intenta el siguiente endpoint si el actual falló
    }
  }

  console.warn('Fallo de conexión con UDB News, intentando cargar caché local:', lastError);

  // Fallback a caché local persistente
  try {
    const cachedString = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedString) {
      const cached = JSON.parse(cachedString);
      if (Array.isArray(cached) && cached.length > 0) {
        // Filtrar localmente si el usuario buscó algo
        const filtered = query
          ? cached.filter(item => item.titulo.toLowerCase().includes(query.toLowerCase()))
          : cached;
        return {
          news: filtered,
          fromCache: true,
          total: filtered.length,
        };
      }
    }
  } catch (cacheReadErr) {
    console.warn('Error leyendo caché local:', cacheReadErr);
  }

  // Último recurso: semillas integradas
  return {
    news: SEED_FALLBACK_NEWS,
    fromCache: true,
    total: SEED_FALLBACK_NEWS.length,
  };
}
