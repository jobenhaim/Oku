import type { StoredData } from '../types';

export type ActiveProfile =
    | { kind: 'guest' }
    | { kind: 'account'; uid: string };

export const serializeActiveProfile = (profile: ActiveProfile) => (
    profile.kind === 'guest' ? 'guest' : `account:${profile.uid}`
);

export const parseActiveProfile = (value: string | null): ActiveProfile | null => {
    if (value === 'guest') return { kind: 'guest' };
    if (!value?.startsWith('account:')) return null;

    const uid = value.slice('account:'.length).trim();
    return uid ? { kind: 'account', uid } : null;
};

export const isActiveAccount = (profile: ActiveProfile | null, uid: string) => (
    profile?.kind === 'account' && profile.uid === uid
);

interface AccountSnapshotChoice {
    snapshot: StoredData;
    source: 'cloud' | 'account-cache' | 'guest-conversion';
}

/**
 * Select one complete profile snapshot. Account data is never field-merged
 * with guest data or with another device's save.
 */
export const chooseAccountSnapshot = ({
    accountIsAlreadyActive,
    accountCache,
    cloudSnapshot,
    guestSnapshot,
}: {
    accountIsAlreadyActive: boolean;
    accountCache: StoredData;
    cloudSnapshot: StoredData | null;
    guestSnapshot: StoredData;
}): AccountSnapshotChoice => {
    if (!cloudSnapshot) {
        return accountIsAlreadyActive
            ? { snapshot: accountCache, source: 'account-cache' }
            : { snapshot: guestSnapshot, source: 'guest-conversion' };
    }

    if (accountIsAlreadyActive
        && (accountCache.lastModifiedAt ?? 0) > (cloudSnapshot.lastModifiedAt ?? 0)) {
        return { snapshot: accountCache, source: 'account-cache' };
    }

    return { snapshot: cloudSnapshot, source: 'cloud' };
};
