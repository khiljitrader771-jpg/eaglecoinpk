import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { INITIAL_PROTOCOL_STATE } from '../data/initialProtocol';
import {
  GovernanceLockTier,
  GovernanceProposal,
  ProtocolEvent,
  ProtocolState,
} from '../types/protocol';
import { db, handleFirestoreError, OperationType } from './firebase';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || 'id-0';
}

export async function ensureUserAndWorkspaceSeeded(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const userPath = `users/${uid}`;
  const workspacePath = `workspaces/${uid}`;

  // 1. Ensure user profile doc exists
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid,
        email: (user.email || 'user@eaglecoinpk.org').slice(0, 254),
        displayName: (user.displayName || user.email || 'EPK Holder').slice(0, 120),
        epkBalance: INITIAL_PROTOCOL_STATE.userEpkBalance,
        usdcBalance: INITIAL_PROTOCOL_STATE.userUsdcBalance,
        governanceLockTier: INITIAL_PROTOCOL_STATE.governanceLockTier,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  // 2. Ensure user workspace & initial ledger events exist
  try {
    const wsRef = doc(db, 'workspaces', uid);
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists()) {
      const batch = writeBatch(db);
      batch.set(wsRef, {
        ownerUid: uid,
        activeChain: INITIAL_PROTOCOL_STATE.activeChain,
        spotPriceUsd: INITIAL_PROTOCOL_STATE.spotPriceUsd,
        targetPegUsd: INITIAL_PROTOCOL_STATE.targetPegUsd,
        totalSupplyEpk: INITIAL_PROTOCOL_STATE.totalSupplyEpk,
        treasuryReserveUsd: INITIAL_PROTOCOL_STATE.treasuryReserveUsd,
        pendingAutoLpEpk: INITIAL_PROTOCOL_STATE.pendingAutoLpEpk,
        totalAutoLpInjectedUsd: INITIAL_PROTOCOL_STATE.totalAutoLpInjectedUsd,
        autoLpConfig: INITIAL_PROTOCOL_STATE.autoLpConfig,
        pools: INITIAL_PROTOCOL_STATE.pools.slice(0, 20),
        exchanges: INITIAL_PROTOCOL_STATE.exchanges.slice(0, 30),
        reserves: INITIAL_PROTOCOL_STATE.reserves.slice(0, 20),
        pegHistory: INITIAL_PROTOCOL_STATE.pegHistory.slice(0, 24),
        tvlHistory: INITIAL_PROTOCOL_STATE.tvlHistory.slice(0, 24),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      INITIAL_PROTOCOL_STATE.events.forEach((evt) => {
        const evtId = sanitizeId(evt.id);
        const evtRef = doc(db, 'workspaces', uid, 'events', evtId);
        batch.set(evtRef, {
          ownerUid: uid,
          timestamp: evt.timestamp.slice(0, 32),
          type: evt.type,
          summary: evt.summary.slice(0, 300),
          amountEpk: evt.amountEpk,
          usdValue: evt.usdValue,
          postPegPrice: evt.postPegPrice,
          txHash: evt.txHash.slice(0, 80),
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, workspacePath);
  }

  // 3. Ensure shared governance proposals collection is seeded
  const proposalsPath = 'proposals';
  try {
    const q = query(
      collection(db, proposalsPath),
      where('visibility', '==', 'public'),
      limit(1)
    );
    const existing = await getDocs(q);
    if (existing.empty) {
      const batch = writeBatch(db);
      INITIAL_PROTOCOL_STATE.proposals.forEach((prop) => {
        const propId = sanitizeId(prop.id);
        const propRef = doc(db, proposalsPath, propId);
        const payload: Record<string, unknown> = {
          proposalCode: propId.slice(0, 32),
          title: prop.title.slice(0, 160),
          description: prop.description.slice(0, 2000),
          proposerUid: uid,
          proposerLabel: prop.proposer.slice(0, 64),
          category: prop.category,
          votesFor: prop.votesFor,
          votesAgainst: prop.votesAgainst,
          votesAbstain: prop.votesAbstain,
          quorumRequired: prop.quorumRequired,
          status: prop.status,
          visibility: 'public',
          createdDate: prop.createdAt.slice(0, 20),
          endsAt: prop.endsAt.slice(0, 20),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (prop.parameterChange) {
          payload.parameterChange = {
            field: prop.parameterChange.field,
            targetValue: prop.parameterChange.targetValue,
            summaryLabel: prop.parameterChange.summaryLabel.slice(0, 160),
          };
        }
        batch.set(propRef, payload);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, proposalsPath);
  }
}

export async function syncUserProfile(
  uid: string,
  updates: {
    epkBalance?: number;
    usdcBalance?: number;
    governanceLockTier?: GovernanceLockTier;
  }
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncWorkspaceState(
  uid: string,
  state: ProtocolState
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `workspaces/${safeUid}`;
  try {
    await updateDoc(doc(db, 'workspaces', safeUid), {
      activeChain: state.activeChain,
      spotPriceUsd: state.spotPriceUsd,
      totalSupplyEpk: state.totalSupplyEpk,
      treasuryReserveUsd: state.treasuryReserveUsd,
      pendingAutoLpEpk: state.pendingAutoLpEpk,
      totalAutoLpInjectedUsd: state.totalAutoLpInjectedUsd,
      autoLpConfig: state.autoLpConfig,
      pools: state.pools.slice(0, 20),
      exchanges: state.exchanges.slice(0, 30),
      reserves: state.reserves.slice(0, 20),
      pegHistory: state.pegHistory.slice(0, 24),
      tvlHistory: state.tvlHistory.slice(0, 24),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function appendLedgerEvent(
  uid: string,
  event: ProtocolEvent
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeEventId = sanitizeId(event.id);
  const path = `workspaces/${safeUid}/events/${safeEventId}`;
  try {
    await setDoc(doc(db, 'workspaces', safeUid, 'events', safeEventId), {
      ownerUid: safeUid,
      timestamp: event.timestamp.slice(0, 32),
      type: event.type,
      summary: event.summary.slice(0, 300),
      amountEpk: Math.max(0, event.amountEpk),
      usdValue: Math.max(0, event.usdValue),
      postPegPrice: event.postPegPrice,
      txHash: event.txHash.slice(0, 80),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createGovernanceProposalInDb(
  uid: string,
  proposerLabel: string,
  proposal: GovernanceProposal,
  initialVotePower: number
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const propId = sanitizeId(proposal.id);
  const path = `proposals/${propId}`;

  try {
    const batch = writeBatch(db);
    const payload: Record<string, unknown> = {
      proposalCode: propId.slice(0, 32),
      title: proposal.title.slice(0, 160),
      description: proposal.description.slice(0, 2000),
      proposerUid: safeUid,
      proposerLabel: proposerLabel.slice(0, 64),
      category: proposal.category,
      votesFor: proposal.votesFor,
      votesAgainst: proposal.votesAgainst,
      votesAbstain: proposal.votesAbstain,
      quorumRequired: proposal.quorumRequired,
      status: proposal.status,
      visibility: 'public',
      createdDate: proposal.createdAt.slice(0, 20),
      endsAt: proposal.endsAt.slice(0, 20),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (proposal.parameterChange) {
      payload.parameterChange = {
        field: proposal.parameterChange.field,
        targetValue: proposal.parameterChange.targetValue,
        summaryLabel: proposal.parameterChange.summaryLabel.slice(0, 160),
      };
    }

    batch.set(doc(db, 'proposals', propId), payload);

    if (initialVotePower > 0) {
      batch.set(doc(db, 'proposals', propId, 'votes', safeUid), {
        proposalId: propId,
        voterUid: safeUid,
        choice: 'for',
        votePower: initialVotePower,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function castProposalVoteInDb(
  uid: string,
  proposal: GovernanceProposal,
  choice: 'for' | 'against' | 'abstain',
  votePower: number,
  hadExistingVote: boolean
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const propId = sanitizeId(proposal.id);
  const path = `proposals/${propId}`;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'proposals', propId), {
      votesFor: proposal.votesFor,
      votesAgainst: proposal.votesAgainst,
      votesAbstain: proposal.votesAbstain,
      status: proposal.status,
      updatedAt: serverTimestamp(),
    });

    const voteRef = doc(db, 'proposals', propId, 'votes', safeUid);
    if (hadExistingVote) {
      batch.update(voteRef, {
        choice,
        votePower,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(voteRef, {
        proposalId: propId,
        voterUid: safeUid,
        choice,
        votePower,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function executeGovernanceProposalInDb(
  proposalId: string
): Promise<void> {
  const propId = sanitizeId(proposalId);
  const path = `proposals/${propId}`;
  try {
    await updateDoc(doc(db, 'proposals', propId), {
      status: 'Executed',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchUserVotesForProposals(
  uid: string,
  proposalIds: string[]
): Promise<Record<string, { choice: 'for' | 'against' | 'abstain'; votePower: number }>> {
  const safeUid = sanitizeId(uid);
  const results: Record<
    string,
    { choice: 'for' | 'against' | 'abstain'; votePower: number }
  > = {};

  await Promise.all(
    proposalIds.map(async (rawId) => {
      const propId = sanitizeId(rawId);
      const path = `proposals/${propId}/votes/${safeUid}`;
      try {
        const snap = await getDoc(doc(db, 'proposals', propId, 'votes', safeUid));
        if (snap.exists()) {
          const data = snap.data();
          results[propId] = {
            choice: data.choice,
            votePower: Number(data.votePower) || 0,
          };
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    })
  );

  return results;
}
