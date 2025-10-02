module miko::tree_nft {
    use std::signer;
    use std::vector;
    use std::option::{Self, Option};
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::account;
    use aptos_framework::aptos_account;
    use aptos_framework::coin;

    use miko::roles;
    use miko::cct;

    const E_NOT_VALIDATOR: u64 = 1;
    const E_NOT_ORACLE: u64 = 2;
    const E_BAD_STATUS: u64 = 3;
    const E_INVALID_TREE: u64 = 4;

    /// Tree status codes
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_PAUSED: u8 = 2;
    const STATUS_DESTROYED: u8 = 3;

    struct Tree has key {
        id: u64,
        owner: address,
        created_at: u64,
        last_claim: u64,
        rate_ppm: u64, // micro CCT per second
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

    struct TreeMinted has drop { id: u64, owner: address, rate_ppm: u64 }
    struct Claimed has drop { id: u64, owner: address, amount: u64 }
    struct RateSet has drop { id: u64, old_rate: u64, new_rate: u64 }
    struct StatusChanged has drop { id: u64, new_status: u8 }

    public entry fun init(admin: &signer) {
        // only admin
        roles::assert_admin(signer::address_of(admin));
        move_to(admin, Trees { inner: vector::empty(), next_id: 0 });
        move_to(admin, Events {
            tree_minted: event::new_event_handle<TreeMinted>(admin),
            claimed: event::new_event_handle<Claimed>(admin),
            rate_set: event::new_event_handle<RateSet>(admin),
            status_changed: event::new_event_handle<StatusChanged>(admin),
        });
    }

    /// Legacy combined mint kept for backwards compatibility (may be deprecated)
    public entry fun approve_and_mint(validator: &signer, owner: address, metadata_uri: vector<u8>, rate_ppm: u64) acquires Trees, Events {
        let vaddr = signer::address_of(validator);
        assert!(roles::is_validator(vaddr), E_NOT_VALIDATOR);
        internal_mint(owner, metadata_uri, rate_ppm);
    }

    /// Internal friend call for tree_requests to mint after approval.
    public(friend) fun mint_by_validator_internal(_validator: &signer, owner: address, metadata_uri: vector<u8>, rate_ppm: u64): u64 acquires Trees, Events {
        internal_mint(owner, metadata_uri, rate_ppm)
    }

    public entry fun set_rate(oracle: &signer, id: u64, new_rate_ppm: u64) acquires Trees, Events {
        let oaddr = signer::address_of(oracle);
        assert!(roles::is_oracle(oaddr), E_NOT_ORACLE);
        set_rate_internal(id, new_rate_ppm);
    }

    public(friend) fun set_rate_internal(id: u64, new_rate_ppm: u64) acquires Trees, Events {
        let trees = borrow_global_mut<Trees>(@admin);
        let (tree_ref, _) = borrow_tree_mut(trees, id);
        let old = tree_ref.rate_ppm; tree_ref.rate_ppm = new_rate_ppm;
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.rate_set, RateSet { id, old_rate: old, new_rate: new_rate_ppm });
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
        let now = timestamp::now_seconds();
        let pending = (now - tree_ref.last_claim) * tree_ref.rate_ppm / 1_000_000;
        tree_ref.last_claim = now;
        tree_ref.cumulative_claimed = tree_ref.cumulative_claimed + pending;
        cct::mint_to_address(addr, pending);
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.claimed, Claimed { id, owner: addr, amount: pending });
    }

    public fun get_tree(id: u64): Option<Tree> acquires Trees {
        if (!exists<Trees>(@admin)) return option::none<Tree>();
        let trees = borrow_global<Trees>(@admin);
        let len = vector::length(&trees.inner);
        let i = 0;
        while (i < len) {
            let t_ref = vector::borrow(&trees.inner, i);
            if (t_ref.id == id) {
                return option::some<Tree>(copy *t_ref)
            };
            i = i + 1;
        };
        option::none<Tree>()
    }

    public fun pending_amount(id: u64): u64 acquires Trees {
        let trees = borrow_global<Trees>(@admin);
        let (t_ref, _) = borrow_tree(&trees, id);
        if (t_ref.status != STATUS_ACTIVE) return 0;
        let now = timestamp::now_seconds();
        (now - t_ref.last_claim) * t_ref.rate_ppm / 1_000_000
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

    fun internal_mint(owner: address, metadata_uri: vector<u8>, rate_ppm: u64): u64 acquires Trees, Events {
        let trees = borrow_global_mut<Trees>(@admin);
        let id = trees.next_id; trees.next_id = id + 1;
        let now = timestamp::now_seconds();
        vector::push_back(&mut trees.inner, Tree { id, owner, created_at: now, last_claim: now, rate_ppm, status: STATUS_ACTIVE, metadata_uri, cumulative_claimed: 0 });
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.tree_minted, TreeMinted { id, owner, rate_ppm });
        id
    }
}