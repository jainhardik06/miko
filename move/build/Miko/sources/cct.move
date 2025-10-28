module miko::cct {
    use std::signer;
    use aptos_framework::coin;
    use std::string;

    /// Carbon Credit Token definition
    struct CCT has store, drop {}

    struct MintCap has key { cap: coin::MintCapability<CCT> }
    struct BurnCap has key { cap: coin::BurnCapability<CCT> }
    struct FreezeCap has key { cap: coin::FreezeCapability<CCT> }

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
    }

    public fun mint(to: &signer, amount: u64) acquires MintCap {
        let cap = &borrow_global<MintCap>(@admin).cap;
        coin::deposit(signer::address_of(to), coin::mint(amount, cap));
    }

    /// Minimal helper used by tree_nft; if the target is not registered, do nothing (no-op).
    public fun mint_to_address(to: address, amount: u64) acquires MintCap {
        if (!coin::is_account_registered<CCT>(to)) return;
        let cap = &borrow_global<MintCap>(@admin).cap;
        coin::deposit(to, coin::mint(amount, cap));
    }

    public fun balance(addr: address): u64 {
        if (!coin::is_account_registered<CCT>(addr)) return 0;
        coin::balance<CCT>(addr)
    }
}