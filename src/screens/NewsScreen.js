import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
  Share,
  Dimensions,
  PixelRatio,
  Platform,
  Alert
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemeContext } from '../context/ThemeContext';
import { fetchUDBNews } from '../services/newsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 360;

function normalize(size) {
  const newSize = size * scale;
  if (Platform.OS === 'android') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export default function NewsScreen() {
  const { theme, isDarkMode } = useContext(ThemeContext);

  const [allNews, setAllNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('0'); // '0' = todos
  const [selectedNews, setSelectedNews] = useState(null); // Para modal de detalle
  const [displayLimit, setDisplayLimit] = useState(25); // Paginación virtualizada para rendimiento

  const years = [
    { label: 'Todos', value: '0' },
    { label: '2026', value: '2026' },
    { label: '2025', value: '2025' },
    { label: '2024', value: '2024' },
    { label: '2023', value: '2023' },
  ];

  const loadNews = async (query = '', year = '0', isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await fetchUDBNews(query, year, '0');
      setAllNews(result.news || []);
      setIsFromCache(result.fromCache);
      setDisplayLimit(25);
    } catch (err) {
      console.error('Error al cargar noticias:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNews('', selectedYear);
  }, [selectedYear]);

  const handleSearchSubmit = () => {
    loadNews(searchQuery, selectedYear);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadNews('', selectedYear);
  };

  const handleOpenUrl = async (url) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Enlace no disponible', 'No se pudo abrir el navegador para esta dirección.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo abrir el enlace.');
    }
  };

  const handleShare = async (item) => {
    try {
      await Share.share({
        title: item.titulo,
        message: `${item.titulo}\n\nLéela en el Portal UDB: ${item.url}`,
        url: item.url,
      });
    } catch (error) {
      console.warn('Error al compartir:', error);
    }
  };

  // Filtrado local en caso de que el usuario escriba en tiempo real
  const filteredNews = useMemo(() => {
    if (!searchQuery.trim()) return allNews;
    const q = searchQuery.toLowerCase().trim();
    return allNews.filter(
      (n) =>
        n.titulo.toLowerCase().includes(q) ||
        n.descripcion.toLowerCase().includes(q) ||
        n.fecha.includes(q)
    );
  }, [allNews, searchQuery]);

  const paginatedData = useMemo(() => {
    return filteredNews.slice(0, displayLimit);
  }, [filteredNews, displayLimit]);

  const handleLoadMore = () => {
    if (displayLimit < filteredNews.length) {
      setDisplayLimit((prev) => prev + 25);
    }
  };

  const renderNewsItem = ({ item }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setSelectedNews(item)}
        style={[
          styles.newsCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Encabezado con insgnia institucional y fecha */}
        <View style={styles.cardMetaRow}>
          <View style={styles.badgeContainer}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>UDB Oficial</Text>
          </View>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={normalize(12)} color={theme.textSecondary} />
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>{item.fecha}</Text>
          </View>
        </View>

        {/* Imagen o miniatura */}
        {item.imagenThumb ? (
          <Image
            source={{ uri: item.imagenThumb }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2F6' }]}>
            <Ionicons name="newspaper-outline" size={normalize(36)} color="#2196F3" />
          </View>
        )}

        {/* Contenido */}
        <View style={styles.cardContent}>
          <Text
            style={[styles.cardTitle, { color: theme.textPrimary }]}
            numberOfLines={3}
          >
            {item.titulo}
          </Text>

          {/* Botones de acción */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={[styles.readButton, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}
              onPress={() => handleOpenUrl(item.url)}
            >
              <Text style={styles.readButtonText}>Ver en Portal</Text>
              <Ionicons name="arrow-forward" size={normalize(14)} color="#2563EB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { borderColor: theme.border }]}
              onPress={() => handleShare(item)}
            >
              <Ionicons name="share-social-outline" size={normalize(16)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Banner de conexión o caché */}
      {isFromCache && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={normalize(14)} color="#B45309" />
          <Text style={styles.offlineBannerText}>
            Mostrando noticias guardadas en el dispositivo (modo sin conexión).
          </Text>
        </View>
      )}

      {/* Barra de Búsqueda */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="search" size={normalize(18)} color={theme.textSecondary} />
          <TextInput
            placeholder="Buscar noticias o eventos UDB..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.textPrimary }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={normalize(18)} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros por Año */}
        <View style={styles.filterYearsRow}>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Año:</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={years}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const active = selectedYear === item.value;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedYear(item.value)}
                  style={[
                    styles.yearChip,
                    {
                      backgroundColor: active
                        ? '#2196F3'
                        : isDarkMode
                        ? '#1E293B'
                        : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.yearChipText,
                      { color: active ? '#FFFFFF' : theme.textPrimary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      {/* Conteo de Resultados */}
      <View style={styles.resultsCountBar}>
        <Text style={[styles.resultsCountText, { color: theme.textSecondary }]}>
          {filteredNews.length} {filteredNews.length === 1 ? 'noticia encontrada' : 'noticias institucionales'}
        </Text>
      </View>

      {/* Lista Principal de Noticias */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Conectando con el portal UDB...
          </Text>
        </View>
      ) : filteredNews.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="newspaper-outline" size={normalize(52)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            No se encontraron noticias
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Prueba buscando con otras palabras o selecciona otro año.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setSearchQuery('');
              setSelectedYear('0');
              loadNews('', '0', true);
            }}
          >
            <Text style={styles.retryButtonText}>Reiniciar Búsqueda</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={paginatedData}
          keyExtractor={(item, idx) => item.id || `news-${idx}`}
          renderItem={renderNewsItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadNews(searchQuery, selectedYear, true)}
              colors={['#2196F3']}
              tintColor="#2196F3"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      {/* Modal de Detalle Completo de la Noticia */}
      <Modal
        visible={!!selectedNews}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedNews(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            {/* Cabecera del modal */}
            <View style={styles.modalHeader}>
              <View style={styles.badgeContainer}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>Universidad Don Bosco</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedNews(null)}
                style={[styles.closeModalBtn, { backgroundColor: theme.background }]}
              >
                <Ionicons name="close" size={normalize(20)} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Imagen grande */}
            {selectedNews?.imagenFull || selectedNews?.imagenThumb ? (
              <Image
                source={{ uri: selectedNews.imagenFull || selectedNews.imagenThumb }}
                style={styles.modalImage}
                resizeMode="cover"
              />
            ) : null}

            {/* Fecha */}
            <View style={styles.modalDateRow}>
              <Ionicons name="calendar-outline" size={normalize(14)} color="#2196F3" />
              <Text style={styles.modalDateText}>
                Publicado: {selectedNews?.fecha || 'Reciente'}
              </Text>
            </View>

            {/* Título completo */}
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              {selectedNews?.titulo}
            </Text>

            {/* Botones de acción del modal */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalWebBtn, { backgroundColor: '#2196F3' }]}
                onPress={() => {
                  const url = selectedNews?.url;
                  setSelectedNews(null);
                  handleOpenUrl(url);
                }}
              >
                <Ionicons name="globe-outline" size={normalize(18)} color="#fff" />
                <Text style={styles.modalWebBtnText}>Leer en el Portal UDB</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalShareBtn, { borderColor: theme.border }]}
                onPress={() => {
                  if (selectedNews) handleShare(selectedNews);
                }}
              >
                <Ionicons name="share-social-outline" size={normalize(18)} color={theme.textPrimary} />
                <Text style={[styles.modalShareBtnText, { color: theme.textPrimary }]}>Compartir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: normalize(6),
    paddingHorizontal: normalize(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(6),
  },
  offlineBannerText: {
    fontSize: normalize(11),
    color: '#92400E',
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: normalize(14),
    paddingTop: normalize(12),
    paddingBottom: normalize(6),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: normalize(10),
    borderWidth: 1,
    paddingHorizontal: normalize(12),
    height: normalize(44),
  },
  searchInput: {
    flex: 1,
    marginLeft: normalize(8),
    fontSize: normalize(13),
  },
  clearSearchBtn: {
    padding: normalize(4),
  },
  filterYearsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: normalize(10),
  },
  filterLabel: {
    fontSize: normalize(12),
    fontWeight: '600',
    marginRight: normalize(8),
  },
  yearChip: {
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(5),
    borderRadius: normalize(16),
    marginRight: normalize(8),
  },
  yearChipText: {
    fontSize: normalize(11),
    fontWeight: '600',
  },
  resultsCountBar: {
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(6),
  },
  resultsCountText: {
    fontSize: normalize(11),
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: normalize(14),
    paddingBottom: normalize(24),
  },
  newsCard: {
    borderRadius: normalize(14),
    borderWidth: 1,
    marginBottom: normalize(14),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: normalize(14),
    paddingTop: normalize(10),
    paddingBottom: normalize(8),
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(3),
    borderRadius: normalize(12),
  },
  badgeDot: {
    width: normalize(6),
    height: normalize(6),
    borderRadius: normalize(3),
    backgroundColor: '#2563EB',
    marginRight: normalize(5),
  },
  badgeText: {
    color: '#1D4ED8',
    fontSize: normalize(10),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(4),
  },
  dateText: {
    fontSize: normalize(11),
    fontWeight: '500',
  },
  cardImage: {
    width: '100%',
    height: normalize(150),
  },
  imagePlaceholder: {
    width: '100%',
    height: normalize(120),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: normalize(14),
  },
  cardTitle: {
    fontSize: normalize(14),
    fontWeight: '700',
    lineHeight: normalize(20),
    marginBottom: normalize(12),
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(6),
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(7),
    borderRadius: normalize(8),
  },
  readButtonText: {
    fontSize: normalize(12),
    fontWeight: '700',
    color: '#2563EB',
  },
  iconButton: {
    borderWidth: 1,
    borderRadius: normalize(8),
    padding: normalize(7),
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: normalize(24),
  },
  loadingText: {
    marginTop: normalize(12),
    fontSize: normalize(13),
  },
  emptyTitle: {
    fontSize: normalize(16),
    fontWeight: '700',
    marginTop: normalize(12),
  },
  emptySubtitle: {
    fontSize: normalize(12),
    textAlign: 'center',
    marginTop: normalize(6),
    marginBottom: normalize(16),
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(9),
    borderRadius: normalize(8),
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: normalize(12),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: normalize(20),
    borderTopRightRadius: normalize(20),
    padding: normalize(18),
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  closeModalBtn: {
    padding: normalize(6),
    borderRadius: normalize(20),
  },
  modalImage: {
    width: '100%',
    height: normalize(180),
    borderRadius: normalize(12),
    marginBottom: normalize(12),
  },
  modalDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(6),
    marginBottom: normalize(8),
  },
  modalDateText: {
    fontSize: normalize(12),
    color: '#2196F3',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: normalize(16),
    fontWeight: '800',
    lineHeight: normalize(22),
    marginBottom: normalize(18),
  },
  modalActions: {
    gap: normalize(10),
  },
  modalWebBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: normalize(8),
    paddingVertical: normalize(12),
    borderRadius: normalize(10),
  },
  modalWebBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: normalize(14),
  },
  modalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: normalize(8),
    paddingVertical: normalize(10),
    borderRadius: normalize(10),
    borderWidth: 1,
  },
  modalShareBtnText: {
    fontWeight: '600',
    fontSize: normalize(13),
  },
});
