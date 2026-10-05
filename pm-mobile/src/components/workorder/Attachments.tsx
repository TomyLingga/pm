import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/lib/api';
import { absoluteUrl } from '@/lib/config';
import { downloadAndShare } from '@/lib/download';
import { formatBytes, formatDateTime } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import type { Attachment, AttachmentCollection } from '@/lib/types';

const COLLECTION_LABELS: Record<AttachmentCollection, string> = {
  photo_before: 'Foto Sebelum',
  photo_after: 'Foto Sesudah',
  document: 'Dokumen',
};

const isImage = (a: Attachment) => a.mime_type?.startsWith('image/');

interface AttachmentsProps {
  attachments: Attachment[];
  token: string | null;
  /** Returns true if the current user may delete this attachment. */
  canDelete?: (a: Attachment) => boolean;
  onDelete?: (a: Attachment) => void;
}

/** Thumbnails grouped by collection; images open full screen, other files are downloaded & shared. */
export function Attachments({ attachments, token, canDelete, onDelete }: AttachmentsProps) {
  const insets = useSafeAreaInsets();
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const groups = (Object.keys(COLLECTION_LABELS) as AttachmentCollection[])
    .map((c) => ({ collection: c, items: attachments.filter((a) => a.collection === c) }))
    .filter((g) => g.items.length > 0);

  const openFile = async (a: Attachment) => {
    setDownloadingId(a.id);
    try {
      await downloadAndShare(absoluteUrl(a.url), a.original_name || `lampiran-${a.id}`, a.mime_type);
    } catch (e) {
      Alert.alert('Gagal membuka file', errorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const onLongPress = (a: Attachment) => {
    if (!canDelete?.(a) || !onDelete) return;
    Alert.alert('Hapus lampiran?', a.original_name, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => onDelete(a) },
    ]);
  };

  if (groups.length === 0) return <Text style={styles.muted}>Belum ada lampiran.</Text>;

  return (
    <View style={{ gap: 14 }}>
      {groups.map((g) => (
        <View key={g.collection} style={{ gap: 8 }}>
          <Text style={styles.groupTitle}>
            {COLLECTION_LABELS[g.collection]} ({g.items.length})
          </Text>
          <View style={styles.grid}>
            {g.items.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => (isImage(a) ? setViewing(a) : void openFile(a))}
                onLongPress={() => onLongPress(a)}
                style={styles.thumbWrap}
                accessibilityRole="imagebutton"
                accessibilityLabel={a.original_name}
              >
                {isImage(a) ? (
                  <Image source={{ uri: absoluteUrl(a.url), headers }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.fileThumb]}>
                    {downloadingId === a.id ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Ionicons name="document-text-outline" size={34} color={colors.primary} />
                    )}
                    <Text style={styles.fileName} numberOfLines={2}>
                      {a.original_name}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {canDelete && <Text style={styles.hint}>Tekan lama lampiran milik Anda untuk menghapus.</Text>}

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && (
            <>
              <Image
                source={{ uri: absoluteUrl(viewing.url), headers }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
              <View style={[styles.viewerBar, { paddingTop: insets.top + 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viewerTitle} numberOfLines={1}>
                    {viewing.original_name}
                  </Text>
                  <Text style={styles.viewerSub}>
                    {[viewing.uploaded_by?.name, formatDateTime(viewing.created_at), formatBytes(viewing.size_bytes)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void openFile(viewing)}
                  style={styles.viewerBtn}
                  accessibilityLabel="Bagikan foto"
                >
                  {downloadingId === viewing.id ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Ionicons name="share-social-outline" size={26} color={colors.white} />
                  )}
                </Pressable>
                <Pressable onPress={() => setViewing(null)} style={styles.viewerBtn} accessibilityLabel="Tutup">
                  <Ionicons name="close" size={30} color={colors.white} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 15, color: colors.textSubtle },
  hint: { fontSize: 13, color: colors.textSubtle },
  groupTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { borderRadius: radius.md, overflow: 'hidden' },
  thumb: { width: 100, height: 100, backgroundColor: '#E2E8F0' },
  fileThumb: { alignItems: 'center', justifyContent: 'center', padding: 6, gap: 4 },
  fileName: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerImage: { flex: 1, width: '100%' },
  viewerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  viewerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  viewerSub: { color: '#CBD5E1', fontSize: 13 },
  viewerBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
