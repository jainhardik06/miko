module miko::tree_nft {
    friend miko::tree_requests;
    friend miko::oracle;
    use std::signer;
    use std::vector;
    use std::option::{Self, Option};
    use aptos_framework::timestamp;
    use aptos_std::event;
    use aptos_framework::account;
    // removed unused imports

    use miko::roles;
    use miko::cct;

    const E_NOT_VALIDATOR: u64 = 1;
    const E_NOT_ORACLE: u64 = 2;
    const E_BAD_STATUS: u64 = 3;
    const E_INVALID_TREE: u64 = 4;
    const E_CANNOT_DECREASE_GRANT: u64 = 5;

    /// Tree status codes
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_PAUSED: u8 = 2;
    const STATUS_DESTROYED: u8 = 3;

    struct Tree has key, store {
        id: u64,
        owner: address,
        created_at: u64,
        last_claim: u64,
        rate_ppm: u64,
        status: u8,
        metadata_uri: vector<u8>,
        cumulative_claimed: u64,
    }

    /// Public, copyable view of a Tree for read-only functions and off-chain clients.
    /// Returning resources (has key) from view functions is not allowed; use this instead.
    struct TreeView has copy, drop, store {
        id: u64,
        owner: address,
        created_at: u64,
        last_claim: u64,
        rate_ppm: u64,
        status: u8,
        metadata_uri: vector<u8>,
        cumulative_claimed: u64,
    }

    struct Trees has key { inner: vector<Tree>, next_id: u64 }

    struct Events has key {
        tree_minted: event::EventHandle<TreeMinted>,
        claimed: event::EventHandle<Claimed>,
        rate_set: event::EventHandle<RateSet>,
        status_changed: event::EventHandle<StatusChanged>,
    }

    struct TreeMinted has drop, store { id: u64, owner: address, rate_ppm: u64 }
    struct Claimed has drop, store { id: u64, owner: address, amount: u64 }
    struct RateSet has drop, store { id: u64, old_rate: u64, new_rate: u64 }
    struct StatusChanged has drop, store { id: u64, new_status: u8 }

    public entry fun init(admin: &signer) {
        // only admin
        roles::assert_admin(signer::address_of(admin));
        move_to(admin, Trees { inner: vector::empty(), next_id: 0 });
        move_to(admin, Events {
            tree_minted: account::new_event_handle<TreeMinted>(admin),
            claimed: account::new_event_handle<Claimed>(admin),
            rate_set: account::new_event_handle<RateSet>(admin),
            status_changed: account::new_event_handle<StatusChanged>(admin),
        });
    }

    /// Legacy combined mint kept for backwards compatibility (may be deprecated)
    public entry fun approve_and_mint(validator: &signer, owner: address, metadata_uri: vector<u8>, granted_cct: u64) acquires Trees, Events {
        let vaddr = signer::address_of(validator);
        assert!(roles::is_validator(vaddr), E_NOT_VALIDATOR);
        internal_mint(owner, metadata_uri, granted_cct);
    }

    /// Internal friend call for tree_requests to mint after approval.
    public(friend) fun mint_by_validator_internal(_validator: &signer, owner: address, metadata_uri: vector<u8>, granted_cct: u64): u64 acquires Trees, Events {
        internal_mint(owner, metadata_uri, granted_cct)
    }

    public entry fun set_rate(oracle: &signer, id: u64, new_amount: u64) acquires Trees, Events {
        let oaddr = signer::address_of(oracle);
        assert!(roles::is_oracle(oaddr), E_NOT_ORACLE);
        set_rate_internal(id, new_amount);
    }

    public(friend) fun set_rate_internal(id: u64, new_amount: u64) acquires Trees, Events {
        let trees = borrow_global_mut<Trees>(@admin);
        let (tree_ref, _) = borrow_tree_mut(trees, id);
        let old = tree_ref.rate_ppm;
        assert!(new_amount >= old, E_CANNOT_DECREASE_GRANT);
        if (new_amount == old) return;

        let delta = new_amount - old;
        tree_ref.rate_ppm = new_amount;
        tree_ref.cumulative_claimed = tree_ref.cumulative_claimed + delta;
        tree_ref.last_claim = timestamp::now_seconds();
        cct::mint_to_address(tree_ref.owner, delta);

        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.rate_set, RateSet { id, old_rate: old, new_rate: new_amount });
    }

    public entry fun pause_for_reverify(validator: &signer, id: u64) acquires Trees, Events {
        assert!(roles::is_validator(signer::address_of(validator)), E_NOT_VALIDATOR);
        set_status(id, STATUS_PAUSED);
    }

    public entry fun destroy_tree(validator: &signer, id: u64) acquires Trees, Events {
        assert!(roles::is_validator(signer::address_of(validator)), E_NOT_VALIDATOR);
        set_status(id, STATUS_DESTROYED);
    }

    fun set_status(id: u64, status: u8) acquires Trees, Events {
        let trees = borrow_global_mut<Trees>(@admin);
        let (tree_ref, _) = borrow_tree_mut(trees, id);
        tree_ref.status = status;
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.status_changed, StatusChanged { id, new_status: status });
    }

    public entry fun claim(owner_signer: &signer, id: u64) acquires Trees, Events {
        let addr = signer::address_of(owner_signer);
        let trees = borrow_global_mut<Trees>(@admin);
        let (tree_ref, _) = borrow_tree_mut(trees, id);
        assert!(tree_ref.owner == addr, E_INVALID_TREE);
        assert!(tree_ref.status == STATUS_ACTIVE, E_BAD_STATUS);
        tree_ref.last_claim = timestamp::now_seconds();
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.claimed, Claimed { id, owner: addr, amount: 0 });
    }

    #[view]
    public fun get_tree(id: u64): Option<TreeView> acquires Trees {
        if (!exists<Trees>(@admin)) return option::none<TreeView>();
        let trees = borrow_global<Trees>(@admin);
        let len = vector::length(&trees.inner);
        let i = 0;
        while (i < len) {
            let t_ref = vector::borrow(&trees.inner, i);
            if (t_ref.id == id) {
                let view = TreeView {
                    id: t_ref.id,
                    owner: t_ref.owner,
                    created_at: t_ref.created_at,
                    last_claim: t_ref.last_claim,
                    rate_ppm: t_ref.rate_ppm,
                    status: t_ref.status,
                    metadata_uri: clone_bytes(&t_ref.metadata_uri),
                    cumulative_claimed: t_ref.cumulative_claimed,
                };
                return option::some<TreeView>(view)
            };
            i = i + 1;
        };
        option::none<TreeView>()
    }

    /// Utility: clone a vector<u8> from an immutable reference.
    fun clone_bytes(src: &vector<u8>): vector<u8> {
        let out = vector::empty<u8>();
        let len = vector::length(src);
        let i = 0;
        while (i < len) {
            let b_ref = vector::borrow(src, i);
            // u8 has copy; push value into out
            vector::push_back(&mut out, *b_ref);
            i = i + 1;
        };
        out
    }

    public fun pending_amount(id: u64): u64 acquires Trees {
        let trees = borrow_global<Trees>(@admin);
        borrow_tree(trees, id);
        0
    }

    fun borrow_tree(trees: &Trees, id: u64): (&Tree, u64) {
        let len = vector::length(&trees.inner);
        let i = 0;
        while (i < len) {
            let t_ref = vector::borrow(&trees.inner, i);
            if (t_ref.id == id) return (t_ref, i);
            i = i + 1;
        };
        abort E_INVALID_TREE
    }

    fun borrow_tree_mut(trees: &mut Trees, id: u64): (&mut Tree, u64) {
        let len = vector::length(&trees.inner);
        let i = 0;
        while (i < len) {
            let t_ref = vector::borrow_mut(&mut trees.inner, i);
            if (t_ref.id == id) return (t_ref, i);
            i = i + 1;
        };
        abort E_INVALID_TREE
    }

    fun internal_mint(owner: address, metadata_uri: vector<u8>, granted_cct: u64): u64 acquires Trees, Events {
        let trees = borrow_global_mut<Trees>(@admin);
        let id = trees.next_id;
        trees.next_id = id + 1;
        let now = timestamp::now_seconds();

        // Immediately mint the granted CCT amount to the owner (no accrual mechanics).
        cct::mint_to_address(owner, granted_cct);

        vector::push_back(&mut trees.inner, Tree {
            id,
            owner,
            created_at: now,
            last_claim: now,
            rate_ppm: granted_cct,
            status: STATUS_ACTIVE,
            metadata_uri,
            cumulative_claimed: granted_cct,
        });

        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.tree_minted, TreeMinted { id, owner, rate_ppm: granted_cct });
        id
    }
}

