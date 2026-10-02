import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../lib/api';
import { useWebSocket } from '../../lib/ws';
import { Ionicons } from '@expo/vector-icons';

export default function SLAAlertsScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isConnected, lastMessage } = useWebSocket();

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'conversation:update' && lastMessage.payload?.slaBreach) {
      loadAlerts();
    }
  }, [lastMessage]);

  async function loadAlerts() {
    try {
      const data = await apiFetch('/conversations');
      // Filter for SLA breaches
      const breached = data.filter((c: any) => c.slaBreach);
      setConversations(breached);
    } catch (err) {
      console.warn("Failed to load alerts", err);
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const contactName = item.contact?.name || item.contact?.phoneNumber || 'Unknown';
    const lastMsgAt = new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity 
        style={styles.alertCard}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="warning" size={20} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>SLA Breach</Text>
          </View>
          <Text style={styles.cardTime}>{lastMsgAt}</Text>
        </View>
        <Text style={styles.cardBody}>
          <Text style={{ fontWeight: 'bold' }}>{contactName}</Text> has been waiting for more than 15 minutes.
        </Text>
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => router.push(`/chat/${item.id}`)}
        >
          <Text style={styles.actionBtnText}>Take over conversation</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#EF4444" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySub}>No active SLA breaches.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  alertCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  cardTime: {
    fontSize: 12,
    color: '#666',
  },
  cardBody: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 20,
  },
  actionBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#B91C1C',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
});
