module miko::cct {
    use std::signer;
    use aptos_framework::coin;
    use aptos_framework::table;
    use std::string;

    /// Carbon Credit Token definition
    struct CCT has store, drop {}

    struct MintCap has key { cap: coin::MintCapability<CCT> }
    struct BurnCap has key { cap: coin::BurnCapability<CCT> }
    struct FreezeCap has key { cap: coin::FreezeCapability<CCT> }

    struct Pending has key { map: table::Table<address, u64> }

    const E_NOT_ADMIN: u64 = 1;
    const E_ALREADY_INIT: u64 = 2;

    public entry fun init(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @admin, E_NOT_ADMIN);
        assert!(!exists<MintCap>(@admin), E_ALREADY_INIT);

        // Initialize coin and capabilities (framework API signature with metadata)
        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<CCT>(
            admin,
            string::utf8(b"Miko Carbon Token"),
            string::utf8(b"CCT"),
            6,
            false
        );

        // Register admin to hold CCT and store capabilities
        coin::register<CCT>(admin);
        move_to(admin, MintCap { cap: mint_cap });
        move_to(admin, BurnCap { cap: burn_cap });
        move_to(admin, FreezeCap { cap: freeze_cap });
        move_to(admin, Pending { map: table::new<address, u64>() });
    }

    public entry fun ensure_pending(admin: &signer) {
        let addr = signer::address_of(admin);
        assert!(addr == @admin, E_NOT_ADMIN);
        if (exists<Pending>(@admin)) return;
        move_to(admin, Pending { map: table::new<address, u64>() });
    }

    public entry fun grant(admin: &signer, recipient: address, amount: u64) acquires MintCap, Pending {
        let addr = signer::address_of(admin);
        assert!(addr == @admin, E_NOT_ADMIN);
        mint_to_address(recipient, amount);
    }

    public fun mint(to: &signer, amount: u64) acquires MintCap {
        let cap = &borrow_global<MintCap>(@admin).cap;
        coin::deposit(signer::address_of(to), coin::mint(amount, cap));
    }

    /// Minimal helper used by tree_nft; if the target is not registered, do nothing (no-op).
    public fun mint_to_address(to: address, amount: u64) acquires MintCap, Pending {
        if (!coin::is_account_registered<CCT>(to)) {
            add_pending(to, amount);
            return;
        };
        let cap = &borrow_global<MintCap>(@admin).cap;
        coin::deposit(to, coin::mint(amount, cap));
    }

    fun add_pending(addr: address, amount: u64) acquires Pending {
        let pending = borrow_global_mut<Pending>(@admin);
        if (table::contains(&pending.map, addr)) {
            let entry = table::borrow_mut(&mut pending.map, addr);
            *entry = *entry + amount;
        } else {
            table::add(&mut pending.map, addr, amount);
        };
    }

    #[view]
    public fun balance(addr: address): u64 {
        if (!coin::is_account_registered<CCT>(addr)) return 0;
        coin::balance<CCT>(addr)
    }

    #[view]
    public fun pending(addr: address): u64 acquires Pending {
        if (!exists<Pending>(@admin)) return 0;
        let pending = borrow_global<Pending>(@admin);
        if (!table::contains(&pending.map, addr)) return 0;
        *table::borrow(&pending.map, addr)
    }

    public entry fun claim_pending(user: &signer) acquires Pending, MintCap {
        let addr = signer::address_of(user);
        if (!coin::is_account_registered<CCT>(addr)) {
            coin::register<CCT>(user);
        };

        if (!exists<Pending>(@admin)) return;
        let pending = borrow_global_mut<Pending>(@admin);
        if (!table::contains(&pending.map, addr)) return;

        let amount = table::remove(&mut pending.map, addr);
        if (amount == 0) return;

        let cap = &borrow_global<MintCap>(@admin).cap;
        coin::deposit(addr, coin::mint(amount, cap));
    }
}