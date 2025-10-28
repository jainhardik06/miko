module miko::tree_requests {
    use std::signer;
    use std::vector;
    use std::option::{Self, Option};
    use aptos_framework::timestamp;
    use aptos_std::event;
    use aptos_framework::account;

    use miko::roles;
    use miko::tree_nft;

    const E_NOT_VALIDATOR: u64 = 1;
    const E_INVALID_REQUEST: u64 = 2;
    const E_BAD_STATUS: u64 = 3;

    const STATUS_PENDING: u8 = 1;
    const STATUS_APPROVED: u8 = 2;
    const STATUS_REJECTED: u8 = 3;

    struct Request has key, store {
        id: u64,
        requester: address,
        metadata_uri: vector<u8>,
        submitted_at: u64,
        status: u8,
        rate_ppm: u64, // optional initial proposed rate (0 until oracle sets or validator decides)
    }

    /// Copyable view for off-chain reads
    struct RequestView has copy, drop, store {
        id: u64,
        requester: address,
        metadata_uri: vector<u8>,
        submitted_at: u64,
        status: u8,
        rate_ppm: u64,
    }

    struct Requests has key { entries: vector<Request>, next_id: u64 }

    struct Events has key {
        submitted: event::EventHandle<Submitted>,
        approved: event::EventHandle<Approved>,
        rejected: event::EventHandle<Rejected>,
    }

    struct Submitted has drop, store { id: u64, requester: address }
    struct Approved has drop, store { id: u64, tree_id: u64, rate_ppm: u64 }
    struct Rejected has drop, store { id: u64 }

    public entry fun init(admin: &signer) {
        roles::assert_admin(signer::address_of(admin));
        move_to(admin, Requests { entries: vector::empty(), next_id: 0 });
        move_to(admin, Events {
            submitted: account::new_event_handle<Submitted>(admin),
            approved: account::new_event_handle<Approved>(admin),
            rejected: account::new_event_handle<Rejected>(admin),
        });
    }

    /// Farmer submits a new tree metadata URI (points to IPFS JSON)
    public entry fun submit(signer_ref: &signer, metadata_uri: vector<u8>) acquires Requests, Events {
        let addr = signer::address_of(signer_ref);
        let store = borrow_global_mut<Requests>(@admin);
        let id = store.next_id; store.next_id = id + 1;
        let now = timestamp::now_seconds();
        vector::push_back(&mut store.entries, Request { id, requester: addr, metadata_uri, submitted_at: now, status: STATUS_PENDING, rate_ppm: 0 });
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.submitted, Submitted { id, requester: addr });
    }

    /// Validator approves and mints tree via friend function in tree_nft. Supplies initial rate_ppm.
    public entry fun approve(validator: &signer, request_id: u64, rate_ppm: u64) acquires Requests, Events {
        assert!(roles::is_validator(signer::address_of(validator)), E_NOT_VALIDATOR);
        let store = borrow_global_mut<Requests>(@admin);
        let (req_ref, _) = borrow_request_mut(store, request_id);
        assert!(req_ref.status == STATUS_PENDING, E_BAD_STATUS);
        req_ref.status = STATUS_APPROVED;
        req_ref.rate_ppm = rate_ppm;
    let tree_id = tree_nft::mint_by_validator_internal(validator, req_ref.requester, clone_bytes(&req_ref.metadata_uri), rate_ppm);
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.approved, Approved { id: request_id, tree_id, rate_ppm });
    }

    public entry fun reject(validator: &signer, request_id: u64) acquires Requests, Events {
        assert!(roles::is_validator(signer::address_of(validator)), E_NOT_VALIDATOR);
        let store = borrow_global_mut<Requests>(@admin);
        let (req_ref, _) = borrow_request_mut(store, request_id);
        assert!(req_ref.status == STATUS_PENDING, E_BAD_STATUS);
        req_ref.status = STATUS_REJECTED;
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.rejected, Rejected { id: request_id });
    }

    #[view]
    public fun get_request(id: u64): Option<RequestView> acquires Requests {
        if (!exists<Requests>(@admin)) return option::none<RequestView>();
        let store = borrow_global<Requests>(@admin);
        let len = vector::length(&store.entries);
        let i = 0;
        while (i < len) {
            let r = vector::borrow(&store.entries, i);
            if (r.id == id) {
                let view = RequestView {
                    id: r.id,
                    requester: r.requester,
                    metadata_uri: clone_bytes(&r.metadata_uri),
                    submitted_at: r.submitted_at,
                    status: r.status,
                    rate_ppm: r.rate_ppm,
                };
                return option::some<RequestView>(view);
            };
            i = i + 1;
        };
        option::none<RequestView>()
    }

    /// Get all pending requests
    #[view]
    public fun get_all_pending(): vector<RequestView> acquires Requests {
        if (!exists<Requests>(@admin)) return vector::empty<RequestView>();
        let store = borrow_global<Requests>(@admin);
        let result = vector::empty<RequestView>();
        let len = vector::length(&store.entries);
        let i = 0;
        while (i < len) {
            let r = vector::borrow(&store.entries, i);
            if (r.status == STATUS_PENDING) {
                let view = RequestView {
                    id: r.id,
                    requester: r.requester,
                    metadata_uri: clone_bytes(&r.metadata_uri),
                    submitted_at: r.submitted_at,
                    status: r.status,
                    rate_ppm: r.rate_ppm,
                };
                vector::push_back(&mut result, view);
            };
            i = i + 1;
        };
        result
    }

    /// Get all requests (any status)
    #[view]
    public fun get_all_requests(): vector<RequestView> acquires Requests {
        if (!exists<Requests>(@admin)) return vector::empty<RequestView>();
        let store = borrow_global<Requests>(@admin);
        let result = vector::empty<RequestView>();
        let len = vector::length(&store.entries);
        let i = 0;
        while (i < len) {
            let r = vector::borrow(&store.entries, i);
            let view = RequestView {
                id: r.id,
                requester: r.requester,
                metadata_uri: clone_bytes(&r.metadata_uri),
                submitted_at: r.submitted_at,
                status: r.status,
                rate_ppm: r.rate_ppm,
            };
            vector::push_back(&mut result, view);
            i = i + 1;
        };
        result
    }

    fun borrow_request_mut(store: &mut Requests, id: u64): (&mut Request, u64) {
        let len = vector::length(&store.entries);
        let i = 0;
        while (i < len) {
            let r = vector::borrow_mut(&mut store.entries, i);
            if (r.id == id) return (r, i);
            i = i + 1;
        };
        abort E_INVALID_REQUEST
    }

    /// Utility: clone a vector<u8> from an immutable reference.
    fun clone_bytes(src: &vector<u8>): vector<u8> {
        let out = vector::empty<u8>();
        let len = vector::length(src);
        let i = 0;
        while (i < len) {
            let b_ref = vector::borrow(src, i);
            vector::push_back(&mut out, *b_ref);
            i = i + 1;
        };
        out
    }
}