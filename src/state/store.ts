import { create } from 'zustand';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

export interface Tree {
  id: number;
  owner: string;
  rate_ppm: number;
  status: number;
  metadata_uri: string;
  cumulative_claimed: number;
  pending?: number;
}

interface RolesProfile {
  isAdmin: boolean;
  isValidator: boolean;
  isOracle: boolean;
}

interface WalletState {
  account?: string;
  trees: Tree[];
  cctBalance: string;
  loading: boolean;
  roles: RolesProfile;
  setAccount: (acct?: string) => void;
  setTrees: (t: Tree[]) => void;
  setBalance: (b: string) => void;
  setLoading: (v: boolean) => void;
  setRoles: (r: Partial<RolesProfile>) => void;
  refreshAll: () => Promise<void>;
}

const aptos = new Aptos(new AptosConfig({ network: Network.DEVNET }));

export const useMikoStore = create<WalletState>((set, get) => ({
  account: undefined,
  trees: [],
  cctBalance: '0',
  loading: false,
  roles: { isAdmin: false, isValidator: false, isOracle: false },
  setAccount: (account?: string) => set({ account }),
  setTrees: (trees: Tree[]) => set({ trees }),
  setBalance: (cctBalance: string) => set({ cctBalance }),
  setLoading: (loading: boolean) => set({ loading }),
  setRoles: (r: Partial<RolesProfile>) => set(state => ({ roles: { ...state.roles, ...r } })),
  refreshAll: async () => {
    const { account } = get();
    if (!account) return;
    set({ loading: true });
    try {
      // Placeholder: fetch on-chain data via view functions (pending implementation)
      // Example: const bal = await aptos.getAccountResource(...)
      set({ cctBalance: '0' });
      // TODO: role detection via Move view (would need a view or resource fetch for roles module)
    } finally {
      set({ loading: false });
    }
  }
}));

export { aptos };
