import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../lib/api';
import { useWebSocket } from '../../lib/ws';

export default function InboxScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isConnected, lastMessage } = useWebSocket();

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'message:new' || lastMessage?.type === 'conversation:new') {
      // Very basic implementation: just reload everything on new message
      // A better approach would be to prepend/update the specific row in state
      loadConversations();
    }
  }, [lastMessage]);

  async function loadConversations() {
    try {
      const data = await apiFetch('/conversations');
      setConversations(data);
    } catch (err) {
      console.warn("Failed to load conversations", err);
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const contactName = item.contact?.name || item.contact?.phoneNumber || 'Unknown';
    const lastMsgContent = item.messages?.[0]?.content?.text || 'No messages yet';
    const isSlaBreach = item.slaBreach;
    
    // Check if the latest message was inbound (unread from business perspective)
    const isUnread = item.messages?.[0]?.direction === 'INBOUND' && item.messages?.[0]?.status !== 'READ';

    return (
      <TouchableOpacity 
        style={styles.conversationItem}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={[styles.avatar, isSlaBreach && { backgroundColor: '#EF4444' }]}>
          <Text style={styles.avatarText}>{contactName.substring(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.convDetails}>
          <View style={styles.convHeader}>
            <Text style={[styles.convName, isUnread && { fontWeight: 'bold' }]}>{contactName}</Text>
            <Text style={styles.convTime}>
              {new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.convFooter}>
            <Text style={[styles.convPreview, isUnread && { fontWeight: 'bold', color: '#000' }]} numberOfLines={1}>
              {lastMsgContent}
            </Text>
            {isSlaBreach && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>SLA</Text>
              </View>
            )}
            {isUnread && !isSlaBreach && (
              <View style={styles.dot} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline - Reconnecting...</Text>
        </View>
      )}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>No open conversations.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineBanner: {
    backgroundColor: '#F59E0B',
    padding: 8,
    alignItems: 'center',
  },
  offlineText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  convDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  convName: {
    fontSize: 16,
  },
  convTime: {
    fontSize: 12,
    color: '#666',
  },
  convFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convPreview: {
    flex: 1,
    color: '#666',
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  }
});
