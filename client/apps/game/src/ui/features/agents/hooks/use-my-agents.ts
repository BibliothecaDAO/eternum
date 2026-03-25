import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CompleteAgentSetupRequest,
  DisableAgentAutonomyRequest,
  EnableAgentAutonomyRequest,
  MyAgentDetail,
  MyAgentsResponse,
  SetSteeringJobRequest,
} from "@bibliothecadao/types";

import {
  buildMyAgentEventsUrl,
  completeMyAgentSetup,
  disableMyAgentAutonomy,
  enableMyAgentAutonomy,
  fetchMyAgentDetail,
  fetchMyAgentHistory,
  fetchMyAgentMessages,
  fetchMyAgents,
  launchMyAgent,
  sendMyAgentMessage,
  setMyAgentSteering,
  updateMyAgent,
} from "../api/client";

const AGENTS_QUERY_KEY = ["my-agents"];

export const useMyAgentsQuery = (playerId: string | null) =>
  useQuery<MyAgentsResponse>({
    queryKey: [...AGENTS_QUERY_KEY, playerId],
    queryFn: () => fetchMyAgents(playerId!),
    enabled: Boolean(playerId),
  });

export const useMyAgentDetailQuery = (playerId: string | null, agentId: string | null) =>
  useQuery<MyAgentDetail>({
    queryKey: [...AGENTS_QUERY_KEY, "detail", playerId, agentId],
    queryFn: () => fetchMyAgentDetail(playerId!, agentId!),
    enabled: Boolean(playerId && agentId),
  });

export const useMyAgentMessagesQuery = (playerId: string | null, agentId: string | null) =>
  useQuery({
    queryKey: [...AGENTS_QUERY_KEY, "messages", playerId, agentId],
    queryFn: () => fetchMyAgentMessages(playerId!, agentId!),
    enabled: Boolean(playerId && agentId),
  });

export const useMyAgentHistoryQuery = (playerId: string | null, agentId: string | null) =>
  useQuery({
    queryKey: [...AGENTS_QUERY_KEY, "history", playerId, agentId],
    queryFn: () => fetchMyAgentHistory(playerId!, agentId!),
    enabled: Boolean(playerId && agentId),
  });

function invalidateAgentQueries(queryClient: ReturnType<typeof useQueryClient>, playerId: string, agentId?: string) {
  void queryClient.invalidateQueries({ queryKey: [...AGENTS_QUERY_KEY, playerId] });
  if (agentId) {
    void queryClient.invalidateQueries({ queryKey: [...AGENTS_QUERY_KEY, "detail", playerId, agentId] });
    void queryClient.invalidateQueries({ queryKey: [...AGENTS_QUERY_KEY, "messages", playerId, agentId] });
    void queryClient.invalidateQueries({ queryKey: [...AGENTS_QUERY_KEY, "history", playerId, agentId] });
  }
}

export const useLaunchMyAgentMutation = (playerId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof launchMyAgent>[1]) => launchMyAgent(playerId!, payload),
    onSuccess: (response) => {
      if (!playerId) return;
      invalidateAgentQueries(queryClient, playerId, response.agentId);
    },
  });
};

export const useCompleteMyAgentSetupMutation = (playerId: string | null, agentId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompleteAgentSetupRequest) => completeMyAgentSetup(agentId!, payload),
    onSuccess: () => {
      if (!playerId || !agentId) return;
      invalidateAgentQueries(queryClient, playerId, agentId);
    },
  });
};

export const useUpdateMyAgentMutation = (playerId: string | null, agentId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateMyAgent(playerId!, agentId!, payload),
    onSuccess: () => {
      if (!playerId || !agentId) return;
      invalidateAgentQueries(queryClient, playerId, agentId);
    },
  });
};

export const useEnableMyAgentAutonomyMutation = (playerId: string | null, agentId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnableAgentAutonomyRequest) => enableMyAgentAutonomy(playerId!, agentId!, payload),
    onSuccess: () => {
      if (!playerId || !agentId) return;
      invalidateAgentQueries(queryClient, playerId, agentId);
    },
  });
};

export const useDisableMyAgentAutonomyMutation = (playerId: string | null, agentId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DisableAgentAutonomyRequest) => disableMyAgentAutonomy(playerId!, agentId!, payload),
    onSuccess: () => {
      if (!playerId || !agentId) return;
      invalidateAgentQueries(queryClient, playerId, agentId);
    },
  });
};

export const useSetMyAgentSteeringMutation = (playerId: string | null, agentId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetSteeringJobRequest) => setMyAgentSteering(playerId!, agentId!, payload),
    onSuccess: () => {
      if (!playerId || !agentId) return;
      invalidateAgentQueries(queryClient, playerId, agentId);
    },
  });
};

export const useSendMyAgentMessageMutation = (playerId: string | null, agentId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content: string; metadata?: Record<string, unknown> }) =>
      sendMyAgentMessage(playerId!, agentId!, payload),
    onSuccess: () => {
      if (!playerId || !agentId) return;
      invalidateAgentQueries(queryClient, playerId, agentId);
    },
  });
};

export const useAgentEventsStream = (
  playerId: string | null,
  agentId: string | null,
  afterSeq: number,
  onEvent: (event: { seq: number; type: string; payload?: Record<string, unknown>; createdAt: string }) => void,
) => {
  return () => {
    if (!playerId || !agentId || typeof window === "undefined") {
      return () => {};
    }

    const eventSource = new EventSource(buildMyAgentEventsUrl(playerId, agentId, afterSeq), {
      withCredentials: false,
    });

    eventSource.onmessage = (messageEvent) => {
      try {
        const parsed = JSON.parse(messageEvent.data) as {
          seq: number;
          type: string;
          payload?: Record<string, unknown>;
          createdAt: string;
        };
        onEvent(parsed);
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      eventSource.close();
    };
  };
};
