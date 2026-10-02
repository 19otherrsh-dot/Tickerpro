import { useLocalSearchParams, Stack } from 'expo-router';
import { StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useWebSocket } from '../../lib/ws';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactName, setContactName] = useState('Loading...');
  const [inputText, setInputText] = useState('');
  const [isInternalMode, setIsInternalMode] = useState(false);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    loadChat();
  }, [id]);

  useEffect(() => {
    if (lastMessage?.type === 'message:new' && lastMessage.payload?.conversationId === id) {
      setMessages(prev => [lastMessage.payload.message, ...prev]);
    }
  }, [lastMessage]);

  async function loadChat() {
    try {
      const data = await apiFetch(`/conversations/${id}`);
      setContactName(data.contact?.name || data.contact?.phoneNumber || 'Unknown');
      
      const allMessages = [...(data.messages || []), ...(data.internalNotes || [])];
      allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setMessages(allMessages);
    } catch (err) {
      console.warn("Failed to load chat", err);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');

    try {
      if (isInternalMode) {
        // Send Internal Note
        const note = await apiFetch(`/conversations/${id}/notes`, {
          method: 'POST',
          body: JSON.stringify({ content: text })
        });
        setMessages(prev => [note, ...prev]);
      } else {
        // Send WhatsApp Message
        const msg = await apiFetch(`/messages`, {
          method: 'POST',
          body: JSON.stringify({
            conversationId: id,
            type: 'TEXT',
            content: { text }
          })
        });
        setMessages(prev => [msg, ...prev]);
      }
    } catch (err) {
      console.warn("Failed to send message", err);
      // rollback UI or show error in production
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const isNote = 'conversationId' in item && !('direction' in item); // Notes don't have direction
    const isOutbound = item.direction === 'OUTBOUND';
    const isSystem = item.direction === 'SYSTEM';

    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemText}>{item.content?.text || 'System Event'}</Text>
        </View>
      );
    }

    if (isNote) {
      return (
        <View style={[styles.messageBubble, styles.noteBubble]}>
          <Text style={styles.noteText}>{item.content}</Text>
          <Text style={styles.messageTime}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageBubble, 
        isOutbound ? styles.outboundBubble : styles.inboundBubble
      ]}>
        <Text style={isOutbound ? styles.outboundText : styles.inboundText}>
          {item.content?.text || '[Media Attachment]'}
        </Text>
        <Text style={[styles.messageTime, isOutbound ? { color: 'rgba(255,255,255,0.7)' } : {}]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: contactName }} />
      
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        inverted
        contentContainerStyle={{ padding: 16 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={[styles.composer, isInternalMode && styles.composerInternal]}>
          <TouchableOpacity 
            style={styles.toggleBtn}
            onPress={() => setIsInternalMode(!isInternalMode)}
          >
            <Ionicons name={isInternalMode ? "lock-closed" : "chatbubble"} size={20} color={isInternalMode ? "#F59E0B" : "#10B981"} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder={isInternalMode ? "Add an internal note..." : "Type a message..."}
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 8,
  },
  systemText: {
    fontSize: 12,
    color: '#666',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  inboundBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
  },
  outboundBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  noteBubble: {
    alignSelf: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    width: '90%',
  },
  inboundText: {
    color: '#111827',
    fontSize: 16,
  },
  outboundText: {
    color: 'white',
    fontSize: 16,
  },
  noteText: {
    color: '#92400E',
    fontSize: 14,
    fontStyle: 'italic',
  },
  messageTime: {
    fontSize: 10,
    color: '#9CA3AF',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  composer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'white',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  composerInternal: {
    backgroundColor: '#FEF3C7',
    borderTopColor: '#FCD34D',
  },
  toggleBtn: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    marginHorizontal: 8,
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: '#10B981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
