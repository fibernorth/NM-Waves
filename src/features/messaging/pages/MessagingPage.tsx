import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Paper,
  CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatIcon from '@mui/icons-material/Chat';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/lib/api/conversations';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isCoach as checkIsCoach } from '@/lib/auth/roles';
import type { Conversation, Message } from '@/types/models';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';

const formatMessageDate = (date: Date): string => {
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a');
  return format(date, 'MMM d, h:mm a');
};

const MessagingPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isCoach = checkIsCoach(user);

  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const { data: conversations = [], isLoading: conversationsLoading } =
    useQuery({
      queryKey: ['conversations'],
      queryFn: () => conversationsApi.getAll(),
    });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const teamsWithoutConversation = useMemo(() => {
    const conversationTeamIds = new Set(
      conversations
        .filter((c) => c.type === 'team' && c.teamId)
        .map((c) => c.teamId)
    );
    return teams.filter((t) => !conversationTeamIds.has(t.id));
  }, [conversations, teams]);

  const createConversationMutation = useMutation({
    mutationFn: (data: {
      teamId: string;
      teamName: string;
    }) =>
      conversationsApi.create({
        type: 'team',
        teamId: data.teamId,
        teamName: data.teamName,
        participantIds: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation created');
    },
    onError: () => {
      toast.error('Failed to create conversation');
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { conversationId: string; text: string }) =>
      conversationsApi.sendMessage(data.conversationId, {
        senderId: user?.uid || '',
        senderName: user?.displayName || '',
        text: data.text,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => {
      toast.error('Failed to send message');
    },
  });

  // Subscribe to messages when a conversation is selected
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);

    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const unsubscribe = conversationsApi.onMessagesSnapshot(
      selectedConversation.id,
      (newMessages) => {
        setMessages(newMessages);
        setMessagesLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, [selectedConversation]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = messageText.trim();
    if (!trimmed || !selectedConversation) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      text: trimmed,
    });
    setMessageText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateConversation = (teamId: string, teamName: string) => {
    createConversationMutation.mutate({ teamId, teamName });
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <ChatIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4">Team Messaging</Typography>
      </Box>

      <Paper
        sx={{
          display: 'flex',
          height: 'calc(100vh - 200px)',
          minHeight: 500,
          overflow: 'hidden',
        }}
      >
        {/* Left panel: Conversations list */}
        <Box
          sx={{
            width: 300,
            minWidth: 300,
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Conversations
            </Typography>
          </Box>

          <Box sx={{ overflow: 'auto', flex: 1 }}>
            {conversationsLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  mt: 4,
                }}
              >
                <CircularProgress size={24} />
              </Box>
            ) : conversations.length === 0 &&
              teamsWithoutConversation.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  align="center"
                >
                  No conversations yet. Add teams to get started.
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {conversations.map((conversation) => (
                  <ListItemButton
                    key={conversation.id}
                    selected={
                      selectedConversation?.id === conversation.id
                    }
                    onClick={() =>
                      handleSelectConversation(conversation)
                    }
                    sx={{ px: 2 }}
                  >
                    <ListItemText
                      primary={
                        conversation.teamName ||
                        conversation.teamId ||
                        'Direct Message'
                      }
                      secondary={
                        conversation.lastMessage
                          ? conversation.lastMessage.length > 40
                            ? conversation.lastMessage.substring(
                                0,
                                40
                              ) + '...'
                            : conversation.lastMessage
                          : 'No messages yet'
                      }
                      primaryTypographyProps={{
                        fontWeight:
                          selectedConversation?.id ===
                          conversation.id
                            ? 'bold'
                            : 'normal',
                        noWrap: true,
                      }}
                      secondaryTypographyProps={{
                        noWrap: true,
                        fontSize: '0.8rem',
                      }}
                    />
                  </ListItemButton>
                ))}

                {/* Show teams that don't have conversations yet */}
                {isCoach && teamsWithoutConversation.length > 0 && (
                  <>
                    <Divider />
                    <Box sx={{ px: 2, py: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        Create conversation for:
                      </Typography>
                    </Box>
                    {teamsWithoutConversation.map((team) => (
                      <ListItemButton
                        key={team.id}
                        onClick={() =>
                          handleCreateConversation(
                            team.id,
                            team.name
                          )
                        }
                        sx={{ px: 2, opacity: 0.7 }}
                      >
                        <ListItemText
                          primary={team.name}
                          secondary="Click to create"
                          primaryTypographyProps={{
                            fontStyle: 'italic',
                            noWrap: true,
                          }}
                          secondaryTypographyProps={{
                            fontSize: '0.75rem',
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </>
                )}
              </List>
            )}
          </Box>
        </Box>

        {/* Right panel: Messages */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {!selectedConversation ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Select a conversation to start messaging
              </Typography>
            </Box>
          ) : (
            <>
              {/* Conversation header */}
              <Box
                sx={{
                  p: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle1" fontWeight="bold">
                  {selectedConversation.teamName ||
                    selectedConversation.teamId ||
                    'Conversation'}
                </Typography>
              </Box>

              {/* Messages area */}
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {messagesLoading ? (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      mt: 4,
                    }}
                  >
                    <CircularProgress size={24} />
                  </Box>
                ) : messages.length === 0 ? (
                  <Box
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      No messages yet. Send the first message!
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message) => {
                    const isOwnMessage =
                      message.senderId === user?.uid;
                    return (
                      <Box
                        key={message.id}
                        sx={{
                          display: 'flex',
                          justifyContent: isOwnMessage
                            ? 'flex-end'
                            : 'flex-start',
                        }}
                      >
                        <Box
                          sx={{
                            maxWidth: '70%',
                            bgcolor: isOwnMessage
                              ? 'primary.main'
                              : 'grey.100',
                            color: isOwnMessage
                              ? 'primary.contrastText'
                              : 'text.primary',
                            borderRadius: 2,
                            px: 2,
                            py: 1,
                          }}
                        >
                          {!isOwnMessage && (
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 'bold',
                                display: 'block',
                                mb: 0.5,
                              }}
                            >
                              {message.senderName ||
                                'Unknown'}
                            </Typography>
                          )}
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: 'pre-wrap' }}
                          >
                            {message.text}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              mt: 0.5,
                              opacity: 0.7,
                              textAlign: 'right',
                            }}
                          >
                            {formatMessageDate(message.sentAt)}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Message input */}
              <Box
                sx={{
                  p: 2,
                  borderTop: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-end',
                }}
              >
                <TextField
                  fullWidth
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  multiline
                  maxRows={4}
                  size="small"
                />
                <IconButton
                  color="primary"
                  onClick={handleSend}
                  disabled={
                    !messageText.trim() ||
                    sendMessageMutation.isPending
                  }
                >
                  <SendIcon />
                </IconButton>
              </Box>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default MessagingPage;
