import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccountArchive, getBooth, getGetBoothQueryKey, linkBoothToAccount, linkParticipationToAccount, saveArchiveHomeSelection, type AccountArchive, type BoothState } from '@workspace/api-client-react';
import { useAuth } from '@/hooks/use-auth';

const selectionKey = 'tc-home-strips';
const linkedLocalTokens = new Map<string, string>();
type ArchiveEntry = { id: string; token?: string; booth: BoothState };
type LinkedAccountArchive = AccountArchive & { linkedTokens: Record<string, string> };

export function availableBoothTokens(): string[] {
  const tokens = new Set<string>();
  const active = localStorage.getItem('tc-active-booth');
  if (active) tokens.add(active);
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index) ?? '';
    if (key.startsWith('tc-creator:')) tokens.add(key.slice('tc-creator:'.length));
    if (key.startsWith('tc-participant:')) tokens.add(key.slice('tc-participant:'.length).split(':')[0]);
  }
  return [...tokens];
}

export function readHomeSelection(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(selectionKey) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

function writeLocalSelection(tokens: string[]) {
  localStorage.setItem(selectionKey, JSON.stringify(tokens));
}

async function fetchAccountArchive(userId: string): Promise<LinkedAccountArchive> {
  const linkedTokens: Record<string, string> = {};
  const creatorKeys = Object.keys(localStorage).filter((key) => key.startsWith('tc-creator:'));
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
  const participantKeys = Object.keys(localStorage).filter((key) => key.startsWith('tc-participant:'));
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
  const migrationKey = `tc-home-selection-migrated:${userId}`;
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
  return { ...archive, linkedTokens };
}

export function useArchiveBooths(): { entries: ArchiveEntry[]; selectedIds: string[]; ownedTokens: string[]; isLoading: boolean; error: Error | null; saveSelection: (ids: string[]) => Promise<void> } {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tokens = availableBoothTokens();
  const localQueries = useQueries({ queries: tokens.map((token) => ({
    queryKey: getGetBoothQueryKey(token), queryFn: () => getBooth(token), enabled: !user, retry: false, staleTime: 30_000,
  })) });
  const accountKey = ['account-archive', user?.id];
  const accountQuery = useQuery({ queryKey: accountKey, queryFn: () => fetchAccountArchive(user!.id), enabled: Boolean(user), staleTime: 0, refetchInterval: 30_000, retry: false });
  const account = accountQuery.data;
  const localEntries = (user ? [] : tokens).flatMap((token, index) => {
    const booth = localQueries[index]?.data;
    return booth?.revealAvailable && !account?.linkedTokens[token] ? [{ id: token, token, booth }] : [];
  });
  const accountEntries = (account?.entries ?? []).map((entry) => ({ ...entry, token: Object.keys(account?.linkedTokens ?? {}).find((token) => account?.linkedTokens[token] === entry.id) }));
  const entries = [...accountEntries, ...localEntries];
  const selectedIds = [...(account?.selectedIds ?? []), ...readHomeSelection().filter((token) => localEntries.some((entry) => entry.id === token))];
  const saveSelection = async (ids: string[]) => {
    if (!user) { writeLocalSelection(ids); return; }
    const accountIds = ids.filter((id) => account?.entries.some((entry) => entry.id === id));
    const localIds = ids.filter((id) => localEntries.some((entry) => entry.id === id));
    const saved = await saveArchiveHomeSelection({ selectedIds: accountIds });
    writeLocalSelection(localIds);
    queryClient.setQueryData<LinkedAccountArchive>(accountKey, (old) => old ? { ...old, selectedIds: saved.selectedIds } : old);
  };
  return {
    entries,
    selectedIds,
    ownedTokens: Object.keys(account?.linkedTokens ?? {}),
    isLoading: (!user && localQueries.some((query) => query.isPending)) || Boolean(user && accountQuery.isPending),
    error: accountQuery.error,
    saveSelection,
  };
}
