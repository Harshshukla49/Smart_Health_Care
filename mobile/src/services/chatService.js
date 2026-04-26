import { apiClient } from './apiClient';

function toText(value, fallback = '') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unwrapEnvelope(response) {
  const payload = response?.data || {};
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload;
}

export function normalizeChatMessage(row = {}) {
  return {
    id: toText(row.id),
    threadId: toText(row.threadId),
    senderRole: toText(row.senderRole),
    senderId: toText(row.senderId),
    senderName: toText(row.senderName),
    receiverId: toText(row.receiverId),
    text: toText(row.text),
    createdAt: toText(row.createdAt),
    readAt: toText(row.readAt),
    status: toText(row.status),
  };
}

export async function getChatThreadContext({ patientId } = {}) {
  const query = patientId ? `?patientId=${encodeURIComponent(toText(patientId))}` : '';
  const response = await apiClient.get(`/chat/thread-context${query}`);
  return unwrapEnvelope(response) || null;
}

export async function getChatMessages(threadId, { limit = 60, before = '' } = {}) {
  const params = new URLSearchParams();
  if (limit) {
    params.set('limit', String(limit));
  }
  if (before) {
    params.set('before', String(before));
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/chat/threads/${encodeURIComponent(toText(threadId))}/messages${query}`);
  const payload = unwrapEnvelope(response);
  const rows = Array.isArray(payload?.messages) ? payload.messages : [];
  return rows.map(normalizeChatMessage);
}

export async function sendChatMessage({ threadId, text, receiverId = '' }) {
  const response = await apiClient.post(`/chat/threads/${encodeURIComponent(toText(threadId))}/messages`, {
    text: toText(text),
    receiverId: toText(receiverId),
  });

  const payload = unwrapEnvelope(response);
  return normalizeChatMessage(payload?.message || {});
}

export async function markChatMessageRead({ messageId, threadId }) {
  const response = await apiClient.patch(`/chat/messages/${encodeURIComponent(toText(messageId))}/read`, {
    threadId: toText(threadId),
  });

  const payload = unwrapEnvelope(response);
  return normalizeChatMessage(payload?.message || {});
}

export function toCallSummary(payload = {}) {
  return {
    requestId: toText(payload.requestId),
    threadId: toText(payload.threadId),
    fromRole: toText(payload.fromRole),
    fromId: toText(payload.fromId),
    fromName: toText(payload.fromName),
    createdAt: toText(payload.createdAt || payload.acceptedAt || payload.rejectedAt || payload.endedAt),
    durationSeconds: toNumber(payload.durationSeconds),
  };
}
