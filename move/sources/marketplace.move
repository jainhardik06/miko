module miko::marketplace {
    use std::signer;
    use std::vector;
    use std::option;
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::table;

    use miko::cct;
    use miko::roles;

    const E_NOT_ENOUGH: u64 = 1;
    const E_INVALID_ID: u64 = 2;
    const E_NOT_SELLER: u64 = 3;
    const E_ZERO: u64 = 4;

    struct Listing has copy, drop, store {
        id: u64,
        seller: address,
        remaining: u64,
        unit_price: u64,
        created_at: u64,
    }
    
    // Table based escrow: maps listing id -> escrowed CCT coins
    struct Escrows has key { inner: table::Table<u64, coin::Coin<miko::cct::CCT>> }

    struct Registry has key { list: vector<Listing>, next_id: u64, fee_bps: u64, fee_treasury: address }

    struct Events has key {
        listed: event::EventHandle<Listed>,
        purchased: event::EventHandle<Purchased>,
        delisted: event::EventHandle<Delisted>,
    }

    struct Listed has drop { id: u64, seller: address, amount: u64, price: u64 }
    struct Purchased has drop { id: u64, buyer: address, amount: u64, total_paid: u64, fee: u64 }
    struct Delisted has drop { id: u64 }

    public entry fun init(admin: &signer, fee_bps: u64) {
        roles::assert_admin(signer::address_of(admin));
        move_to(admin, Registry { list: vector::empty(), next_id: 0, fee_bps, fee_treasury: signer::address_of(admin) });
        move_to(admin, Events {
            listed: event::new_event_handle<Listed>(admin),
            purchased: event::new_event_handle<Purchased>(admin),
            delisted: event::new_event_handle<Delisted>(admin)
        });
        move_to(admin, Escrows { inner: table::new<u64, coin::Coin<miko::cct::CCT>>() });
    }

    public entry fun list(seller: &signer, amount: u64, unit_price: u64) acquires Registry, Events, Escrows {
        assert!(amount > 0, E_ZERO);
        let addr = signer::address_of(seller);
        let coins = coin::withdraw<miko::cct::CCT>(seller, amount);
        let registry = borrow_global_mut<Registry>(@admin);
        let id = registry.next_id; registry.next_id = id + 1;
        vector::push_back(&mut registry.list, Listing { id, seller: addr, remaining: amount, unit_price, created_at: timestamp::now_seconds() });
        let esc = borrow_global_mut<Escrows>(@admin);
        table::add(&mut esc.inner, id, coins);
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.listed, Listed { id, seller: addr, amount, price: unit_price });
    }

    public entry fun delist(seller: &signer, listing_id: u64) acquires Registry, Events, Escrows {
        let addr = signer::address_of(seller);
        let registry = borrow_global_mut<Registry>(@admin);
        let (l_ref, idx) = borrow_listing_mut(registry, listing_id);
        assert!(l_ref.seller == addr, E_NOT_SELLER);
        let esc = borrow_global_mut<Escrows>(@admin);
        let coins = table::remove(&mut esc.inner, listing_id);
        coin::deposit(addr, coins);
        remove_listing(registry, idx);
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.delisted, Delisted { id: listing_id });
    }

    public entry fun buy(buyer: &signer, listing_id: u64, amount: u64) acquires Registry, Events, Escrows {
        assert!(amount > 0, E_ZERO);
        let registry = borrow_global_mut<Registry>(@admin);
        let (l_ref, idx) = borrow_listing_mut(registry, listing_id);
        assert!(l_ref.remaining >= amount, E_NOT_ENOUGH);
        let esc = borrow_global_mut<Escrows>(@admin);
        let escrow_coins = table::remove(&mut esc.inner, listing_id);
        let (to_transfer, remainder_pool) = coin::split(escrow_coins, amount);
        let fee = amount * registry.fee_bps / 10_000;
        if (fee > 0) {
            let fee_part = coin::extract(&mut to_transfer, fee);
            coin::deposit(registry.fee_treasury, fee_part);
        };
        coin::deposit(signer::address_of(buyer), to_transfer);
        let new_remaining = l_ref.remaining - amount;
        if (new_remaining > 0) {
            table::add(&mut esc.inner, listing_id, remainder_pool);
            l_ref.remaining = new_remaining;
        } else {
            if (remainder_pool.value > 0) coin::deposit(l_ref.seller, remainder_pool);
            remove_listing(registry, idx);
        };
        let ev = borrow_global_mut<Events>(@admin);
        event::emit_event(&mut ev.purchased, Purchased { id: listing_id, buyer: signer::address_of(buyer), amount, total_paid: amount * l_ref.unit_price, fee });
    }

    /// View: return a copy of all active listings
    public fun listings(): vector<Listing> acquires Registry {
        let r = borrow_global<Registry>(@admin);
        let out = vector::empty<Listing>();
        let len = vector::length(&r.list);
        let i = 0;
        while (i < len) {
            let l = vector::borrow(&r.list, i);
            vector::push_back(&mut out, *l);
            i = i + 1;
        };
        out
    }

    /// View: return Option<Listing>
    public fun get_listing(id: u64): option::Option<Listing> acquires Registry {
        let r = borrow_global<Registry>(@admin);
        let len = vector::length(&r.list);
        let i = 0;
        while (i < len) {
            let l = vector::borrow(&r.list, i);
            if (l.id == id) return option::some<Listing>(*l);
            i = i + 1;
        };
        option::none<Listing>()
    }

    fun borrow_listing_mut(registry: &mut Registry, id: u64): (&mut Listing, u64) {
        let len = vector::length(&registry.list);
        let i = 0;
        while (i < len) {
            let l_ref = vector::borrow_mut(&mut registry.list, i);
            if (l_ref.id == id) return (l_ref, i);
            i = i + 1;
        };
        abort E_INVALID_ID
    }

    fun remove_listing(registry: &mut Registry, idx: u64) {
        let last = vector::length(&registry.list) - 1;
        if (idx != last) {
            let last_item = vector::pop_back(&mut registry.list);
            *vector::borrow_mut(&mut registry.list, idx) = last_item;
        } else { vector::pop_back(&mut registry.list); };
    }
}