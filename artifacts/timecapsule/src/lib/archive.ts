import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccountArchive, linkBoothToAccount, linkParticipationToAccount, saveArchiveHomeSelection, type AccountArchive, type BoothState } from '@workspace/api-client-react';
import { useAuth } from '@/hooks/use-auth';

const selectionKey = 'tc-home-strips';
const linkedLocalTokens = new Map<string, string>();
type ArchiveEntry = { id: string; token?: string; booth: BoothState };
type LinkedAccountArchive = AccountArchive & { linkedTokens: Record<string, string> };

export function readHomeSelection(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(selectionKey) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

function writeLocalSelection(tokens: string[]) {
  localStorage.setItem(selectionKey, JSON.stringify(tokens));
}

function cachedLinkedTokens(userId: string): Record<string, string> {
  const prefix = `${userId}:`;
  return Object.fromEntries(
    [...linkedLocalTokens].filter(([key]) => key.startsWith(prefix)).map(([key, id]) => [key.slice(prefix.length), id]),
  );
}

async function linkLocalArchive(userId: string): Promise<boolean> {
  const linkedTokens: Record<string, string> = {};
  const creatorKeys = Object.keys(localStorage).filter((key) => key.startsWith('tc-creator:'));
  const participantKeys = Object.keys(localStorage).filter((key) => key.startsWith('tc-participant:'));
  const migrationKey = `tc-home-selection-migrated:${userId}`;
  if (!creatorKeys.length && !participantKeys.length && localStorage.getItem(migrationKey)) return false;
  for (const key of creatorKeys) {
    const token = key.slice('tc-creator:'.length);
    const creatorToken = localStorage.getItem(key);
    if (!creatorToken) continue;
    const cacheKey = `${userId}:${token}`;
    const cached = linkedLocalTokens.get(cacheKey);
    if (cached) { linkedTokens[token] = cached; continue; }
    try {
      const linked = await linkBoothToAccount({ privateToken: token, creatorToken });
      linkedTokens[token] = linked.id;
      linkedLocalTokens.set(cacheKey, linked.id);
    } catch { /* Keep locally accessible booths even if they cannot be linked. */ }
  }
  for (const key of participantKeys) {
    const [token, slotId] = key.slice('tc-participant:'.length).split(':');
    const participantToken = localStorage.getItem(key);
    if (!token || !slotId || !participantToken || linkedTokens[token]) continue;
    const cacheKey = `${userId}:${token}`;
    const cached = linkedLocalTokens.get(cacheKey);
    if (cached) { linkedTokens[token] = cached; continue; }
    try {
      const linked = await linkParticipationToAccount({ privateToken: token, participantToken, slotId });
      linkedTokens[token] = linked.id;
      linkedLocalTokens.set(cacheKey, linked.id);
    } catch { /* An invalid participant key does not block the archive. */ }
  }
  let archive = await getAccountArchive();
  if (!localStorage.getItem(migrationKey)) {
    const local = readHomeSelection();
    const visibleIds = new Set(archive.entries.map((entry) => entry.id));
    const migrated = local.map((token) => linkedTokens[token]).filter((id) => Boolean(id && visibleIds.has(id)));
    if (migrated.length && !archive.selectedIds.length) {
      const saved = await saveArchiveHomeSelection({ selectedIds: migrated.slice(0, 12) });
      archive = { ...archive, selectedIds: saved.selectedIds };
    }
    writeLocalSelection(local.filter((token) => !linkedTokens[token]));
    localStorage.setItem(migrationKey, 'true');
  }
  return true;
}

export function useArchiveBooths(): { entries: ArchiveEntry[]; selectedIds: string[]; ownedTokens: string[]; isLoading: boolean; error: Error | null; saveSelection: (ids: string[]) => Promise<void> } {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accountKey = ['account-archive', user?.id];
  const accountQuery = useQuery({
    queryKey: accountKey,
    queryFn: async (): Promise<LinkedAccountArchive> => ({ ...await getAccountArchive(), linkedTokens: cachedLinkedTokens(user!.id) }),
    enabled: Boolean(user),
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 2,
  });
  useEffect(() => {
    if (!user || !accountQuery.isSuccess) return;
    let active = true;
    void linkLocalArchive(user.id).then((changed) => {
      if (active && changed) void queryClient.invalidateQueries({ queryKey: ['account-archive', user.id] });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user?.id, accountQuery.isSuccess, queryClient]);
  const account = accountQuery.data;
  const accountEntries = (account?.entries ?? []).map((entry) => ({ ...entry, token: Object.keys(account?.linkedTokens ?? {}).find((token) => account?.linkedTokens[token] === entry.id) }));
  const entries = accountEntries;
  const selectedIds = account?.selectedIds ?? [];
  const saveSelection = async (ids: string[]) => {
    if (!user) throw new Error('Sign in to save your home page selection.');
    const accountIds = ids.filter((id) => account?.entries.some((entry) => entry.id === id));
    const saved = await saveArchiveHomeSelection({ selectedIds: accountIds });
    queryClient.setQueryData<LinkedAccountArchive>(accountKey, (old) => old ? { ...old, selectedIds: saved.selectedIds } : old);
  };
  return {
    entries,
    selectedIds,
    ownedTokens: Object.keys(account?.linkedTokens ?? {}),
    isLoading: Boolean(user && accountQuery.isPending),
    error: accountQuery.error,
    saveSelection,
  };
}
